import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { Report, Broadcast, User, Department, AppState } from "./src/types";

// Initialize express app
const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// In-memory data file path for simple persistence
const DB_FILE = path.join(process.cwd(), "db.json");

// Default initial state matching the spec and HTML mockup
const DEFAULT_DEPARTMENTS: Department[] = [
  {
    department_id: "maint_facilities",
    name: "Maintenance & Facilities",
    categories_handled: [1, 2, 3],
    members: [
      { name: "Rajesh Kumar", user_id: "u_rk" },
      { name: "Suresh Mehta", user_id: "u_sm" },
    ],
  },
  {
    department_id: "security",
    name: "Security",
    categories_handled: [4],
    members: [{ name: "Anand Joshi", user_id: "u_aj" }],
  },
  {
    department_id: "mgmt_committee",
    name: "Management Committee",
    categories_handled: [5, 6],
    members: [
      { name: "Pranav Nair", user_id: "u_pn" },
      { name: "Vikram Reddy", user_id: "u_vr" },
    ],
  },
];

const DEFAULT_USERS: User[] = [
  {
    user_id: "u_priya",
    phone_number: "+919876543210",
    name: "Priya Sharma",
    block_or_wing: "Block C",
    push_token: "token_priya",
    preferred_channel: "app",
    role: "resident",
    verified_at: new Date().toISOString(),
  },
  {
    user_id: "u_admin",
    phone_number: "+919999999999",
    name: "Admin Staff",
    block_or_wing: "Block A",
    push_token: "token_admin",
    preferred_channel: "app",
    role: "admin",
    verified_at: new Date().toISOString(),
  },
  {
    user_id: "u_amit",
    phone_number: "+919811111111",
    name: "Amit Patel",
    block_or_wing: "Block B",
    push_token: "token_amit",
    preferred_channel: "whatsapp",
    role: "resident",
    verified_at: new Date().toISOString(),
  },
];

const DEFAULT_BROADCASTS: Broadcast[] = [
  {
    broadcast_id: "b_1",
    sent_by: "u_admin",
    sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    category: "utility",
    target_wards: ["Block B", "Block C"],
    message_text: "Water supply will be shut off tomorrow 10am–2pm for tank cleaning.",
  },
  {
    broadcast_id: "b_2",
    sent_by: "u_admin",
    sent_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    category: "safety",
    target_wards: ["All"],
    message_text: "Service road behind Block A closed for repaving until Friday.",
  },
  {
    broadcast_id: "b_3",
    sent_by: "u_admin",
    sent_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    category: "general",
    target_wards: ["All"],
    message_text: "Annual society meeting this Saturday, 6pm at the clubhouse.",
  },
];

