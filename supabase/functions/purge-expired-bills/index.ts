// Edge Function: purge-expired-bills
//
// Deletes uploaded bills (Storage media first, then the database row) whose
// delete_after time has passed. Invoked every 15 minutes by pg_cron/pg_net
// (see supabase/migrations/008_uploaded_bills.sql), so it never depends on
// the mobile app being opened.
//
// Only PAID bills can ever be selected: an unpaid credit bill has
// delete_after = NULL (enforced by a CHECK constraint) and is additionally
// excluded by the payment_status filter below.
//
// Auth: deployed with --no-verify-jwt; the caller must send the shared secret
// in the `x-cron-secret` header (BILL_PURGE_SECRET).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { BUCKET, purgeExpiredBills, type PurgeStore } from './purge.ts';

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const expected = Deno.env.get('BILL_PURGE_SECRET');
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!expected || !safeEqual(provided, expected)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response('Function is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY', {
      status: 500,
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const store: PurgeStore = {
    async listDue(nowIso, limit) {
      const { data, error } = await supabase
        .from('uploaded_bills')
        .select('id, media_path')
        .eq('payment_status', 'paid')
        .not('delete_after', 'is', null)
        .lte('delete_after', nowIso)
        .order('delete_after', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    async removeMedia(paths) {
      const { error } = await supabase.storage.from(BUCKET).remove(paths);
      if (error) throw error;
    },
    async deleteRows(ids, nowIso) {
      const { error } = await supabase
        .from('uploaded_bills')
        .delete()
        .in('id', ids)
        .eq('payment_status', 'paid')
        .lte('delete_after', nowIso);
      if (error) throw error;
    },
  };

  try {
    const result = await purgeExpiredBills(store);
    console.log(JSON.stringify({ event: 'purge-expired-bills', ...result }));
    return Response.json(result, { status: result.failed.length ? 207 : 200 });
  } catch (e) {
    console.error('purge-expired-bills failed', e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
});
