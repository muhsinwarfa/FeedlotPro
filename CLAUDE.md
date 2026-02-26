# FeedlotPro Kenya: SaaS Project Guide

## 1. Product Vision
A multi-tenant SaaS for Kenyan feedlot owners to manage livestock inventory, daily feeding operations, and weight gain performance.

## 2. Tech Stack & Environment
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, Shadcn/UI, Lucide Icons.
- **Backend/Auth:** Supabase (PostgreSQL, Auth, Storage, Realtime).
- **Architecture:** Multi-tenant (Organization-based isolation).
- **Design System:** "Emerald Industrial" (Fortune 500 aesthetic).

## 3. Core SaaS Logic (The Golden Rules)
- **Tenant Isolation:** Every data fetch/insert MUST include `organization_id` (retrieved via `auth.uid()`). NEVER generate code that queries across tenants.
- **State Machine:** Animals have strict statuses: `ACTIVE`, `SICK`, `DEAD`, `DISPATCHED`.
- **Immutability:** Once an animal is `DEAD` or `DISPATCHED`, all modifications (weight, moves, feeding) are blocked at the DB level. UI must reflect this by disabling inputs.

## 4. Design System: "Feedlot Emerald"
- **Primary:** Emerald-950 (`#064E3B`) - For headers, primary buttons, and branding.
- **Action:** Amber-500 (`#F59E0B`) - For "Add Animal," "Record Weight," and "Submit Feed."
- **Surface:** Slate-50 - Background; White cards with subtle `shadow-sm` and `border-slate-200`.
- **Typography:** Inter (Headings), Roboto Mono (Data/Weights).
- **UI Feel:** Glassmorphism on dashboard cards, high-contrast, mobile-first tap targets (min 44px).

## 5. Coding Standards
- **Components:** Functional React components with TypeScript types.
- **Data Fetching:** Use `supabase-js` client. Favor server components for initial loads, client components for real-time lists.
- **Error Handling:** Map DB exceptions to Toast notifications:
  - `BUS-001` -> "Error: Record Locked (Animal Dead/Dispatched)"
  - `DAT-003` -> "Error: Tag ID already exists in your inventory."
- **Safety:** Wrap all critical mutations in a `BEGIN...ROLLBACK` pattern for testing if requested.

## 6. CLI Commands
- **Install:** `npm install`
- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Supabase Login:** `npx supabase login`
- **Update Types:** `npx supabase gen types typescript --project-id gqfjrkkwcgagcatnrizk > types/supabase.ts`
- **Database Pull:** `npx supabase db pull`
- **Lint:** `npm run lint`

## 7. Process Map (SaaS Modules)
1. **Onboarding:** `Organizations` -> `Tenant Members` -> `Default Pens`.
2. **Inventory:** CRUD for `Animals` (validate breed/tag).
3. **Feeding:** Pen-based checklist (summing kg from `Pantry Ingredients`).
4. **Performance:** Aggregating `Weight Records` to show ADG (Average Daily Gain).

## 8. Database Ground Truth
- **Schema Reference:** `docs/schema.sql` defines the source of truth for all table structures.
- **Business Logic Reference:** `docs/triggers.sql` defines all server-side validations and state propagation.
- **CRITICAL:** Before generating any frontend mutation (Insert/Update), verify against `docs/triggers.sql` to ensure the UI handles potential database-level exceptions (e.g., mortality lockdowns) gracefully.