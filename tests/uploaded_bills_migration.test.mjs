import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/008_uploaded_bills.sql'),
  'utf8'
);

const checks = [
  ['RLS enabled', /alter table public\.uploaded_bills enable row level security/],
  ['bucket is private', /'uploaded-bills', 'uploaded-bills', false/],
  ['credit bills are never scheduled for deletion (CHECK)', /payment_status = 'credit' and delete_after is null and paid_at is null/],
  ['paid bills always scheduled (CHECK)', /payment_status = 'paid' and delete_after is not null/],
  ['7-day window on upload', /now_ts \+ interval '7 days'/],
  ['7-day window on mark paid', /new_delete_after timestamptz := now\(\) \+ interval '7 days'/],
  ['clients have no direct write grant', /grant select on public\.uploaded_bills to authenticated/],
  ['purge is scheduled', /cron\.schedule\(\s*'purge-expired-uploaded-bills'/],
];

let failed = 0;
for (const [name, re] of checks) {
  if (!re.test(sql)) { console.error('FAIL:', name); failed++; }
}
if (/grant (insert|update|delete)[^;]*uploaded_bills/i.test(sql)) { console.error('FAIL: direct write grant found'); failed++; }
if (failed) process.exit(1);
console.log(`Static SQL checks passed (${checks.length + 1}). These do not execute the migration.`);