const DEFAULT_REPORTS: Report[] = [
  {
    report_id: "4127",
    user_id: "u_priya",
    user_name: "Priya Sharma",
    user_phone: "+919876543210",
    channel: "app",
    photos: ["/placeholder_pothole.jpg"],
    text: "Large pothole outside Gate 2, water collecting after rain. It has been getting worse over the week.",
    location: {
      lat: 12.9716,
      lng: 77.5946,
      accuracy_meters: 8,
      address_text: "Block C, near gate 2",
      source: "gps",
    },
    submitted_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago (over SLA!)
    photo_captured_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    validity_score: 0.95,
    validity_band: "valid",
    validity_flag: null,
    category: "1",
    severity: "high",
    input_state: "A",
    jurisdiction: "Maintenance & Facilities",
    confidence_scores: { category: 0.98, severity: 0.92 },
    nearby_reports_checked: [],
    report_count: 1,
    corroborators: [],
    severity_history: [
      {
        severity: "high",
        timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        source: "initial",
        confidence: 0.92,
      },
    ],
    status: "triaged",
    status_updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    resolved_at: null,
    confirmation: { confirmed_by: null, confirmed_via: null, confirmed_at: "" },
    resolution_flag: null,
    closed_via: null,
  },
  {
    report_id: "4126",
    user_id: "u_amit",
    user_name: "Amit Patel",
    user_phone: "+919811111111",
    channel: "whatsapp",
    photos: ["/placeholder_leak.jpg"],
    text: "Significant water seepage in basement parking, Block B. Continuous dripping causing slippery floor.",
    location: {
      lat: 12.9719,
      lng: 77.5949,
      accuracy_meters: 15,
      address_text: "Block B, basement",
      source: "gps",
    },
    submitted_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    photo_captured_at: null,
    validity_score: 0.91,
    validity_band: "valid",
    validity_flag: null,
    category: "2",
    severity: "moderate",
    input_state: "C", // Text only since photo timestamp not available
    jurisdiction: "Maintenance & Facilities",
    confidence_scores: { category: 0.94, severity: 0.85 },
    nearby_reports_checked: [],
    report_count: 2,
    corroborators: ["u_priya"], // Priya also flagged it!
    severity_history: [
      {
        severity: "moderate",
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        source: "initial",
        confidence: 0.85,
      },
    ],
    status: "in_progress",
    status_updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    resolved_at: null,
    confirmation: { confirmed_by: null, confirmed_via: null, confirmed_at: "" },
    resolution_flag: null,
    closed_via: null,
  },
  {
    report_id: "4125",
    user_id: "u_priya",
    user_name: "Priya Sharma",
    user_phone: "+919876543210",
    channel: "app",
    photos: ["/placeholder_ambiguous.jpg"],
    text: "Vague issue: Something fell in the Block A courtyard but it looks like a resident dispute over littering plus some wiring hanging around.",
    location: {
      lat: 12.9712,
      lng: 77.5941,
      accuracy_meters: 25,
      address_text: "Block A courtyard",
      source: "manual_pin",
    },
    submitted_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    photo_captured_at: null,
    validity_score: 0.55,
    validity_band: "uncertain",
    validity_flag: "uncertain",
    category: "6",
    severity: "",
    input_state: "B", // Conflicting/Compound report
    jurisdiction: "Management Committee",
    confidence_scores: { category: 0.45, severity: 0.3 },
    trigger_reason: "T4", // Conflicting / compound
    conflict_subtype: "C1",
    agent_notes: "Description mentions resident dispute (T5) and wiring issues (Cat 3). Categorized under Category 6 for human admin triage.",
    nearby_reports_checked: [],
    report_count: 1,
    corroborators: [],
    severity_history: [],
    status: "triaged",
    status_updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    resolved_at: null,
    confirmation: { confirmed_by: null, confirmed_via: null, confirmed_at: "" },
    resolution_flag: null,
    closed_via: null,
  },
  {
    report_id: "4124",
    user_id: "u_priya",
    user_name: "Priya Sharma",
    user_phone: "+919876543210",
    channel: "app",
    photos: ["/placeholder_streetlight.jpg"],
    text: "Entrance streetlight near Block D is flickering and sometimes completely goes off.",
    location: {
      lat: 12.9722,
      lng: 77.5952,
      accuracy_meters: 5,
      address_text: "Block D entrance",
      source: "gps",
    },
    submitted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    photo_captured_at: null,
    validity_score: 0.98,
    validity_band: "valid",
    validity_flag: null,
    category: "3",
    severity: "low",
    input_state: "A",
    jurisdiction: "Maintenance & Facilities",
    confidence_scores: { category: 0.99, severity: 0.95 },
    nearby_reports_checked: [],
    report_count: 1,
    corroborators: [],
    severity_history: [
      {
        severity: "low",
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        source: "initial",
        confidence: 0.95,
      },
    ],
    status: "resolved",
    status_updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // resolved yesterday
    resolved_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    confirmation: { confirmed_by: null, confirmed_via: null, confirmed_at: "" },
    resolution_flag: null,
    closed_via: null,
  },
  {
    report_id: "4119",
    user_id: "u_amit",
    user_name: "Amit Patel",
    user_phone: "+919811111111",
    channel: "whatsapp",
    photos: ["/placeholder_encroachment.jpg"],
    text: "Vendor setting up continuous temporary stalls on Block C pathway, blocking elderly pedestrian access.",
    location: {
      lat: 12.9715,
      lng: 77.5944,
      accuracy_meters: 10,
      address_text: "Block C parking pathway",
      source: "address_typed",
    },
    submitted_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    photo_captured_at: null,
    validity_score: 0.94,
    validity_band: "valid",
    validity_flag: null,
    category: "5",
    severity: "moderate",
    input_state: "A",
    jurisdiction: "Management Committee",
    confidence_scores: { category: 0.96, severity: 0.88 },
    nearby_reports_checked: [],
    report_count: 3,
    corroborators: ["u_priya", "u_admin"],
    severity_history: [
      {
        severity: "moderate",
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        source: "initial",
        confidence: 0.88,
      },
    ],
    status: "closed",
    status_updated_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 9.2 * 24 * 60 * 60 * 1000).toISOString(),
    confirmation: {
      confirmed_by: "u_amit",
      confirmed_via: "reporter",
      confirmed_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    },
    resolution_flag: null,
    closed_via: "user_confirmed",
  },
];

// Load current state from db.json or return default
function getState(): AppState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading database file", err);
  }
  return {
    reports: DEFAULT_REPORTS,
    broadcasts: DEFAULT_BROADCASTS,
    users: DEFAULT_USERS,
    departments: DEFAULT_DEPARTMENTS,
  };
}

// Save state to db.json
function saveState(state: AppState) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing database file", err);
  }
}

// Temporary in-memory chat session state for simulated WhatsApp users (keyed by phone number)
interface WhatsAppSession {
  step: number; // 0: Init/Wait for Photo, 1: Wait for Description, 2: Wait for Location, 3: Completed
  temporary_report: Partial<Report>;
  history: { sender: "bot" | "user"; text: string; timestamp: string; isVoice?: boolean; isLocation?: boolean; mediaUrl?: string }[];
}
const whatsappSessions: Record<string, WhatsAppSession> = {};

// Helper to initialize Gemini SDK safely
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY is not defined or is placeholder. Using offline rule-based fallback.");
    return null;
  }
  try {
    return new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } catch (err) {
    console.error("Failed to initialize Gemini SDK", err);
    return null;
  }
}

// HEURISTICS FALLBACKS FOR ROBUSTNESS WHEN GEMINI KEY IS NOT YET AVAILABLE
function ruleBasedValidityGate(text: string): { validity_score: number; validity_band: 'reject' | 'uncertain' | 'valid' } {
  const lowercase = text.toLowerCase();
  
  // Test/Meme detection
  if (lowercase.trim() === "test" || lowercase.trim() === "hello" || lowercase.trim() === "hi" || lowercase.includes("meme") || lowercase.includes("selfie")) {
    return { validity_score: 0.1, validity_band: "reject" };
  }

  // Check civic keywords
  const civicKeywords = ["pothole", "leak", "water", "seepage", "light", "electrical", "wire", "dog", "garbage", "trash", "security", "encroach", "vendor", "stall", "block", "broken", "flicker", "drain", "sewage", "noise", "loudspeaker"];
  const matches = civicKeywords.filter(k => lowercase.includes(k));

  if (matches.length >= 2) {
    return { validity_score: 0.9, validity_band: "valid" };
  } else if (matches.length === 1) {
    return { validity_score: 0.6, validity_band: "uncertain" };
  } else {
    // If the string is moderately long, mark uncertain rather than reject to avoid false-positives, as requested by spec
    return lowercase.length > 20 
      ? { validity_score: 0.45, validity_band: "uncertain" } 
      : { validity_score: 0.15, validity_band: "reject" };
  }
}

