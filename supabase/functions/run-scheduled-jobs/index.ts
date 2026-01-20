import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateNextRun(
  scheduleType: string,
  scheduleHour: number,
  scheduleDayOfWeek?: number,
  scheduleDayOfMonth?: number
): Date {
  const now = new Date();
  const next = new Date(now);
  
  // Set the hour
  next.setHours(scheduleHour, 0, 0, 0);
  
  switch (scheduleType) {
    case 'hourly':
      // Run every hour at minute 0
      next.setMinutes(0, 0, 0);
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
      break;
      
    case 'daily':
      // Run every day at the specified hour
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;
      
    case 'weekly':
      // Run on a specific day of the week
      if (scheduleDayOfWeek !== undefined) {
        const currentDay = next.getDay();
        let daysUntil = scheduleDayOfWeek - currentDay;
        if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
          daysUntil += 7;
        }
        next.setDate(next.getDate() + daysUntil);
      }
      break;
      
    case 'monthly':
      // Run on a specific day of the month
      if (scheduleDayOfMonth !== undefined) {
        next.setDate(scheduleDayOfMonth);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
      }
      break;
  }
  
  return next;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cronSecret = Deno.env.get('CRON_SECRET');

  // Authentication: Verify the request is authorized
  // Accept either:
  // 1. A valid CRON_SECRET header (for pg_cron triggers)
  // 2. The service role key in Authorization header (for internal Supabase calls)
  const authHeader = req.headers.get('Authorization');
  const cronSecretHeader = req.headers.get('X-Cron-Secret');

  let isAuthorized = false;

  // Check cron secret header
  if (cronSecret && cronSecretHeader === cronSecret) {
    isAuthorized = true;
    console.log('[RUN-SCHEDULED-JOBS] Authorized via CRON_SECRET');
  }

  // Check service role key in Authorization header
  if (!isAuthorized && authHeader) {
    const token = authHeader.replace('Bearer ', '');
    // Only allow service role key - not anon key
    if (token === supabaseServiceKey) {
      isAuthorized = true;
      console.log('[RUN-SCHEDULED-JOBS] Authorized via service role key');
    }
  }

  if (!isAuthorized) {
    console.warn('[RUN-SCHEDULED-JOBS] Unauthorized request attempt');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { job_id } = body; // Optional: run a specific job

    const now = new Date().toISOString();
    
    // Find jobs that are due to run
    let query = supabase
      .from('scheduled_scrape_jobs')
      .select('*')
      .eq('is_active', true)
      .or(`next_run_at.is.null,next_run_at.lte.${now}`);
    
    if (job_id) {
      query = supabase
        .from('scheduled_scrape_jobs')
        .select('*')
        .eq('id', job_id);
    }

    const { data: dueJobs, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!dueJobs || dueJobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No jobs due to run', executed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${dueJobs.length} scheduled jobs to run`);

    const results: { job_id: string; scrape_job_id: string | null; status: string }[] = [];

    for (const scheduledJob of dueJobs) {
      try {
        // Create a new scrape job based on the scheduled job config
        let targetUrls: string[] = [];
        
        if (scheduledJob.input_method === 'google_places' && scheduledJob.search_query) {
          // Would need to call Google Places search here
          // For now, use stored URLs
          targetUrls = (scheduledJob.target_urls as string[]) || [];
        } else {
          targetUrls = (scheduledJob.target_urls as string[]) || [];
        }

        if (targetUrls.length === 0) {
          results.push({ 
            job_id: scheduledJob.id, 
            scrape_job_id: null, 
            status: 'skipped_no_urls' 
          });
          continue;
        }

        // Create the scrape job
        const { data: scrapeJob, error: createError } = await supabase
          .from('scrape_jobs')
          .insert({
            name: `${scheduledJob.name} - ${new Date().toLocaleDateString()}`,
            description: `Automated run from scheduled job: ${scheduledJob.name}`,
            target_urls: targetUrls,
            total_targets: targetUrls.length,
            schema_template_id: scheduledJob.schema_template_id,
            status: 'queued',
            created_by: scheduledJob.created_by,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) throw createError;

        // Queue the job for processing
        await supabase.from('job_queue').insert({
          job_type: 'scrape',
          reference_id: scrapeJob.id,
          priority: 0,
        });

        // Trigger the job processor
        await supabase.functions.invoke('process-scrape-job', {
          body: { job_id: scrapeJob.id },
        });

        // Update scheduled job
        const nextRun = calculateNextRun(
          scheduledJob.schedule_type,
          scheduledJob.schedule_hour,
          scheduledJob.schedule_day_of_week,
          scheduledJob.schedule_day_of_month
        );

        await supabase
          .from('scheduled_scrape_jobs')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRun.toISOString(),
            last_run_job_id: scrapeJob.id,
            run_count: (scheduledJob.run_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', scheduledJob.id);

        results.push({
          job_id: scheduledJob.id,
          scrape_job_id: scrapeJob.id,
          status: 'started',
        });
      } catch (error) {
        console.error(`Error running scheduled job ${scheduledJob.id}:`, error);
        results.push({
          job_id: scheduledJob.id,
          scrape_job_id: null,
          status: 'error',
        });
      }
    }

    const executedCount = results.filter(r => r.status === 'started').length;

    return new Response(
      JSON.stringify({
        success: true,
        executed: executedCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in run-scheduled-jobs:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
