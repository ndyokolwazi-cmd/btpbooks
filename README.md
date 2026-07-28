# BTP Books

Full-stack business document manager built with Next.js + Supabase.

## Setup

### 1. Run the database schema
Go to Supabase → SQL Editor → paste contents of `supabase_schema.sql` → Run.

### 2. Install dependencies
```bash
npm install
```

### 3. Run locally
```bash
npm run dev
```

### 4. Deploy to Vercel
Push to GitHub, connect repo to Vercel, add environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
