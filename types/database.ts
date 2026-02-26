// Hand-crafted types from docs/schema.sql
// Replace with: npx supabase gen types typescript --project-id gqfjrkkwcgagcatnrizk > types/database.ts

export type AnimalStatus = 'ACTIVE' | 'SICK' | 'DEAD' | 'DISPATCHED';

export interface Organization {
  id: string;
  farm_name: string;
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
  created_at: string;
  updated_at: string;
}

export type AnimalInsert = Omit<
  Animal,
  'id' | 'current_weight' | 'mortality_date' | 'dispatch_date' | 'created_at' | 'updated_at'
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
  created_at: string;
  updated_at: string;
}

export interface FeedingDetail {
  id: string;
  feeding_record_id: string;
  ingredient_id: string;
  kg_amount: number;
  created_at: string;
  updated_at: string;
}

export interface PantryIngredient {
  id: string;
  organization_id: string;
  ingredient_name: string;
  unit: string;
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
        TenantMember,
        Omit<TenantMember, 'id' | 'created_at' | 'updated_at'>,
        Partial<TenantMember>
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
      audit_logs: TableDef<AuditLog, Record<string, never>, Record<string, never>>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, string[]>;
    CompositeTypes: Record<string, Record<string, unknown>>;
  };
}
