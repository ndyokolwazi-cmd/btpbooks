# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Invoxa** (product name; repo/package name is `btpbooks`) — a Next.js 14 (App Router) + Supabase invoicing app for South African businesses. Users manage companies, clients, and business documents (Tax Invoices, Quotations, Delivery Notes, Credit Notes, Receipts), with per-company branding, VAT handling, and a subscription/trial gate. No backend server code — Supabase (Postgres + Auth + RLS) is the only backend, accessed directly from client components.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run start    # run production build
```

There is no lint script, test runner, or CI config in this repo — don't assume `npm test`/`npm run lint` exist.

### Database setup
Schema lives in `supabase_schema.sql`, applied manually via the Supabase SQL Editor (no migration tool). **This file is not fully in sync with production** — at least one Postgres function (`next_document_number`, used for atomic per-company/per-type document numbering, called via `supabase.rpc(...)`) and one column (`companies.accent_color`) exist in production but are not in this file. When changing numbering or company schema, check actual DB state rather than trusting this file alone, and update it when you add real migrations.

### Environment
Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`.env.local` for dev; set in Vercel for prod — see `.env.production` for the shape, values redacted/placeholder there).

## Architecture

Three routes, each a single self-contained `'use client'` page component with inline `<style>` injected via `useEffect` (no CSS modules/Tailwind/styled-components):

- `src/app/page.js` — public landing page + login/signup modal (Supabase email/password auth).
- `src/app/dashboard/page.js` — the entire authenticated app (~2000 lines). This is where almost all product logic lives.
- `src/app/admin/page.js` — subscription/admin panel, gated by a hardcoded email (`ADMIN_EMAIL = 'lwazi@betheproject.co.za'`), for viewing/editing user subscriptions in the `subscriptions` table.

### Dashboard structure (`src/app/dashboard/page.js`)
Single `Dashboard` component holds all state (companies, clients, docs, activeCoId, subscription, page) and passes it down to sibling view components defined in the same file: `Sidebar`, `DashboardView`, `Documents`, `Clients`, `Companies`, `DocForm`, `DocPrint`, `LineItems`, plus small primitives (`Btn`, `Inp`, `Sel`, `Modal`, `Toast`, `Badge`). There's no router-based sub-navigation — `page` state switches which view renders inside the same route.

Key domain constants at the top of the file:
- `DOC_TYPES` / `DT` — the five document types, each with a `key`, `label`, number `prefix` (e.g. `INV`, `QUO`), and accent color.
- `DST` — allowed status transitions per document type (invoices go Draft→Sent→Paid/Overdue/Cancelled, quotes go Draft→Sent→Accepted/Cancelled, etc.).
- `checkAccess(sub)` — pure function computing trial/active/expired state from a `subscriptions` row; drives whether the dashboard is usable or shows a paywall.

Auth: `Dashboard`'s session effect tracks `currentUserId` manually inside `onAuthStateChange` so that `TOKEN_REFRESHED`/`INITIAL_SESSION`/`USER_UPDATED` events (fired on tab focus) only update `user` in place rather than re-running `loadAll` and reloading all data — only a genuine user change (or `SIGNED_OUT`) triggers a reload/redirect. Preserve this distinction when touching auth logic; collapsing it back to "any event without a session → redirect, any event with one → reload" reintroduces a bug where switching tabs refetches everything.

Document numbering: on save, if a doc has no `number` yet, the client calls `supabase.rpc('next_document_number', {p_company, p_type})` to get an atomic sequence from the database rather than reading/incrementing `companies.next_nos` client-side (avoids race conditions across concurrent saves). `companies.next_nos` (jsonb) is legacy/seed state for the counters, not the live source of truth for issuing numbers.

Money/VAT: `calcTotals(items, vatRegistered)` computes subtotal/VAT/total per document, applying per-line discount and VAT rate; non-VAT-registered companies show clean VAT-inclusive totals with no VAT line. `fmtMoney`/`fmtDate` are the shared display formatters (South African locale, comma-separated thousands).

Printing: `DocPrint` renders the document for on-screen preview and printing via the browser print dialog (`window.print()`), sharing via WhatsApp/email links generated from the same data. Print layout is controlled by a `@media print` block in the injected `CSS` string (`@page` margin, hiding `.no-print`/`.sidebar`/`.modal-bg`, forcing `.print-doc` to fill the page) — when adjusting print output, edit that block rather than adding separate print-only components.

### Data model (Supabase/Postgres, `supabase_schema.sql`)
- `companies` — one row per business a user manages; holds branding (`logo`, `currency_symbol`, `accent_color`), `banking` (jsonb array of accounts), `next_nos` (jsonb, legacy seed counters — see above).
- `clients` — a user's customers, referenced by `documents.client_id` (nullable — deleting a client doesn't delete their documents).
- `documents` — polymorphic table for all five document types (`type` column), with `items`/`totals` as jsonb, `linked_to` for quote→invoice conversion lineage.
- `subscriptions` — one row per user; `status` (`trial`/`active`/...), `trial_ends_at`, `subscription_ends_at`. Read by both the dashboard (`checkAccess`) and the admin panel.
- RLS is enabled on all three main tables with a uniform `auth.uid() = user_id` policy — every query already scopes to the logged-in user, but always filter by `user_id`/`eq(...)` explicitly in new queries rather than relying on RLS alone for correctness of app logic (RLS is the security backstop, not the app's filtering mechanism).

## Stale files — do not treat as source of truth

`admin_page.js` and `dashboard_page.js` at the repo root are older, out-of-sync copies of `src/app/admin/page.js` and `src/app/dashboard/page.js` (not imported anywhere, not part of the Next.js build — the App Router only picks up files under `src/app/`). `files.zip` is a historical bundle (an old update zip and a one-line `accent_color` migration snippet). Read/edit the `src/app/**` files; don't use the root copies as reference, and don't add new code to them.
