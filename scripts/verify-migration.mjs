import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const sql=readFileSync('migrations/20261120_text_snippets.sql','utf8')
assert.match(sql,/create table if not exists public\.text_snippets/i)
assert.match(sql,/enable row level security/i)
assert.match(sql,/using\s*\(user_id = \(select auth\.uid\(\)\)/i)
assert.match(sql,/with check\s*\(user_id = \(select auth\.uid\(\)\)/i)
assert.match(sql,/unique \(company_id,shortcut\)/i)
console.log('Migration static validation passed')
