# MyZone — Complete Project Specification

**What it is:** A mobile application for reporting, triaging, tracking, resolving, and dashboarding community-level civic complaints — in the Indian context, scoped to a single housing society or residential complex ("the Community"). Residents report issues (potholes, leaks, broken streetlights, etc.) via the app or WhatsApp; an AI agent classifies and routes them; the system tracks status end-to-end; admins resolve them; real users confirm the resolution; dashboards and badges surface the results.

This document consolidates nine source specs into one continuous narrative — what exists, how data flows, and how every feature connects to every other. No content has been added or altered beyond organizing and cross-referencing what the source docs already state.

---

## 1. Foundational Decisions (the plumbing every feature assumes)

Before any feature works, five decisions are locked in:

**Tenancy — single-tenant.** One deployed instance of MyZone = one housing society. There is no `society_id` field anywhere. "Ward," wherever it appears (dashboards, broadcasts), means a block/wing/sector *within* that one society — not a city ward. Multi-society support is an explicit future migration, not a v1 concern.

**Identity — phone number + OTP, shared across app and WhatsApp.** One `user_id` per phone number works identically whether the resident reports through the app or through WhatsApp — no separate account-linking step. This single decision is what lets Resolution Confirmation verify "is this replying user really the original reporter or a corroborator" and lets a user's `preferred_channel` be inferred automatically from their first submission, never asked.

Minimum user record:
```json
{
  "user_id": "", "phone_number": "", "name": "", "block_or_wing": "",
  "push_token": "", "preferred_channel": "app|whatsapp",
  "role": "resident|admin", "verified_at": ""
}
```

**Department routing — static category→department lookup.** A small fixed `departments` table (2–4 departments for a single society, e.g. Maintenance, Security, Management Committee) maps Triage Agent categories to the `user_id`s who get notified. Category 6 (human-review) tickets go to all admins, since ambiguous tickets don't have a clear owner yet.

```json
{ "department_id": "", "name": "", "categories_handled": [1,2,3,4,5], "members": ["<user_id>"] }
```

**File/media storage.** Photos: 5 MB max each, up to 3 per report, JPEG/PNG/WebP (HEIC converted on upload). Voice notes are transcribed immediately and the raw audio is *not* retained after successful transcription. Retention: ticket JSON is kept indefinitely (for dashboard history); raw media binaries are purged 90 days after a ticket reaches `closed`. Photos are visible only to the reporter, that ticket's corroborators, and admins — never publicly listable.