function ruleBasedTriage(text: string): {
  category: string;
  severity: 'low' | 'moderate' | 'high';
  input_state: 'A' | 'B' | 'C' | 'D';
  jurisdiction: string;
  confidence_scores: { category: number; severity: number };
  trigger_reason?: string;
  conflict_subtype?: string;
  agent_notes: string;
} {
  const lowercase = text.toLowerCase();

  let category = "6"; // Default human review
  let severity: 'low' | 'moderate' | 'high' = "moderate";
  let jurisdiction = "Management Committee";
  let notes = "Classified using rule-based local fallback heuristic.";
  let trigger_reason: string | undefined;

  // 1. Roads, Transport, Footpath (Cat 1)
  if (lowercase.includes("pothole") || lowercase.includes("footpath") || lowercase.includes("road") || lowercase.includes("divider") || lowercase.includes("parking")) {
    category = "1";
    jurisdiction = "Maintenance & Facilities";
    severity = lowercase.includes("deep") || lowercase.includes("accident") || lowercase.includes("collapsed") ? "high" : (lowercase.includes("minor") ? "low" : "moderate");
  }
  // 2. Water, Drainage, Sanitation (Cat 2)
  else if (lowercase.includes("leak") || lowercase.includes("seepage") || lowercase.includes("waterlog") || lowercase.includes("drain") || lowercase.includes("sewage") || lowercase.includes("garbage") || lowercase.includes("trash")) {
    category = "2";
    jurisdiction = "Maintenance & Facilities";
    severity = lowercase.includes("overflow") || lowercase.includes("contaminate") || lowercase.includes("flooding") ? "high" : (lowercase.includes("drip") || lowercase.includes("slow") ? "low" : "moderate");
  }
  // 3. Electricity & Power (Cat 3)
  else if (lowercase.includes("light") || lowercase.includes("electricity") || lowercase.includes("wire") || lowercase.includes("pole") || lowercase.includes("transformer") || lowercase.includes("blackout") || lowercase.includes("flicker")) {
    category = "3";
    jurisdiction = "Maintenance & Facilities";
    severity = lowercase.includes("exposed") || lowercase.includes("fire") || lowercase.includes("live wire") || lowercase.includes("complete blackout") ? "high" : (lowercase.includes("flickering") || lowercase.includes("bulb") ? "low" : "moderate");
  }
  // 4. Public Safety, Health, Environment (Cat 4)
  else if (lowercase.includes("dog") || lowercase.includes("stray") || lowercase.includes("cctv") || lowercase.includes("safety") || lowercase.includes("animal") || lowercase.includes("mosquito") || lowercase.includes("fire hazard")) {
    category = "4";
    jurisdiction = "Security";
    severity = lowercase.includes("hazard") || lowercase.includes("leak") || lowercase.includes("collapse") || lowercase.includes("attack") ? "high" : (lowercase.includes("litter") || lowercase.includes("noise") ? "low" : "moderate");
  }
  // 5. Encroachments & Civic Violations (Cat 5)
  else if (lowercase.includes("vendor") || lowercase.includes("hawker") || lowercase.includes("stall") || lowercase.includes("illegal") || lowercase.includes("construction") || lowercase.includes("grab")) {
    category = "5";
    jurisdiction = "Management Committee";
    severity = lowercase.includes("blocking emergency") || lowercase.includes("large scale") || lowercase.includes("grabbing") ? "high" : (lowercase.includes("minor") ? "low" : "moderate");
  }
  // 6. Category 6 Ambiguous
  else {
    category = "6";
    trigger_reason = "T1"; // Ambiguous
    notes += " No strong keyword match. Routed to human-review queue.";
  }

  return {
    category,
    severity: category === "6" ? "" as any : severity,
    input_state: "C", // Text only since standard online photo parsing is offline
    jurisdiction,
    confidence_scores: { category: 0.85, severity: 0.8 },
    trigger_reason,
    agent_notes: notes,
  };
}

// GEMINI-POWERED CORE AI METHODS
async function runValidityGate(text: string, photoBase64?: string): Promise<{ validity_score: number; validity_band: 'reject' | 'uncertain' | 'valid'; reason: string }> {
  const client = getGeminiClient();
  if (!client) {
    const local = ruleBasedValidityGate(text);
    return { ...local, reason: "Local offline heuristics model evaluation." };
  }

  try {
    const parts: any[] = [
      {
        text: `You are the Submission Validity Gate AI for a housing society civic complaint app.
Evaluate if the following report is a genuine community/society civic issue (e.g. pothole, broken streetlight, leaking pipes, garbage pile, exposed wiring, stray animal threat, encroachment, fire safety issue, loudspeaker nuisance) OR if it is SPAM, a meme, a selfie, or unrelated text.

Return your response strictly in the following JSON format:
{
  "validity_score": number (0.0 to 1.0, where > 0.7 means definitely valid civic complaint, < 0.3 means definitely invalid spam/unrelated),
  "validity_band": "reject" | "uncertain" | "valid",
  "reason": "Brief 1-sentence reason"
}

User text description: "${text}"`
      }
    ];

    if (photoBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: photoBase64.split(",")[1] || photoBase64,
        }
      });
    }

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      validity_score: typeof result.validity_score === "number" ? result.validity_score : 0.8,
      validity_band: ["reject", "uncertain", "valid"].includes(result.validity_band) ? result.validity_band : "valid",
      reason: result.reason || "Processed successfully by Gemini.",
    };
  } catch (err) {
    console.error("Gemini Validity Gate error, falling back to rules:", err);
    const local = ruleBasedValidityGate(text);
    return { ...local, reason: "Local heuristics fallback (Gemini execution error)." };
  }
}

