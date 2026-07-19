-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

-- Unschedule first if it already exists to prevent duplicate schedules
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'skool-feed-sync-cron') THEN
    PERFORM cron.unschedule('skool-feed-sync-cron');
  END IF;
END $$;

-- Schedule the skool-feed-sync edge function to run every 15 minutes
SELECT cron.schedule(
  'skool-feed-sync-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/skool-feed-sync',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
