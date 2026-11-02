# MyInvox

South African invoicing and business document manager built with Next.js and Supabase.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Supabase

Create `.env.local` with:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

`supabase_schema.sql` is historical and is not the deployment source of truth. New database changes live in `supabase/migrations` and must be tested in an isolated database before production.

### 3. Run locally
```bash
npm run dev
```

### 4. Verify

```bash
npm run build
npm audit --omit=dev
```

### 5. Deploy

Push a reviewed branch to GitHub, apply its migrations to a non-production Supabase environment, then merge and deploy through Vercel.
