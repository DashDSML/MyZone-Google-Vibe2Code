export interface User {
  user_id: string;
  phone_number: string;
  name: string;
  block_or_wing: string;
  push_token: string;
  preferred_channel: 'app' | 'whatsapp';
  role: 'resident' | 'admin';
  verified_at: string;
}

export interface LocationData {
  lat: number | null;
  lng: number | null;
  accuracy_meters: number | null;
  address_text: string;
  source: 'gps' | 'manual_pin' | 'address_typed';
}

export interface SeverityHistoryItem {
  severity: 'low' | 'moderate' | 'high';
  timestamp: string;
  source: 'initial' | 're_triage';
  confidence: number;
}

export interface ConfirmationData {
  confirmed_by: string | null;
  confirmed_via: 'reporter' | 'corroborator_pool' | 'admin_timeout' | null;
  confirmed_at: string;
}

export interface Report {
  report_id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  channel: 'app' | 'whatsapp';

  photos: string[]; // Base64 or placeholder URLs
  text: string;
  location: LocationData;
  submitted_at: string;
  photo_captured_at: string | null;

  validity_score: number;
  validity_band: 'reject' | 'uncertain' | 'valid';
  validity_flag: 'uncertain' | null;

  category: string; // "1" | "2" | "3" | "4" | "5" | "6"
  severity: 'low' | 'moderate' | 'high' | '';
  input_state: 'A' | 'B' | 'C' | 'D';
  jurisdiction: string;
  confidence_scores: {
    category: number;
    severity: number;
  };
  trigger_reason?: string; // T1-T6
  conflict_subtype?: string; // C1-C4
  agent_notes?: string;
  nearby_reports_checked: string[];

  report_count: number;
  corroborators: string[]; // user_ids
  severity_history: SeverityHistoryItem[];

  status: 'submitted' | 'triaged' | 'in_progress' | 'resolved' | 'closed' | 'reopened';
  status_updated_at: string;
  resolved_at: string | null;
  confirmation: ConfirmationData;
  resolution_flag: 'disputed' | null;
  disputed_by?: string;
  disputed_at?: string;
  closed_via: 'user_confirmed' | 'admin_timeout' | null;
}

export interface Broadcast {
  broadcast_id: string;
  sent_by: string;
  sent_at: string;
  category: 'utility' | 'safety' | 'general';
  target_wards: string[]; // e.g. ["Block A", "Block B", ...] or ["All"]
  message_text: string;
}

export interface Department {
  department_id: string;
  name: string;
  categories_handled: number[];
  members: { name: string; user_id: string }[];
}

export interface AppState {
  reports: Report[];
  broadcasts: Broadcast[];
  users: User[];
  departments: Department[];
}
