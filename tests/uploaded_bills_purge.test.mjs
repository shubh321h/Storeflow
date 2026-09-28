// Unit test for the purge logic (supabase/functions/purge-expired-bills/purge.ts).
// Uses an in-memory fake store; it does NOT talk to Supabase.
// Run: node tests/uploaded_bills_purge.test.mjs   (Node 22+)
import assert from 'node:assert/strict';
import { purgeExpiredBills } from '../supabase/functions/purge-expired-bills/purge.ts';

function fakeStore({ rows, failMedia = new Set(), failRowDelete = new Set() }) {
  const files = new Set(rows.map(r => r.media_path));
  const db = new Map(rows.map(r => [r.id, { ...r }]));
  return {
    files, db,
    async listDue(nowIso, limit) {
      // mirrors the real query: paid AND delete_after <= now
      return [...db.values()]
        .filter(r => r.payment_status === 'paid' && r.delete_after && r.delete_after <= nowIso)
        .slice(0, limit).map(r => ({ id: r.id, media_path: r.media_path }));
    },
    async removeMedia(paths) {
      if (paths.some(p => failMedia.has(p))) throw new Error('storage error');
      paths.forEach(p => files.delete(p));
    },
    async deleteRows(ids, nowIso) {
      if (ids.some(i => failRowDelete.has(i))) throw new Error('db error');
      ids.forEach(i => {
        const r = db.get(i);
        if (r && r.payment_status === 'paid' && r.delete_after <= nowIso) db.delete(i);
      });
    },
  };
}

const now = new Date('2026-10-10T12:00:00Z');
const past = '2026-10-10T11:00:00.000Z';
const future = '2026-10-15T00:00:00.000Z';
const row = (id, over = {}) => ({ id, media_path: `biz/${id}.jpg`, payment_status: 'paid', delete_after: past, ...over });

// 1. deletes due paid bills (file + row); keeps not-yet-due and unpaid credit
{
  const s = fakeStore({ rows: [
    row('paid-due'),
    row('paid-later', { delete_after: future }),
    row('credit-unpaid', { payment_status: 'credit', delete_after: null }),
    row('credit-bad-state', { payment_status: 'credit', delete_after: past }), // must still be protected
  ]});
  const r = await purgeExpiredBills(s, now);
  assert.equal(r.found, 1); assert.equal(r.deleted, 1); assert.deepEqual(r.failed, []);
  assert.deepEqual([...s.db.keys()].sort(), ['credit-bad-state', 'credit-unpaid', 'paid-later']);
  assert.ok(!s.files.has('biz/paid-due.jpg'));
  assert.ok(s.files.has('biz/credit-unpaid.jpg') && s.files.has('biz/credit-bad-state.jpg'));
}
// 2. storage failure keeps the row (so it is retried) and does not block others
{
  const s = fakeStore({ rows: [row('a'), row('b'), row('c')], failMedia: new Set(['biz/b.jpg']) });
  const r = await purgeExpiredBills(s, now);
  assert.equal(r.deleted, 2); assert.equal(r.failed.length, 1); assert.equal(r.failed[0].id, 'b');
  assert.ok(s.db.has('b') && s.files.has('biz/b.jpg'), 'failed row and its file are kept for retry');
  assert.ok(!s.db.has('a') && !s.db.has('c'));
}
// 3. row-delete failure after file removed is recoverable on the next run
{
  const failRowDelete = new Set(['x']);
  const s = fakeStore({ rows: [row('x')], failRowDelete });
  let r = await purgeExpiredBills(s, now);
  assert.equal(r.deleted, 0); assert.equal(r.failed.length, 1); assert.ok(s.db.has('x'));
  failRowDelete.clear();
  r = await purgeExpiredBills(s, now);
  assert.equal(r.deleted, 1); assert.ok(!s.db.has('x'));
}
// 4. nothing due => no-op
{
  const s = fakeStore({ rows: [row('later', { delete_after: future })] });
  const r = await purgeExpiredBills(s, now);
  assert.deepEqual(r, { found: 0, deleted: 0, failed: [] });
}
// 5. more than one batch
{
  const rows = Array.from({ length: 250 }, (_, i) => row(`r${i}`));
  const s = fakeStore({ rows });
  const r = await purgeExpiredBills(s, now);
  assert.equal(r.deleted, 250); assert.equal(s.db.size, 0); assert.equal(s.files.size, 0);
}
console.log('Purge tests passed (5 scenarios, fake store).');
