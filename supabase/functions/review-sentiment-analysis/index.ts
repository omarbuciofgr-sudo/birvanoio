import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ReviewAnalysis {
  overall_sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentiment_score: number; // -1 to 1
  pain_points: string[];
  strengths: string[];
  outreach_hooks: string[];
  review_count: number;
  avg_rating: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const googlePlacesApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const authSupabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await authSupabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid authentication' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { lead_ids } = await req.json();
    if (!lead_ids?.length) {
      return new Response(JSON.stringify({ error: 'lead_ids required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: Array<{ lead_id: string; analysis: ReviewAnalysis | null }> = [];

    for (const leadId of lead_ids.slice(0, 10)) {
      const { data: lead } = await supabase.from('scraped_leads').select('*').eq('id', leadId).single();
      if (!lead) continue;

      const enrichmentData = (lead.enrichment_data || {}) as Record<string, unknown>;
      const googlePlaces = (lead.schema_data as any)?.google_places || {};
      let reviews: Array<{ text: string; rating: number }> = [];

      // Fetch reviews from Google Places if we have the API key and don't have cached reviews
      if (googlePlacesApiKey && !googlePlaces.reviews_analyzed) {
        const companyName = enrichmentData.company_name as string || lead.domain;
        const city = (lead.schema_data as any)?.city || enrichmentData.headquarters_city;
        const searchQuery = city ? `${companyName} ${city}` : companyName;

        try {
          const gpResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': googlePlacesApiKey,
              'X-Goog-FieldMask': 'places.reviews,places.rating,places.userRatingCount',
            },
            body: JSON.stringify({ textQuery: searchQuery, maxResultCount: 1, languageCode: 'en' }),
          });

          if (gpResponse.ok) {
            const gpData = await gpResponse.json();
            const place = gpData.places?.[0];
            if (place?.reviews) {
              reviews = place.reviews.map((r: any) => ({
                text: r.text?.text || '',
                rating: r.rating || 3,
              })).filter((r: any) => r.text.length > 10);
            }
          }
        } catch (e) { console.error('[ReviewSentiment] Google Places fetch error:', e); }
      }

      if (reviews.length === 0) {
        results.push({ lead_id: leadId, analysis: null });
        continue;
      }

      // Use AI to analyze reviews for pain points and outreach hooks
      let analysis: ReviewAnalysis | null = null;

      if (lovableApiKey && reviews.length > 0) {
        try {
          const reviewTexts = reviews.slice(0, 10).map((r, i) => `Review ${i + 1} (${r.rating}/5): ${r.text}`).join('\n\n');

          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                { role: 'system', content: 'You are a business analyst. Analyze customer reviews to identify pain points, strengths, and craft outreach hooks for sales teams. Return ONLY valid JSON.' },
                { role: 'user', content: `Analyze these ${reviews.length} reviews:\n\n${reviewTexts}\n\nReturn JSON with: overall_sentiment (positive/neutral/negative/mixed), sentiment_score (-1 to 1), pain_points (array of 2-4 specific issues), strengths (array of 2-4 things done well), outreach_hooks (array of 2-3 personalized outreach angles based on the reviews)` },
              ],
              tools: [{
                type: 'function',
                function: {
                  name: 'analyze_reviews',
                  description: 'Return structured review analysis',
                  parameters: {
                    type: 'object',
                    properties: {
                      overall_sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'mixed'] },
                      sentiment_score: { type: 'number' },
                      pain_points: { type: 'array', items: { type: 'string' } },
                      strengths: { type: 'array', items: { type: 'string' } },
                      outreach_hooks: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['overall_sentiment', 'sentiment_score', 'pain_points', 'strengths', 'outreach_hooks'],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: 'function', function: { name: 'analyze_reviews' } },
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall) {
              const parsed = JSON.parse(toolCall.function.arguments);
              const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
              analysis = { ...parsed, review_count: reviews.length, avg_rating: Math.round(avgRating * 10) / 10 };
            }
          } else if (aiResponse.status === 429 || aiResponse.status === 402) {
            console.warn('[ReviewSentiment] AI rate limited or payment required');
          }
        } catch (e) { console.error('[ReviewSentiment] AI analysis error:', e); }
      }

      // Store analysis in enrichment data
      if (analysis) {
        const updatedSchema = { ...(lead.schema_data || {}), google_places: { ...googlePlaces, reviews_analyzed: true, review_sentiment: analysis } };
        await supabase.from('scraped_leads').update({ schema_data: updatedSchema }).eq('id', leadId);
      }

      results.push({ lead_id: leadId, analysis });
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[ReviewSentiment] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