async function runTriageAgent(
  text: string,
  photoBase64?: string,
  validityFlag?: 'uncertain' | null
): Promise<{
  category: string;
  severity: 'low' | 'moderate' | 'high' | '';
  input_state: 'A' | 'B' | 'C' | 'D';
  jurisdiction: string;
  confidence_scores: { category: number; severity: number };
  trigger_reason?: string;
  conflict_subtype?: string;
  suggested_categories?: string[];
  agent_notes: string;
}> {
  const client = getGeminiClient();
  if (!client) {
    return runTriageAgentOffline(text, photoBase64, validityFlag);
  }

  try {
    const parts: any[] = [
      {
        text: `You are the Triage Agent AI for Green Meadows Housing Society.
Classify the civic complaint according to the taxonomy below.

Categories:
1. Roads, Transport & Public Infrastructure (SLA: 7 days. Low: faded lane, cracks; Moderate: medium potholes, broken speed breakers; High: deep potholes causing accident, collapsed footbridge)
2. Water, Drainage & Sanitation (SLA: 2 days. Low: minor seepage, outside monsoon slow drain; Moderate: leaking pipe, partial drain block, overflowing bin; High: sewage overflow, contaminated drinking water, missing manhole)
3. Electricity & Power (SLA: 3 days. Low: flickering streetlight; Moderate: non-working streetlight stretch, leaning pole; High: transformer fire, exposed live wires, blackout)
4. Public Safety, Health & Environment (SLA: 3 days. Low: litter, noise; Moderate: stray animal menace, mosquito breeding, broken CCTV; High: gas leak, tree about to collapse, unsafe construction)
5. Encroachments & Civic Violations (SLA: 14 days. Low: hawker on pathway; Moderate: vendor blocking footpath, unauthorized minor construction; High: emergency access blocked, land grabbing)
6. Human Review (Fallback when triggers T1-T6 match)

Category 6 Triggers (T1-T6):
T1: Ambiguous (fits 2+ categories equally)
T2: Insufficient Information (vague description AND missing/bad photo)
T3: Novel/Unrecognized issue
T4: Conflicting/Compound report (photo and description mismatch completely)
T5: High-stakes judgment call (neighbor disputes, corruption, legal/political safety)
T6: Low confidence (< 0.5 confidence score on both)

Input State:
A: Photo + text align
B: Conflict (photo/text mismatch -> Route to Category 6 under T4, specify conflict subtype C1: category, C2: severity, C3: temporal, C4: scope mismatch)
C: Text only
D: Photo only

Return a strict JSON output matching this schema:
{
  "category": "1" | "2" | "3" | "4" | "5" | "6",
  "severity": "low" | "moderate" | "high" | "", // blank only if Category 6
  "input_state": "A" | "B" | "C" | "D",
  "trigger_reason": "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | null, // specify if category 6
  "conflict_subtype": "C1" | "C2" | "C3" | "C4" | null, // specify if input_state B
  "jurisdiction": "Maintenance & Facilities" (for 1-3) | "Security" (for 4) | "Management Committee" (for 5-6),
  "confidence_scores": {
    "category": number (0.0 to 1.0),
    "severity": number (0.0 to 1.0)
  },
  "suggested_categories": ["1", "2", ...], // if category 6, list alternative candidate categories
  "agent_notes": "1-2 sentence reason for triage decisions"
}

User text description: "${text}"
Validity flag from gate: "${validityFlag || 'none'}"`
      }
    ];

    if (photoBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: photoBase64.split(",")[1] || photoBase64,
        }
      });
    }

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      category: result.category || "6",
      severity: result.severity || "",
      input_state: result.input_state || (photoBase64 ? "A" : "C"),
      jurisdiction: result.jurisdiction || "Management Committee",
      confidence_scores: result.confidence_scores || { category: 0.9, severity: 0.8 },
      trigger_reason: result.trigger_reason || undefined,
      conflict_subtype: result.conflict_subtype || undefined,
      suggested_categories: result.suggested_categories || [],
      agent_notes: result.agent_notes || "Analyzed by Gemini.",
    };
  } catch (err) {
    console.error("Gemini Triage Agent error, falling back to local:", err);
    return runTriageAgentOffline(text, photoBase64, validityFlag);
  }
}

function runTriageAgentOffline(text: string, photoBase64?: string, validityFlag?: 'uncertain' | null) {
  const local = ruleBasedTriage(text);
  return {
    ...local,
    input_state: photoBase64 ? "A" : ("C" as any),
    agent_notes: local.agent_notes + " (Offline heuristics fallback).",
  };
}

// Compute SLA deadlines based on Category and Severity (Feature 9, Part A)
function computeSLADeadline(submittedAtStr: string, category: string, severity: string): string {
  const submittedAt = new Date(submittedAtStr);
  let baseDays = 7; // default fallback

  switch (category) {
    case "1": baseDays = 7; break; // Roads, Transport, Footpath
    case "2": baseDays = 2; break; // Water, Sanitation
    case "3": baseDays = 3; break; // Electricity
    case "4": baseDays = 3; break; // Safety, Health
    case "5": baseDays = 14; break; // Encroachments
    default: baseDays = 7; break;
  }

  let multiplier = 1.0;
  if (severity === "moderate") multiplier = 1.5;
  if (severity === "low") multiplier = 2.0;

  const totalDays = Math.round(baseDays * multiplier);
  submittedAt.setDate(submittedAt.getDate() + totalDays);
  return submittedAt.toISOString();
}

