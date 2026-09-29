ALTER TABLE public.ai_usage_logs ADD COLUMN IF NOT EXISTS tools text[];
INSERT INTO private.job_tokens (name, token)
VALUES ('assistant_automations', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;