**AI classification calls.** Two logical AI calls per submission: a cheap/fast Validity Gate call, then a heavier Triage Agent call. Both must return structured/parseable JSON matching their respective output schemas exactly. Re-triage (during Duplicate Detection's persistence flow) reuses the same Triage Agent call with new evidence — not a separate model or prompt. No vendor is prescribed; any current multimodal LLM API with structured-output support works.

**Notification delivery.** Two channels: push notification + in-app inbox (app users), and an outbound WhatsApp messaging API (WhatsApp users). Broadcasts and status updates are fire-and-forget (no read receipts needed). Resolution Confirmation and the validity-reject retry loop are the only flows that need an inbound reply parsed back — a property of the WhatsApp webhook, not a separate system.

**External services needed:** multimodal LLM API, WhatsApp Business messaging API (send + receive webhook — flagged as the single highest-risk dependency, test first), SMS/OTP API, push notification service, S3-compatible object storage, voice transcription API (sometimes bundled with #1), and a relational database (the data model below is heavily relationally linked, not document-isolated).

---

## 2. The Report Record — One Schema, Built Up Across Features

Every report is a single record that gets progressively enriched as it moves through the pipeline. No feature owns a duplicate copy of this schema; each owns specific fields on it.

```json
{
  "report_id": "",
  "user_id": "<original reporter>",
  "channel": "app|whatsapp",

  "photos": ["<file_id>"],
  "text": "",
  "location": {
    "lat": 0.0, "lng": 0.0, "accuracy_meters": 0.0,
    "address_text": "", "source": "gps|manual_pin|address_typed"
  },
  "submitted_at": "",
  "photo_captured_at": null,

  "validity_score": 0.0,
  "validity_band": "reject|uncertain|valid",
  "validity_flag": "uncertain",

  "category": "<1-5|6>",
  "severity": "<low|moderate|high>",
  "input_state": "<A|B|C|D>",
  "jurisdiction": "",
  "confidence_scores": {"category": 0.0, "severity": 0.0},
  "trigger_reason": "<T1-T6, if Category 6>",
  "conflict_subtype": "<C1-C4, if State B>",
  "agent_notes": "",
  "nearby_reports_checked": [],

  "report_count": 0,
  "corroborators": [],
  "severity_history": [
    {"severity": "", "timestamp": "", "source": "initial|re_triage", "confidence": 0.0}
  ],

  "status": "submitted|triaged|in_progress|resolved|closed|reopened",
  "status_updated_at": "",
  "resolved_at": "",
  "confirmation": {"confirmed_by": null, "confirmed_via": null, "confirmed_at": ""},
  "resolution_flag": "disputed|null",
  "closed_via": "user_confirmed|admin_timeout|null"
}
```

Nothing in this system writes `category` or `severity` except the Triage Agent (including on re-triage). Nothing writes `status` except the specific transitions defined in Section 6. `report_count` and `corroborators` are always written together, by Duplicate Detection only.

---

## 3. End-to-End Flow

```
Resident (App or WhatsApp)
        │
        ▼
  [1] CAPTURE — same inputs both channels: photo, text/voice, location
        │
        ▼
  [2] SUBMISSION VALIDITY GATE  (cheap AI call — is this a civic issue at all?)
        │
        ├── REJECT (score < 0.3) ──► No ticket created. User shown retry message. No-fault, no trust penalty. STOPS HERE.
        │
        └── UNCERTAIN or VALID (score ≥ 0.3) ──► passes through (flagged if uncertain)
                  │
                  ▼
        [3] TRIAGE AGENT  (heavier AI call — category, severity, input_state)
                  │
                  ├── Category 6 (any T1–T6 trigger fires) ──► Human review queue, status stays `triaged`,
                  │         no severity assigned. Once admin resolves ──► re-enters Step 3 with added signal.
                  │
                  └── Category 1–5 assigned, severity assigned ──► status: `triaged`
                              │
                              ▼
                  [4] DUPLICATE DETECTION (Category 1–5 + status=open only)
                              │
                              ├── Score ≥ threshold ──► shown to user: "Same issue" (merge: report_count+1,
                              │         add to corroborators, no new ticket) or "Different issue" (submit standalone)
                              │
                              └── Score < threshold ──► submitted standalone, no prompt
                                          │
                                          ▼
                              [5] TICKET LIVE — status: `triaged`
                                   Department notified (static category→department lookup)
                                          │
                                          ▼
                              [6] ADMIN WORKS TICKET — status: `in_progress` (manual, out of scope of any doc)
                                          │
                                          ▼
                              [7] ADMIN MARKS RESOLVED — status: `resolved`
                                          │
                                          ▼
                              [8] RESOLUTION CONFIRMATION FLOW (see Section 7 for full detail)
                                          │
                              ┌───────────┴───────────┐
                              ▼                        ▼
                      user_confirmed              admin_timeout
                      status: `closed`            status: `closed`
                              │
                              ▼ (if disputed instead)
                      status stays `resolved`, resolution_flag: disputed
                      admin manually reopens ──► status: `reopened` ──► loops to [6] `in_progress`
```

Meanwhile, **Persistence/Worsening** ("Still here / Getting worse") can be triggered by any user on any *existing open* report at any time, independent of the flow above — see Section 5, Part B.

**Independently of all of the above**, Admins can send one-way **Broadcasts** to wards (Section 8) — this has no connection to the report pipeline at all.

**Throughout**, the **Public Case Tracker** (Section 6) is the passive layer rendering `status` to the user and firing one notification per transition — it doesn't drive any of the logic above, only displays it.

**Layered on top**, **Dashboards & Gamification** (Section 9) are pure read-only views over the fields this pipeline produces.

---

## 4. Submission Validity Gate (runs first, every submission, every channel)

A single cheap AI check, separate from the Triage Agent: is this plausibly a real civic issue at all? It does not classify category/severity/input_state — those remain entirely the Triage Agent's job. It evaluates photo + text only (location is not evaluated here — that's a Triage Agent T2 concern).

| Band | Score | Action |
|---|---|---|
| Reject | < 0.3 | Submission stopped. No ticket, no ID, no Triage Agent call. User shown a specific retry message (never a bare "rejected"). |
| Uncertain | 0.3–0.7 | Passes through with `validity_flag: "uncertain"` added to the Triage Agent's input — Triage Agent's own confidence-penalty logic handles it naturally. |
| Valid | > 0.7 | Passes through normally, no flag. |

**Trust score interaction:** both Reject and Uncertain are no-fault — neither penalizes the user, because the gate is inherently imperfect (genuine photos from elderly WhatsApp users on weak cameras can legitimately score low). Pattern-level abuse detection (e.g. 10 rejects in 10 minutes) is explicitly *not* this gate's job — that belongs to a trust-scoring concern referenced as "Feature 5" in this doc's text, reading this gate's reject events as input.

Reject messaging is channel-specific: the app shows an inline retry prompt; WhatsApp replaces the bot's next scripted message and loops back to the photo-request step (same pattern as the voice-transcription failure fallback).

---

## 5. Duplicate Detection & Report Persistence

Runs after the Triage Agent assigns a Category 1–5 (never against Category 6 — those aren't confidently classified yet).

**Two distinct, never-conflated axes:**
- **Severity** — how bad the issue is. Owned entirely by the Triage Agent.
- **report_count** — how widespread/corroborated the issue is. A passive tally. Never feeds back into severity automatically.

### Part A — Duplicate Detection (on new submission)
Candidate existing reports are scored on spatial proximity (category-specific radius), temporal window (category-specific recency), exact category match, and `status = open` (closed reports are never match targets). Severity is *not* a filter — divergent severity is a soft signal only.

- **Score ≥ threshold:** the candidate is shown to the user before final submission. User chooses:
  - *"Same issue"* → no new report created; existing report's `report_count += 1`, user added to `corroborators`, any new photo attached as corroborating evidence.
  - *"Different issue"* → submitted standalone, as normal.
- **Score < threshold:** submitted standalone, no prompt.

There is exactly one threshold and one UI path — no silent auto-merge at any confidence level.

### Part B — Persistence / Worsening (user-initiated, on an existing open report)
A "Still here / Getting worse" action, separate from the duplicate-detection flow above:
1. `report_count += 1`, user added to `corroborators` (same passive increment as a confirmed match).
2. *If* the user attaches new evidence (photo/note, optional): the Triage Agent is re-invoked with the existing category, the new evidence, and the existing location — a fresh classification attempt.
3. If the re-triage severity differs from current severity: **appended** to `severity_history` as a new timestamped entry (never overwritten). Current severity = the most recent entry.
4. If no new evidence is attached: re-triage is skipped entirely; step 1 is the only effect.

`corroborators` is the identity list behind the `report_count` tally — required downstream by Resolution Confirmation, which needs to know *who* to notify, not just how many. It excludes the original reporter.

---

## 6. Status & the Public Case Tracker

One field, `status`, six values, strictly linear with exactly one backward path:

```
submitted → triaged → in_progress → resolved → closed
                                          ↑           ↓
                                          └── reopened ┘   (closed → reopened → in_progress, admin-only,
                                                             only from a `disputed` flag)
```

| # | Status | Set by | Display label |
|---|---|---|---|
| 1 | `submitted` | Validity Gate passes | "Submitted — awaiting review" |
| 2 | `triaged` | Triage Agent assigns a category (incl. Category 6) | "Under review" |
| 3 | `in_progress` | Admin action | "Work in progress" |
| 4 | `resolved` | Admin marks resolved | "Marked resolved — confirm it's fixed" |
| 5 | `closed` | Resolution Confirmation (`user_confirmed` or `auto_timeout`) | "Closed" |
| 6 | `reopened` | Admin, on a `disputed` flag | "Reopened" |

A **Category 6** ticket sits at `status: triaged` — `category: 6` marks it pending human review, it is not a separate status.

`"open"` is never stored — it's a derived grouping (any status that isn't `closed`), computed wherever Duplicate Detection's match filter or the Authority Dashboard's SLA check need it. `disputed` is a flag on a `resolved` ticket, not a status. Rejected submissions (Validity Gate `stop`) never get a ticket ID and never enter this state machine.

**What the Tracker builds:** a single read-only screen per ticket (ID, current status label, last-updated timestamp, and the confirm/dispute action when `resolved`); a shared lookup query used both by the app screen and by WhatsApp's `STATUS #1234` command; one notification per status transition (except `resolved`, which uses Resolution Confirmation's own confirm-request message instead, to avoid duplicating the YES/NO prompt). No history/timeline UI, no per-category label variants.

