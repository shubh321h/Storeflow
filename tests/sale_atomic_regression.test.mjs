import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/003_atomic_operations.sql'),
  'utf8'
);

const hasSaleStaleSnapshotGuard = sql.includes("raise exception 'Product stock changed; retry sale'");

if (hasSaleStaleSnapshotGuard) {
  console.error('Regression test failed: create_sale_atomic still rejects stale sale snapshots.');
  process.exit(1);
}

console.log('Regression test passed: sale atomic SQL no longer enforces the stale previousQty snapshot guard.');
