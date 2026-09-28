# purge-expired-bills

Deletes expired uploaded bills (Storage file first, then the DB row).
Scheduled every 15 minutes by `pg_cron` (see `008_uploaded_bills.sql`).

## One-time setup

```bash
# 1. Pick a random secret and store it as an Edge Function secret
supabase secrets set BILL_PURGE_SECRET=<random-string>

# 2. Deploy without JWT verification (auth is the shared secret header)
supabase functions deploy purge-expired-bills --no-verify-jwt
```

Then, in the Supabase SQL editor, store the same secret + project URL in Vault
(so nothing secret lives in a migration):

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<the same random string>', 'bill_purge_secret');
```

## Check it

```sql
select * from cron.job where jobname = 'purge-expired-uploaded-bills';
select * from cron.job_run_details order by start_time desc limit 5;
select * from net._http_response order by created desc limit 5;
```
