// Core logic for the uploaded-bill purge. Kept free of Deno / supabase-js
// imports so it can be unit tested in plain Node (tests/uploaded_bills_purge.test.mjs).

export const BUCKET = 'uploaded-bills';
export const BATCH_SIZE = 100;
export const MAX_ROWS_PER_RUN = 500;

export interface DueBill {
  id: string;
  media_path: string;
}

export interface PurgeStore {
  /** PAID bills whose delete_after has passed. Must never return unpaid credit bills. */
  listDue(nowIso: string, limit: number): Promise<DueBill[]>;
  /** Removes files through the Storage API. Must throw on failure. Missing files are not an error. */
  removeMedia(paths: string[]): Promise<void>;
  /** Deletes bill rows (still restricted to paid + due). Must throw on failure. */
  deleteRows(ids: string[], nowIso: string): Promise<void>;
}

export interface PurgeResult {
  found: number;
  deleted: number;
  failed: { id: string; error: string }[];
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Order matters: the Storage object is removed FIRST and the database row
 * SECOND. If the Storage call fails the row is kept, so the next run retries
 * it (no orphaned private file with no record pointing at it). If the row
 * delete fails after the file is gone, the next run removes the already-missing
 * file again (a no-op) and then deletes the row.
 */
export async function purgeExpiredBills(
  store: PurgeStore,
  now: Date = new Date()
): Promise<PurgeResult> {
  const nowIso = now.toISOString();
  const due = await store.listDue(nowIso, MAX_ROWS_PER_RUN);
  const result: PurgeResult = { found: due.length, deleted: 0, failed: [] };

  for (const batch of chunk(due, BATCH_SIZE)) {
    try {
      await store.removeMedia(batch.map(b => b.media_path));
      await store.deleteRows(batch.map(b => b.id), nowIso);
      result.deleted += batch.length;
    } catch {
      // One bad row must not block the others: retry the batch row by row.
      for (const bill of batch) {
        try {
          await store.removeMedia([bill.media_path]);
          await store.deleteRows([bill.id], nowIso);
          result.deleted += 1;
        } catch (e) {
          result.failed.push({ id: bill.id, error: message(e) });
        }
      }
    }
  }

  return result;
}
