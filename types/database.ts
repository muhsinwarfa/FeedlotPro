// Hand-crafted types from docs/schema.sql
// Replace with: npx supabase gen types typescript --project-id gqfjrkkwcgagcatnrizk > types/database.ts

// ── V1 Types ──────────────────────────────────────────────────────────────────

export type AnimalStatus = 'ACTIVE' | 'SICK' | 'DEAD' | 'DISPATCHED';

export interface Organization {
  id: string;
  farm_name: string;
  // V2 additions
  target_weight: number | null;
  session_ttl_hours: number;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  id: string;
  user_id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface Pen {
  id: string;
  organization_id: string;
  pen_name: string;
  capacity: number | null;
  status: string;
  active_animal_count: number;
  // V2 additions
  is_sick_pen: boolean;
  current_fcr: number | null;
  created_at: string;
  updated_at: string;
}

export interface Animal {
  id: string;
  organization_id: string;
  pen_id: string;
  tag_id: string;
  breed: string;
  intake_weight: number;
  current_weight: number | null;
  status: AnimalStatus;
  intake_date: string;
  mortality_date: string | null;
  dispatch_date: string | null;
  // V2 additions
  gender: AnimalGender | null;
  age_category: AgeCategory | null;
  photo_url: string | null;
  batch_id: string | null;
  source_supplier: string | null;
  current_adg: number | null;
  dispatch_ready: boolean;
  dispatch_ready_date: string | null;
  sick_since: string | null;
  created_at: string;
  updated_at: string;
}

export type AnimalInsert = Omit<
  Animal,
  | 'id'
  | 'current_weight'
  | 'mortality_date'
  | 'dispatch_date'
  | 'current_adg'
  | 'dispatch_ready'
  | 'dispatch_ready_date'
  | 'sick_since'
  | 'created_at'
  | 'updated_at'
>;

export interface WeightRecord {
  id: string;
  animal_id: string;
  new_weight: number;
  weigh_date: string;
  created_at: string;
  updated_at: string;
}

export interface FeedingRecord {
  id: string;
  organization_id: string;
  pen_id: string;
  feeding_timestamp: string;
  total_kg_fed: number;
  // V2 Block 3: auto-computed by trg_feeding_cost_on_detail_insert
  total_cost: number;
  created_at: string;
  updated_at: string;
}

export interface FeedingDetail {
  id: string;
  feeding_record_id: string;
  ingredient_id: string;
  kg_amount: number;
  // V2 Block 3: price snapshot at time of feeding (frozen, not affected by future price changes)
  unit_cost_per_kg: number | null;
  created_at: string;
  updated_at: string;
}

export interface PantryIngredient {
  id: string;
  organization_id: string;
  ingredient_name: string;
  unit: string;
  // V2 additions
  current_price_per_kg: number | null;
  current_stock: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

// ── V2 Types ──────────────────────────────────────────────────────────────────

export type WorkerRole = 'OWNER' | 'MANAGER' | 'FARMHAND' | 'VET';
export type MemberStatus = 'ACTIVE' | 'LOCKED';
export type AnimalGender = 'BULL' | 'HEIFER' | 'STEER' | 'COW';
export type AgeCategory = 'CALF' | 'WEANER' | 'GROWER' | 'FINISHER';

/** Extended tenant_member with V2 RBAC and PIN fields */
export interface TenantMemberV2 extends TenantMember {
  role: WorkerRole;
  display_name: string;
  avatar_color: string;
  pin_hash: string | null;
  pin_attempts: number;
  status: MemberStatus;
}

/** Batch — cohort grouping for animals arriving together */
export interface Batch {
  id: string;
  organization_id: string;
  batch_code: string;
  source_supplier: string | null;
  arrival_date: string; // DATE string: YYYY-MM-DD
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type BatchInsert = Omit<Batch, 'id' | 'created_at' | 'updated_at'>;

/** Worker kiosk session record */
export interface Session {
  id: string;
  organization_id: string;
  member_id: string;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  created_at: string;
}

export type SessionInsert = Omit<Session, 'id' | 'created_at'>;

// ── V2 Block 2 Types ──────────────────────────────────────────────────────────

export type EventType =
  | 'FLAGGED_SICK'
  | 'TREATMENT_ADMINISTERED'
  | 'RECOVERED'
  | 'FOLLOW_UP_SCHEDULED'
  | 'MORTALITY'
  | 'DISPATCHED_EARLY';

export type Severity = 'MILD' | 'MODERATE' | 'SEVERE';

export type AdminRoute =
  | 'ORAL'
  | 'INJECTION_IM'
  | 'INJECTION_IV'
  | 'INJECTION_SC'
  | 'TOPICAL'
  | 'DRENCH';

/** Health event record — tracks every health-related lifecycle event */
export interface HealthEvent {
  id: string;
  animal_id: string;
  organization_id: string;
  event_type: EventType;
  primary_symptom: string | null;
  secondary_symptoms: string[];
  severity: Severity | null;
  notes: string | null;
  photo_url: string | null;
  performed_by: string | null;
  created_at: string;
}

export type HealthEventInsert = Omit<HealthEvent, 'id' | 'created_at'>;

/** Treatment record — medication administered to a sick animal */
export interface TreatmentRecord {
  id: string;
  animal_id: string;
  organization_id: string;
  medication_name: string;
  dosage: string;
  administration_route: AdminRoute;
  treatment_cost: number | null;
  notes: string | null;
  follow_up_date: string | null; // DATE string: YYYY-MM-DD
  treated_by: string | null;
  treated_at: string;
  created_at: string;
}

export type TreatmentRecordInsert = Omit<TreatmentRecord, 'id' | 'created_at'>;

/** Sync conflict — server-side record when offline queue item conflicts */
export interface SyncConflict {
  id: string;
  table_name: string;
  record_id: string;
  local_payload: Record<string, unknown>;
  server_payload: Record<string, unknown> | null;
  error_message: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

// ── V2 Block 3 Types ──────────────────────────────────────────────────────────

export type StockTransactionType = 'PURCHASE' | 'CONSUMPTION' | 'ADJUSTMENT';

/** Price history — immutable audit log of every price change per ingredient */
export interface PriceHistory {
  id: string;
  organization_id: string;
  ingredient_id: string;
  old_price: number | null;
  new_price: number;
  changed_by: string | null;
  changed_at: string;
}

export type PriceHistoryInsert = Omit<PriceHistory, 'id' | 'changed_at'>;

/** Stock transaction — ledger entry for every feed stock movement */
export interface StockTransaction {
  id: string;
  organization_id: string;
  ingredient_id: string;
  transaction_type: StockTransactionType;
  quantity_kg: number;
  unit_cost_per_kg: number | null;
  total_cost: number | null;
  notes: string | null;
  feeding_detail_id: string | null;
  performed_by: string | null;
  transacted_at: string;
  created_at: string;
}

export type StockTransactionInsert = Omit<StockTransaction, 'id' | 'created_at'>;

/** Ration template — a named feed formula saved by manager/owner */
export interface RationTemplate {
  id: string;
  organization_id: string;
  ration_name: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RationTemplateInsert = Omit<RationTemplate, 'id' | 'created_at' | 'updated_at'>;

/** Ration ingredient — a single ingredient line item within a ration template */
export interface RationIngredient {
  id: string;
  ration_template_id: string;
  ingredient_id: string;
  kg_per_animal_per_day: number;
  created_at: string;
}

export type RationIngredientInsert = Omit<RationIngredient, 'id' | 'created_at'>;

// ─── Supabase Database shape ────────────────────────────────────────────────
// Structured to match the GenericSchema required by @supabase/supabase-js v2.
// Replace with the generated version once Supabase CLI is linked:
//   npx supabase gen types typescript --project-id gqfjrkkwcgagcatnrizk > types/database.ts

type TableDef<Row, Ins, Upd> = {
  Row: Row;
  Insert: Ins;
  Update: Upd;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      organizations: TableDef<
        Organization,
        Omit<Organization, 'id' | 'created_at' | 'updated_at'>,
        Partial<Organization>
      >;
      tenant_members: TableDef<
        TenantMemberV2,
        Omit<TenantMemberV2, 'id' | 'created_at' | 'updated_at'>,
        Partial<TenantMemberV2>
      >;
      pens: TableDef<
        Pen,
        Omit<Pen, 'id' | 'active_animal_count' | 'created_at' | 'updated_at'>,
        Partial<Pen>
      >;
      animals: TableDef<Animal, AnimalInsert, Partial<Animal>>;
      weight_records: TableDef<
        WeightRecord,
        Omit<WeightRecord, 'id' | 'created_at' | 'updated_at'>,
        Partial<WeightRecord>
      >;
      feeding_records: TableDef<
        FeedingRecord,
        Omit<FeedingRecord, 'id' | 'created_at' | 'updated_at'>,
        Partial<FeedingRecord>
      >;
      feeding_details: TableDef<
        FeedingDetail,
        Omit<FeedingDetail, 'id' | 'created_at' | 'updated_at'>,
        Partial<FeedingDetail>
      >;
      pantry_ingredients: TableDef<
        PantryIngredient,
        Omit<PantryIngredient, 'id' | 'created_at' | 'updated_at'>,
        Partial<PantryIngredient>
      >;
      batches: TableDef<Batch, BatchInsert, Partial<Batch>>;
      sessions: TableDef<Session, SessionInsert, Partial<Session>>;
      health_events: TableDef<HealthEvent, HealthEventInsert, Partial<HealthEvent>>;
      treatment_records: TableDef<TreatmentRecord, TreatmentRecordInsert, Partial<TreatmentRecord>>;
      sync_conflicts: TableDef<
        SyncConflict,
        Omit<SyncConflict, 'id' | 'created_at'>,
        Partial<SyncConflict>
      >;
      audit_logs: TableDef<AuditLog, Record<string, never>, Record<string, never>>;
      // ── V2 Block 3 tables ──
      price_history: TableDef<PriceHistory, PriceHistoryInsert, Partial<PriceHistory>>;
      stock_transactions: TableDef<
        StockTransaction,
        StockTransactionInsert,
        Partial<StockTransaction>
      >;
      ration_templates: TableDef<
        RationTemplate,
        RationTemplateInsert,
        Partial<RationTemplate>
      >;
      ration_ingredients: TableDef<
        RationIngredient,
        RationIngredientInsert,
        Partial<RationIngredient>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, string[]>;
    CompositeTypes: Record<string, Record<string, unknown>>;
  };
}