// ---- API ENDPOINTS ----

// 1. Get full state
app.get("/api/state", (req, res) => {
  res.json(getState());
});

// 2. Clear state / Reset to defaults (extremely useful for reviews!)
app.post("/api/state/reset", (req, res) => {
  const defaultState: AppState = {
    reports: DEFAULT_REPORTS,
    broadcasts: DEFAULT_BROADCASTS,
    users: DEFAULT_USERS,
    departments: DEFAULT_DEPARTMENTS,
  };
  saveState(defaultState);
  res.json({ success: true, state: defaultState });
});

// 3. Submit report (Phase 1: Validity gate + Triage + Duplicate Detection)
app.post("/api/reports/submit", async (req, res) => {
  const { user_id, text, photo, location, channel } = req.body;
  if (!user_id || !text) {
    return res.status(400).json({ error: "Missing required fields: user_id and text." });
  }

  const state = getState();
  const user = state.users.find(u => u.user_id === user_id) || DEFAULT_USERS[0];

  // A. Submission Validity Gate
  const validity = await runValidityGate(text, photo);
  if (validity.validity_band === "reject") {
    const errorMsg = channel === "whatsapp"
      ? "Sorry, that doesn't look like a civic issue. Please send a clear photo of the problem (pothole, leak, broken light, etc.) to try again."
      : "This doesn't look like a civic issue — please retake the photo or check your description, then try again.";
    return res.json({
      success: false,
      rejected: true,
      message: errorMsg,
      validity,
    });
  }

  // B. Triage Agent
  const validityFlag = validity.validity_band === "uncertain" ? "uncertain" : null;
  const triage = await runTriageAgent(text, photo, validityFlag);

  // C. Duplicate Detection (Category 1-5 open reports in same location ward radius)
  let duplicateCandidate: Report | null = null;
  if (triage.category !== "6") {
    // Look for active open tickets in the same category
    const openReports = state.reports.filter(r => r.status !== "closed" && r.category === triage.category);
    
    // Check spatial alignment (same block/wing or similar coordinate)
    for (const report of openReports) {
      const locationMatch = 
        report.location.address_text.toLowerCase().includes(user.block_or_wing.toLowerCase()) ||
        location.address_text?.toLowerCase().includes(report.location.address_text.toLowerCase()) ||
        (report.location.lat && location.lat && Math.abs(report.location.lat - location.lat) < 0.005);
        
      if (locationMatch) {
        duplicateCandidate = report;
        break;
      }
    }
  }

  // If duplicate found and not skipped/forced, return to client for choice
  if (duplicateCandidate) {
    return res.json({
      success: true,
      duplicateFound: true,
      candidate: duplicateCandidate,
      triage,
      validity,
    });
  }

  // If no duplicate, proceed to finalize creation immediately
  const newReport: Report = {
    report_id: Math.floor(1000 + Math.random() * 9000).toString(),
    user_id: user.user_id,
    user_name: user.name,
    user_phone: user.phone_number,
    channel: channel || "app",
    photos: photo ? [photo] : [],
    text,
    location: {
      lat: location.lat || null,
      lng: location.lng || null,
      accuracy_meters: location.accuracy_meters || null,
      address_text: location.address_text || user.block_or_wing + ", Green Meadows",
      source: location.source || "gps",
    },
    submitted_at: new Date().toISOString(),
    photo_captured_at: photo ? new Date().toISOString() : null,
    validity_score: validity.validity_score,
    validity_band: validity.validity_band,
    validity_flag: validityFlag,
    category: triage.category,
    severity: triage.severity,
    input_state: triage.input_state,
    jurisdiction: triage.jurisdiction,
    confidence_scores: triage.confidence_scores,
    trigger_reason: triage.trigger_reason,
    conflict_subtype: triage.conflict_subtype,
    agent_notes: triage.agent_notes,
    nearby_reports_checked: duplicateCandidate ? [duplicateCandidate.report_id] : [],
    report_count: 1,
    corroborators: [],
    severity_history: triage.severity ? [
      {
        severity: triage.severity as any,
        timestamp: new Date().toISOString(),
        source: "initial",
        confidence: triage.confidence_scores.severity,
      }
    ] : [],
    status: triage.category === "6" ? "triaged" : "triaged", // both sit at triaged initially
    status_updated_at: new Date().toISOString(),
    resolved_at: null,
    confirmation: { confirmed_by: null, confirmed_via: null, confirmed_at: "" },
    resolution_flag: null,
    closed_via: null,
  };

  state.reports.unshift(newReport);
  saveState(state);

  res.json({
    success: true,
    duplicateFound: false,
    report: newReport,
  });
});

