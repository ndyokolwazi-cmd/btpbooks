import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const page=readFileSync('src/app/dashboard/page.js','utf8')
const sql=readFileSync('migrations/20261120_text_snippets.sql','utf8')
for(const expected of [
  'function expandSmartText(', 'function SmartText(', 'function IndustrySuggestions(',
  'function parseDraftLines(', 'function DraftAssist(', '<DraftAssist ',
  'const editSnippet=', 'const removeSnippet='
]) assert.ok(page.includes(expected), 'Missing feature: '+expected)
for(const expected of [
  'enable row level security', 'to authenticated',
  'with check (user_id = (select auth.uid())',
  'c.user_id = (select auth.uid())', 'revoke all on public.text_snippets from anon',
  'grant select, insert, update, delete on public.text_snippets to authenticated'
]) assert.ok(sql.toLowerCase().includes(expected.toLowerCase()), 'Missing RLS protection: '+expected)
const parser=page.slice(page.indexOf('function parseDraftLines('),page.indexOf('function DraftAssist('))
assert.ok(parser.includes('split(/\\n|;/)'), 'Parser must split actual newlines')
assert.ok(parser.includes('line.match(/^\\s*'), 'Parser must use whitespace regex')
assert.ok(page.includes('replace(/\\{(month|year|client)\\}/gi'), 'Variable expansion must match braces')
console.log('Smart Text feature and migration static checks passed')