---

## 7. Resolution Proof & Confirmation

Runs when an admin marks a Category 1–5 report `resolved`. The point: confirm with real users, not just trust the admin's word — with a bounded fallback chain so nothing hangs open forever.

| Step | Who | Window | Outcome |
|---|---|---|---|
| 1 | Original reporter notified alone | — | YES → `closed`. NO → flagged `disputed`, stays `resolved`. No response → step 2. |
| 2 | (wait) | 48h | — |
| 3 | Full `corroborators` pool notified simultaneously (excl. reporter) | — | First response wins. YES → `closed`. NO → `disputed`. Empty pool → skip to step 4 after reporter's window. |
| 4 | (wait) | 48h | No response → step 5 |
| 5 | Admin reminder sent once | — | → step 6 |
| 6 | (wait) | 48h | Admin acts → final. No action → **auto-close**, `closed_via: "auto_timeout"` |

Total bound: 144 hours (48+48+48) from `resolved` to auto-close, with one deliberate exception — a `disputed` flag has **no timeout**; it sits until an admin manually acts, since a genuine "still broken" claim shouldn't be steamrolled by a clock. A `disputed` flag never auto-reopens and never triggers re-triage on its own.

Only the original reporter and that specific report's corroborators can confirm or dispute — no other nearby user has standing.