// 4. Confirm duplicate selection (Merge OR Standalone)
app.post("/api/reports/confirm-duplicate", (req, res) => {
  const { action, text, photo, location, channel, user_id, candidate_id, triage } = req.body;
  const state = getState();
  const user = state.users.find(u => u.user_id === user_id) || DEFAULT_USERS[0];

  if (action === "merge") {
    // Find candidate report
    const rIdx = state.reports.findIndex(r => r.report_id === candidate_id);
    if (rIdx !== -1) {
      const report = state.reports[rIdx];
      report.report_count += 1;
      
      // Add corroborator if not original reporter
      if (report.user_id !== user.user_id && !report.corroborators.includes(user.user_id)) {
        report.corroborators.push(user.user_id);
      }
      
      // Attach photo if present
      if (photo && !report.photos.includes(photo)) {
        report.photos.push(photo);
      }
      
      report.status_updated_at = new Date().toISOString();
      state.reports[rIdx] = report;
      saveState(state);
      
      return res.json({
        success: true,
        merged: true,
        report,
      });
    }
  }

  // Else, standalone
  const newReport: Report = {
    report_id: Math.floor(1000 + Math.random() * 9000).toString(),
    user_id: user.user_id,
    user_name: user.name,
    user_phone: user.phone_number,
    channel: channel || "app",
    photos: photo ? [photo] : [],
    text,
    location: {
      lat: location.lat || null,
      lng: location.lng || null,
      accuracy_meters: location.accuracy_meters || null,
      address_text: location.address_text || user.block_or_wing + ", Green Meadows",
      source: location.source || "gps",
    },
    submitted_at: new Date().toISOString(),
    photo_captured_at: photo ? new Date().toISOString() : null,
    validity_score: 0.9,
    validity_band: "valid",
    validity_flag: null,
    category: triage.category,
    severity: triage.severity,
    input_state: triage.input_state,
    jurisdiction: triage.jurisdiction,
    confidence_scores: triage.confidence_scores,
    trigger_reason: triage.trigger_reason,
    conflict_subtype: triage.conflict_subtype,
    agent_notes: triage.agent_notes || "Submitted as standalone by user choice.",
    nearby_reports_checked: [candidate_id],
    report_count: 1,
    corroborators: [],
    severity_history: triage.severity ? [
      {
        severity: triage.severity,
        timestamp: new Date().toISOString(),
        source: "initial",
        confidence: triage.confidence_scores.severity,
      }
    ] : [],
    status: "triaged",
    status_updated_at: new Date().toISOString(),
    resolved_at: null,
    confirmation: { confirmed_by: null, confirmed_via: null, confirmed_at: "" },
    resolution_flag: null,
    closed_via: null,
  };

  state.reports.unshift(newReport);
  saveState(state);

  res.json({
    success: true,
    merged: false,
    report: newReport,
  });
});

// 5. Admin ticket actions (Resolve, In Progress, Reopen, Manual Category 6 Triage)
app.post("/api/reports/action", (req, res) => {
  const { report_id, action, category, severity, admin_id } = req.body;
  const state = getState();
  const rIdx = state.reports.findIndex(r => r.report_id === report_id);

  if (rIdx === -1) {
    return res.status(404).json({ error: "Report not found." });
  }

  const report = state.reports[rIdx];

  if (action === "in_progress") {
    report.status = "in_progress";
    report.status_updated_at = new Date().toISOString();
  } else if (action === "resolve") {
    report.status = "resolved";
    report.resolved_at = new Date().toISOString();
    report.status_updated_at = new Date().toISOString();
  } else if (action === "reopen") {
    report.status = "reopened";
    report.resolution_flag = null;
    report.status_updated_at = new Date().toISOString();
  } else if (action === "triage_cat6") {
    // Manual triage of Category 6 report
    report.category = category;
    report.severity = severity;
    report.jurisdiction = category === "4" ? "Security" : (category === "5" ? "Management Committee" : "Maintenance & Facilities");
    report.status = "triaged";
    report.status_updated_at = new Date().toISOString();
    report.agent_notes = `Manually triaged by admin. ${report.agent_notes || ""}`;
    report.severity_history = [
      {
        severity,
        timestamp: new Date().toISOString(),
        source: "re_triage",
        confidence: 1.0,
      }
    ];
  }

  state.reports[rIdx] = report;
  saveState(state);
  res.json({ success: true, report });
});

// 6. Citizen resolution confirmation (Yes, fixed / No, still there)
app.post("/api/reports/confirm-resolution", (req, res) => {
  const { report_id, user_id, confirmed } = req.body;
  const state = getState();
  const rIdx = state.reports.findIndex(r => r.report_id === report_id);

  if (rIdx === -1) {
    return res.status(404).json({ error: "Report not found." });
  }

  const report = state.reports[rIdx];

  if (confirmed) {
    report.status = "closed";
    report.closed_via = "user_confirmed";
    report.confirmation = {
      confirmed_by: user_id,
      confirmed_via: report.user_id === user_id ? "reporter" : "corroborator_pool",
      confirmed_at: new Date().toISOString(),
    };
    report.resolution_flag = null;
  } else {
    // Flag disputed, but status remains resolved so that admin must review
    report.resolution_flag = "disputed";
    report.disputed_by = user_id;
    report.disputed_at = new Date().toISOString();
  }

  report.status_updated_at = new Date().toISOString();
  state.reports[rIdx] = report;
  saveState(state);

  res.json({ success: true, report });
});

// 7. Worsening / Persistence flag (Feature 5, Part B)
app.post("/api/reports/persistence-flag", async (req, res) => {
  const { report_id, user_id, photo, text } = req.body;
  const state = getState();
  const rIdx = state.reports.findIndex(r => r.report_id === report_id);

  if (rIdx === -1) {
    return res.status(404).json({ error: "Report not found." });
  }

  const report = state.reports[rIdx];
  report.report_count += 1;

  if (report.user_id !== user_id && !report.corroborators.includes(user_id)) {
    report.corroborators.push(user_id);
  }

  // If user attached new evidence, re-invoke triage (Feature 5, Part B.2)
  if (photo || text) {
    const combinedText = `${report.text}\n[UPDATE FROM USER]: ${text || ""}`;
    const triage = await runTriageAgent(combinedText, photo || report.photos[0], report.validity_flag);
    
    if (triage.severity && triage.severity !== report.severity) {
      report.severity_history.push({
        severity: triage.severity as any,
        timestamp: new Date().toISOString(),
        source: "re_triage",
        confidence: triage.confidence_scores.severity,
      });
      report.severity = triage.severity as any;
    }
    if (photo && !report.photos.includes(photo)) {
      report.photos.push(photo);
    }
  }

  report.status_updated_at = new Date().toISOString();
  state.reports[rIdx] = report;
  saveState(state);

  res.json({ success: true, report });
});

