# Smart Text staging verification

Do not merge/deploy until these checks pass.

## Build and UI
- [ ] `npm ci && npm run build` completes on the feature branch.
- [ ] Create invoice and quotation; Smart Text and Industry Suggestions render.
- [ ] Save /hosting with `Monthly hosting for {month} {year}`; re-open editor and insert it.
- [ ] Verify the current month/year, and `{client}` after selecting a client.
- [ ] Edit a shortcut and reinsert; delete and verify it no longer appears.
- [ ] Verify old invoices retain their descriptions after shortcut changes.
- [ ] Switch between businesses and ensure saved phrases change appropriately.
- [ ] Test iPhone-width modal, picker, textarea and keyboard scrolling.
- [ ] Check empty snippets, duplicate shortcut, expired session, offline/error states.

## Database staging
- [ ] Apply `migrations/20261120_text_snippets.sql` to a staging Supabase project.
- [ ] Verify signed-in user A can create/read/update/delete own-company snippets.
- [ ] Verify user B cannot select, insert, update, delete, or enumerate user A's snippets.
- [ ] Verify cross-company inserts are rejected by WITH CHECK.
- [ ] Check uniqueness per company and cascade deletion behavior.
- [ ] Confirm no changes to existing documents, clients or invoice numbering.

## Known limitations
- Industry suggestions are currently a per-editor optional selector, not persisted in company settings.
- AI drafting is not implemented; no AI credentials or customer data are transmitted.
- Smart Text migration has not been applied to production.
- No build or browser test has yet been run by this PR.
