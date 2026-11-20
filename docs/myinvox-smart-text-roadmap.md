# MyInvox: Smart Text, Industry Templates and Assist — implementation plan

Status: design / implementation pending. No production database changes.

## Current architecture observations
- Next.js 14, Supabase Auth/Postgres, client-side dashboard in `src/app/dashboard/page.js`.
- Document editor: `DocForm`, `LineItems`; save flow: `saveDoc`.
- `companies.banking` and `documents.items` are already JSONB.
- `supabase_schema.sql` is not fully aligned with production. Inspect actual production schema before any migration.
- Existing users and documents must remain unchanged; test using a separate Supabase staging project.

## Phase 1: Smart Text
Add per-company saved text snippets, independent of invoices and products. Suggested fields: id, company_id, owner_user_id, shortcut (unique within company), title, body, category, optional default_price, created_at, updated_at. RLS must validate company ownership, including inserts and updates via WITH CHECK. Do not expose snippets across tenants.

In `DocForm`/`LineItems`, offer an accessible shortcut picker and slash-code insertion. Support explicit variables `{month}`, `{year}`, `{client}`, `{service_period}` with preview; never silently invent missing values. Allow saving selected line-item descriptions and terms/notes as snippets. Insertion is editable and never automatically overwrites an existing line.

## Phase 2: Industry presets
Add optional industry key and configurable template per company; default to current layout for existing users. Initial presets: property, trades, professional services, retail, healthcare, education. Presets suggest field labels, description snippets, and invoice sections; do not fork the invoice engine. Multiple companies under one user may select different industries.

## Phase 3: MyInvox Assist
Use a server-side endpoint (not browser-side model API keys) to turn a natural-language request into a strict JSON draft. Restrict model context to the selected company's explicitly permitted saved services/snippets. Return descriptions, quantities, proposed prices, dates and uncertainties; calculate VAT, totals, deposits and balance in application code. Require user review and explicit save. No autonomous sending or posting. Apply rate limits, consent/data minimisation and usage logging without sensitive prompt content.

## Acceptance criteria
1. A business can create, edit, search and delete a shortcut; it persists after refresh.
2. Typing `/hosting` offers only that business's saved matching text.
3. Monthly variables expand correctly while preserving an editable description.
4. User A cannot read, modify or enumerate user B's snippets through Supabase APIs.
5. Existing invoices and saved documents render identically without opt-in.
6. No AI output is saved, emailed, or used for VAT arithmetic without validation and user confirmation.
7. Test desktop and narrow mobile screens, including keyboard interaction.

## Deployment safety
- Create migration and rollback instructions after inspecting live schema; apply to staging first.
- Add automated tests for variable expansion, tenant isolation and document arithmetic.
- Keep feature behind a flag until accepted; do not merge into main or deploy without approval.