// 8. Send Broadcast (Admin)
app.post("/api/broadcasts/send", (req, res) => {
  const { sent_by, category, target_wards, message_text } = req.body;
  if (!message_text || !target_wards || target_wards.length === 0) {
    return res.status(400).json({ error: "Missing broadcast content or targets." });
  }

  const state = getState();
  const newBroadcast: Broadcast = {
    broadcast_id: "b_" + Date.now(),
    sent_by: sent_by || "u_admin",
    sent_at: new Date().toISOString(),
    category,
    target_wards,
    message_text,
  };

  state.broadcasts.unshift(newBroadcast);
  saveState(state);
  res.json({ success: true, broadcast: newBroadcast });
});

// 9. Advance Time simulation (Demonstrating Feature 7 SLA and Fallbacks easily!)
app.post("/api/simulate/advance-time", (req, res) => {
  const { hours } = req.body;
  const state = getState();

  // We loop through resolved reports and apply the 48-hour fallback increments to simulation
  const hoursToMs = hours * 60 * 60 * 1000;

  state.reports.forEach(report => {
    // If the report has been submitted, but we want to simulate older creation times to test SLA
    const submittedTime = new Date(report.submitted_at).getTime();
    report.submitted_at = new Date(submittedTime - hoursToMs).toISOString();
    
    if (report.photo_captured_at) {
      report.photo_captured_at = new Date(new Date(report.photo_captured_at).getTime() - hoursToMs).toISOString();
    }

    if (report.status === "resolved" && report.resolved_at && !report.resolution_flag) {
      const resolvedAtTime = new Date(report.resolved_at).getTime();
      const currentSimulatedTime = Date.now(); // current simulated time matches current time
      const elapsedSimulatedMs = currentSimulatedTime - resolvedAtTime + hoursToMs; // include the advanced offset

      const hoursElapsed = elapsedSimulatedMs / (1000 * 60 * 60);

      if (hoursElapsed >= 144) {
        // Auto-close (Step 6 fallback)
        report.status = "closed";
        report.closed_via = "admin_timeout";
        report.confirmation = {
          confirmed_by: null,
          confirmed_via: "admin_timeout",
          confirmed_at: new Date().toISOString(),
        };
        report.status_updated_at = new Date().toISOString();
      } else if (hoursElapsed >= 96) {
        // Admin reminder triggered (Step 5 fallback)
        report.agent_notes = `[ALERT]: Resolved 96 hours ago with no response. Reminder sent to administrator. ${report.agent_notes || ""}`;
      } else if (hoursElapsed >= 48 && report.corroborators.length > 0) {
        // Corroborator pool notification triggered (Step 3 fallback)
        report.agent_notes = `[FALLBACK]: Reporter did not respond within 48h. Notified corroborator pool (${report.corroborators.join(", ")}). ${report.agent_notes || ""}`;
      }
    }
  });

  saveState(state);
  res.json({ success: true, message: `Successfully simulated advancing time by ${hours} hours!` });
});

