## Deploy `google-jobs-search` edge function

**Context:** Edge functions in this project deploy automatically — no manual deploy step is required from you. Pushing any change to `supabase/functions/google-jobs-search/index.ts` triggers redeploy.

### Options

1. **Force a redeploy** — I run `supabase--deploy_edge_functions` against `google-jobs-search` once you approve. No code change needed. Use this if the function is misbehaving or you suspect the latest version isn't live.

2. **Verify it's already deployed** — I call `supabase--edge_function_logs` and/or `supabase--curl_edge_functions` to confirm the current version responds correctly. Use this if you just want assurance.

3. **Both** — redeploy, then smoke-test with a curl and check logs.

### What I'll do once approved (option 3, recommended)

1. Read the current `google-jobs-search/index.ts` to identify a safe test payload.
2. `supabase--deploy_edge_functions` → `["google-jobs-search"]`.
3. `supabase--curl_edge_functions` with a minimal valid body to confirm 200 / expected shape.
4. `supabase--edge_function_logs` to confirm no runtime errors.
5. Report back: deploy status, response sample, any log warnings.

No source files will be modified.