---

## 8. Utility / Advisory Broadcasts

Fully isolated from the report pipeline — own record type, own table, reads nothing from and writes nothing to any report/status/Triage Agent field. One-way, authority-only.

- **Creation:** admin only. No auto-generation from report patterns or clusters (an explicit non-goal — flagged as a possible *future* feature with its own guardrails). No approval workflow beyond the sending admin's own action.
- **Targeting:** ward/area only (same bucketing as the dashboards), single ward, multiple wards, or all wards. No radius/geofence/per-user targeting — finer detail goes in the message text itself.
- **Compose fields:** message text (free, no enforced limit), category (`utility`/`safety`/`general` — exactly 3, fixed), target ward(s), send (immediate only — no scheduling, no recurring, no drafts, no edit-after-send; corrections are sent as a new follow-up broadcast).
- **Delivery:** app push + an "Advisories" list tab; WhatsApp plain-text message, one-way (a WhatsApp reply to a broadcast falls through to the bot's existing off-script help menu — no broadcast-specific reply handler). No read receipts, no delivery confirmation.

```json
{ "broadcast_id": "", "sent_by": "", "sent_at": "", "category": "utility|safety|general", "target_wards": [], "message_text": "" }
```

---

## 9. Dashboards & Gamification

Three read-only display features. None introduce new logic, new AI calls, or new schema fields — they only read and render what Sections 2–7 already produce.

### A — Authority Dashboard (internal, admin-facing)
SLA deadline = `submitted_at` + (base SLA days × severity multiplier), rounded to the nearest day:

| Category | Base SLA | | Severity | Multiplier |
|---|---|---|---|---|
| 1. Roads, Transport, Infrastructure | 7 days | | High | 1.0× |
| 2. Water, Drainage, Sanitation | 2 days | | Moderate | 1.5× |
| 3. Electricity & Power | 3 days | | Low | 2.0× |
| 4. Public Safety, Health, Environment | 3 days | | | |
| 5. Encroachments & Civic Violations | 14 days | | | |

A report flags **red** once `current_time > SLA deadline` and `status` is still `open` (not `resolved`/`closed`). Binary red/not-red, no amber tier. SLA and red-flag are computed at render time only — never persisted (they'd go stale, since "red" changes purely with the clock).

Clustering is a **sortable table**, not a map: one row per ward — Area, Open Issues, Red (SLA breached), Oldest Open Report.

### B — Community Impact Dashboard (citizen-facing)
Exactly three numbers, ward + month scoped, nothing else:
```
[Ward Name] this month:
- XX issues reported
- XX issues resolved
- XX issues currently open
```
No trend charts, no category breakdowns, no per-user stats (explicitly the lowest-priority feature in the whole system).

### C — Gamification / Badges
Exactly four hardcoded badges, no rules engine or configurable trigger system:

| Badge | Trigger |
|---|---|
| First Report | 1 report submitted (any channel, any status) |
| 5 Reports | 5 reports submitted total |
| Verified Resolver | A user's own report reaches `status: closed` via `closed_via: "user_confirmed"` (not auto-timeout) |
| Persistent Reporter | User appears in `corroborators` on ≥3 distinct reports |

---

## 10. The Triage Agent (the classification core)

Runs after the Validity Gate, on every submission that passes. Classifies into category, severity, and input-state, in order.

**Step 1 — Input state:**
- **A** Photo + text, aligned → proceed.
- **B** Photo + text, materially conflicting → Category 6 (T4), tagged with a conflict subtype (C1 category mismatch, C2 severity mismatch — any tier gap, C3 temporal mismatch via EXIF vs. submitted time, C4 scope mismatch). No auto-resolution at any tier gap.
- **C** Text only → classify on text, confidence penalty on severity (not category) unless the issue type is unambiguous from text alone.
- **D** Photo only → classify on photo + metadata, confidence penalty on severity if context (duration/recurrence/impact) could shift the tier.
- Vague text + no photo, or unusable photo + no text → straight to T2, Category 6.

**Step 2 — Category 6 triggers (T1–T6), checked in order, first match wins, stops further processing:**
T1 Ambiguous (fits 2+ categories, no dominant signal). T2 Insufficient information (incl. missing/low-accuracy location with no compensating address). T3 Novel/unrecognized issue. T4 Conflicting/compound report. T5 High-stakes judgment call (named individuals, disputes, corruption, legal/political sensitivity, multi-agency). T6 Low confidence on *both* category and severity after attempting Step 3.

**Step 3 — Category × severity matrix** (only if no trigger fired): five categories — Roads/Transport/Infrastructure; Water/Drainage/Sanitation; Electricity & Power; Public Safety/Health/Environment; Encroachments & Civic Violations — each with Low/Moderate/High severity anchored by concrete examples (e.g. a transformer fire is Category 3 High; a flickering streetlight is Category 3 Low).

**Category 6** is a confidence/authority fallback, not a severity tier — transient. Once an admin resolves the human-review item, the report re-enters Step 3 with the human's clarification as added signal, and gets a real category.

Location handling: `accuracy_meters > 100` or no pin/address at all is treated as missing/low-quality — a sub-case of T2 unless a compensating `address_text` is present. Location otherwise feeds severity context (e.g. proximity to a school can raise severity within a tier), jurisdiction routing, and the nearby-report lookup (recomputed fresh every run, never read from a stored field).

---

## 11. WhatsApp Reporting Channel

A minimal, fixed-script bot for users who can't use the main app (primarily elderly residents). No NLU, no free-form conversation — one question at a time, fixed order, every off-script message gets the same fixed help menu (no retry-counting, no escalation logic).

**Script:** welcome → request photo → request description (text or voice, with a structured 3-part voice prompt: what/where/how-long) → request location (native share, or typed landmark/address fallback) → ticket number confirmation.

**Voice notes** are always transcribed before being treated as report text — never stored as raw audio for manual review (manual review doesn't scale). Failed/low-confidence transcription loops back to the description step with a retry prompt, never advances on bad data.

**Off-script handling:** any unexpected message at any step gets the fixed help menu (START / STATUS #1234 / HELP — HELP flags for manual staff pickup, no automated resolution).

Submission assembles into the exact same schema the main app produces, with one addition: `channel: "whatsapp"` — for audit/source-tracking only, it doesn't change any classification or matching logic. From here the object is handed to the Validity Gate → Triage Agent pipeline exactly as a main-app submission would be.

---

## 12. Out of Scope / Explicitly Deferred (called out across the docs)

These are named in the source specs as deliberately *not* built in this version, to prevent silent scope creep later:

- No multi-society / multi-tenant support (would require a `society_id` migration).
- No auto-generated broadcasts from report clusters or patterns (flagged as a distinct future feature needing confidence thresholds and false-positive handling).
- No second-admin sign-off or draft/review state for broadcasts.
- No scheduled or recurring broadcasts; no edit/recall after send.
- No map-based clustering visualization on the Authority Dashboard (table only).
- No amber/warning SLA tier — binary red/not-red only.
- No configurable/extensible badge system — exactly four hardcoded badges.
- No timeline/history UI on the case tracker — one current state, one timestamp only.
- No per-category or per-severity label variants anywhere in citizen-facing copy.
- No notification batching/digesting — one notification per event, always.
- No pattern-level abuse/trust scoring inside the Validity Gate itself (deferred to a separate trust-scoring concern).
- No email/password auth alongside phone-OTP identity.
- No per-department permission tiers — just `resident` vs `admin`.
- No manual per-ticket reassignment UI for v1 (Category 6 queue is shared across all admins instead).

---

## 13. Cross-Reference Index — Who Reads/Writes What

| Field | Written by | Read by |
|---|---|---|
| `validity_score`, `validity_band`, `validity_flag` | Validity Gate | Triage Agent (uses flag for confidence penalty) |
| `category`, `severity`, `input_state`, `jurisdiction`, `trigger_reason`, `conflict_subtype` | Triage Agent (incl. on re-triage) | Duplicate Detection, Dashboards, Department routing, Public Tracker (Cat 6 note) |
| `report_count`, `corroborators` | Duplicate Detection (Parts A & B only) | Resolution Confirmation (who to notify), Gamification (Persistent Reporter badge) |
| `severity_history` | Duplicate Detection Part B (re-triage only) | Dashboards (current severity = latest entry) |
| `status`, `status_updated_at` | Public Case Tracker rules, but *set* by: Validity Gate (`submitted`), Triage Agent (`triaged`), Admin (`in_progress`), Admin (`resolved`), Resolution Confirmation (`closed`), Admin (`reopened`) | Everything — Tracker, Dashboards, Duplicate Detection's open-filter, Gamification |
| `resolution_flag`, `confirmation`, `closed_via` | Resolution Confirmation | Public Case Tracker (disputed note), Gamification (Verified Resolver badge) |
| `broadcast_id` record | Broadcasts (fully isolated) | Nothing else — no other feature reads this |

---

## 14. Open Questions This Spec Deliberately Leaves to Build Time

Per Platform Foundations, these are capability requirements, not product picks — to be decided when the build stack is chosen:
- Which multimodal LLM provider/model for the Validity Gate and Triage Agent calls.
- Which WhatsApp Business API provider (test first — highest-risk dependency).
- Which SMS/OTP provider (often bundled with the WhatsApp provider).
- Which push notification service.
- Which S3-compatible object storage provider.
- Which voice transcription provider (sometimes bundled with the LLM API).
- Exact concrete numbers can be adjusted (the 90-day media retention figure is stated as "a default, not a hard requirement" — but some number must be set before launch).