// 10. Interactive WhatsApp Sandbox Bot Webhook (Feature 11)
app.post("/api/whatsapp/message", async (req, res) => {
  const { phone, message_text, media_url, is_location, location_coords } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Missing phone number." });
  }

  // Create or retrieve user WhatsApp session
  if (!whatsappSessions[phone]) {
    whatsappSessions[phone] = {
      step: 0,
      temporary_report: {},
      history: [],
    };
  }

  const session = whatsappSessions[phone];
  const userText = (message_text || "").trim();

  // Log user message
  session.history.push({
    sender: "user",
    text: is_location ? "📍 Location (Simulated GPS)" : (userText || (media_url ? "[Sent photo]" : "")),
    timestamp: new Date().toISOString(),
    mediaUrl: media_url || undefined,
    isLocation: is_location || undefined,
  });

  // Global Commands Check
  const upperText = userText.toUpperCase();
  if (upperText === "START") {
    session.step = 0;
    session.temporary_report = {};
    const reply = "Welcome to Green Meadows Civic Reporting Bot.\nTo report a problem (pothole, water leak, broken streetlight, etc.), please send one photo of the issue.";
    session.history.push({ sender: "bot", text: reply, timestamp: new Date().toISOString() });
    return res.json({ response: reply, session });
  } else if (upperText.startsWith("STATUS")) {
    const ticketMatch = userText.match(/#?(\d+)/);
    if (ticketMatch) {
      const tId = ticketMatch[1];
      const state = getState();
      const report = state.reports.find(r => r.report_id === tId);
      if (report) {
        const labels: Record<string, string> = {
          submitted: "Submitted — awaiting review",
          triaged: "Under review",
          in_progress: "Work in progress",
          resolved: "Marked resolved — confirm it's fixed",
          closed: "Closed",
          reopened: "Reopened",
        };
        const reply = `Ticket #${report.report_id}: ${labels[report.status]}\nDescription: ${report.text}\nLast updated: ${new Date(report.status_updated_at).toLocaleDateString()}`;
        session.history.push({ sender: "bot", text: reply, timestamp: new Date().toISOString() });
        return res.json({ response: reply, session });
      }
    }
    const reply = "Sorry, that ticket was not found or is not associated with this number.\n\nReply START to report an issue, or HELP to talk to a person.";
    session.history.push({ sender: "bot", text: reply, timestamp: new Date().toISOString() });
    return res.json({ response: reply, session });
  } else if (upperText === "HELP") {
    const reply = "Your conversation has been flagged for manual staff pickup. A Green Meadows representative will join shortly.\n\nReply START to start a new automated report at any time.";
    session.history.push({ sender: "bot", text: reply, timestamp: new Date().toISOString() });
    return res.json({ response: reply, session });
  }

  // BOT STEP STATE MACHINE
  let replyText = "";

  switch (session.step) {
    case 0:
      // Expecting a photo
      if (media_url || userText.toLowerCase().includes(".jpg") || userText.toLowerCase().includes("photo") || userText.startsWith("data:image")) {
        session.temporary_report.photos = [media_url || "/placeholder_pothole.jpg"];
        session.step = 1;
        replyText = "Got it. Now please describe the issue — you can type it, or send a voice note.\n\nIf sending a voice note, please say:\n1) What the problem is\n2) Where it is (landmark or wing name)\n3) How long it's been like this";
      } else {
        replyText = "Sorry, I didn't understand that. Please send a photo of the issue to start a report, or reply HELP for manual support.";
      }
      break;

    case 1:
      // Expecting text or voice note simulation
      if (userText) {
        session.temporary_report.text = userText;
        session.step = 2;
        replyText = "Thanks. Last step — please share your location.\n\nTap the 📎 (attach) icon → Location → Send your current location.\n\n(Or type nearest landmark/block name if GPS is unavailable)";
      } else {
        replyText = "Could you please check your description or send a clear voice note to continue?";
      }
      break;

    case 2:
      // Expecting location
      const isNativeLocation = is_location || userText.toLowerCase().includes("location") || userText.toLowerCase().includes("coordinates") || userText.includes(",");
      
      const loc: any = {
        lat: isNativeLocation ? (location_coords?.lat || 12.9715) : null,
        lng: isNativeLocation ? (location_coords?.lng || 77.5944) : null,
        accuracy_meters: isNativeLocation ? 12 : null,
        address_text: is_location ? "📍 Share current location" : (userText || "Block B, Green Meadows"),
        source: isNativeLocation ? "gps" : "address_typed",
      };

      // Submit into full pipeline
      const state = getState();
      // Locate user by phone
      let user = state.users.find(u => u.phone_number === phone);
      if (!user) {
        user = {
          user_id: "u_" + Math.random().toString(36).substring(4),
          phone_number: phone,
          name: "WhatsApp User (" + phone.substring(phone.length - 4) + ")",
          block_or_wing: "Block B",
          push_token: "",
          preferred_channel: "whatsapp",
          role: "resident",
          verified_at: new Date().toISOString(),
        };
        state.users.push(user);
      }

      // Check Validity
      const validity = await runValidityGate(session.temporary_report.text || "", session.temporary_report.photos?.[0]);
      if (validity.validity_band === "reject") {
        replyText = "Sorry, that doesn't look like a civic issue. Please send a clear photo of the problem (pothole, leak, broken light, etc.) to try again.";
        session.step = 0; // Reset back to photo request
        break;
      }

      const triage = await runTriageAgent(session.temporary_report.text || "", session.temporary_report.photos?.[0], validity.validity_band === "uncertain" ? "uncertain" : null);

      const ticketId = Math.floor(1000 + Math.random() * 9000).toString();
      const newReport: Report = {
        report_id: ticketId,
        user_id: user.user_id,
        user_name: user.name,
        user_phone: user.phone_number,
        channel: "whatsapp",
        photos: session.temporary_report.photos || [],
        text: session.temporary_report.text || "",
        location: loc,
        submitted_at: new Date().toISOString(),
        photo_captured_at: new Date().toISOString(),
        validity_score: validity.validity_score,
        validity_band: validity.validity_band,
        validity_flag: validity.validity_band === "uncertain" ? "uncertain" : null,
        category: triage.category,
        severity: triage.severity,
        input_state: triage.input_state,
        jurisdiction: triage.jurisdiction,
        confidence_scores: triage.confidence_scores,
        agent_notes: triage.agent_notes,
        nearby_reports_checked: [],
        report_count: 1,
        corroborators: [],
        severity_history: triage.severity ? [{ severity: triage.severity as any, timestamp: new Date().toISOString(), source: "initial", confidence: triage.confidence_scores.severity }] : [],
        status: "triaged",
        status_updated_at: new Date().toISOString(),
        resolved_at: null,
        confirmation: { confirmed_by: null, confirmed_via: null, confirmed_at: "" },
        resolution_flag: null,
        closed_via: null,
      };

      state.reports.unshift(newReport);
      saveState(state);

      session.step = 3;
      session.temporary_report = {};

      replyText = `Report received. Your ticket number is #${ticketId}.\n\nWe'll update you here once it's reviewed. Thank you for making Green Meadows safer!`;
      break;

    default:
      replyText = "Welcome to Green Meadows Civic Reporting.\n\nReply START to file a new complaint.\nReply STATUS #1234 to check ticket state.\nReply HELP for live assistance.";
      session.step = 0;
      break;
  }

  session.history.push({
    sender: "bot",
    text: replyText,
    timestamp: new Date().toISOString(),
  });

  res.json({ response: replyText, session });
});

// Setup Vite Dev server integration or Production Static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
