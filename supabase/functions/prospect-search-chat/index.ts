import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are Brivano's prospect search assistant. Your job is to guide users in finding the right companies using our search filters AND auto-apply filter suggestions when confident.

When a user describes what they're looking for:
1. Use the apply_filters tool to set the recommended filters automatically
2. Also explain your reasoning briefly (1-2 sentences)

Available filter values:
- Industries (use exact values): software_development, saas, information_technology, cybersecurity, cloud_computing, artificial_intelligence, data_analytics, fintech, edtech, healthtech, proptech, ecommerce, blockchain, gaming, telecommunications, internet_services, hardware, semiconductors, robotics, iot, banking, financial_services, insurance, investment_management, venture_capital, accounting, wealth_management, mortgage, credit_unions, payments, healthcare, hospitals, medical_devices, pharmaceuticals, biotechnology, dental, mental_health, veterinary, home_health, clinical_research, medical_practice, chiropractic, optometry, physical_therapy, real_estate, commercial_real_estate, property_management, construction, residential_construction, commercial_construction, architecture, civil_engineering, roofing, hvac, plumbing, electrical, landscaping, painting, flooring, home_improvement, solar, general_contracting, demolition, interior_design, legal, consulting, marketing_advertising, public_relations, staffing_recruiting, human_resources, business_consulting, it_consulting, graphic_design, web_design, seo, translation, photography, videography, event_planning, printing, security_services, janitorial, pest_control, moving_storage, manufacturing, automotive, aerospace, chemicals, plastics, metals, food_manufacturing, textiles, electronics_manufacturing, packaging, machinery, paper, glass, furniture_manufacturing, retail, wholesale, consumer_goods, luxury_goods, fashion, cosmetics, sporting_goods, pet_industry, wine_spirits, grocery, convenience_stores, auto_dealerships, restaurants, fast_food, bars_nightclubs, catering, food_trucks, bakeries, hotels, hospitality, travel_tourism, airlines, education, higher_education, k12, elearning, tutoring, vocational_training, childcare, driving_schools, oil_gas, renewable_energy, utilities, environmental_services, waste_management, water_treatment, transportation, trucking, shipping, logistics, warehousing, courier, railroads, towing, auto_repair, car_wash, media, publishing, music, film_production, animation, news, podcasting, advertising_tech, government, nonprofit, religious, political, military, philanthropy, agriculture, farming, dairy, fisheries, forestry, cannabis, gyms, yoga_pilates, spas, personal_training, martial_arts, sports_leagues, funeral_services, laundry, storage, vending, locksmith, staffing_agencies, coworking, franchise
- Company sizes: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+
- Revenue ranges: 0-1M, 1M-5M, 5M-10M, 10M-50M, 50M-100M, 100M-500M, 500M-1B, 1B+
- Countries (ISO codes): US, CA, GB, AU, DE, FR, NL, SE, NO, DK, FI, IE, ES, IT, PT, CH, AT, BE, PL, CZ, IN, JP, KR, SG, HK, NZ, IL, AE, SA, BR, MX, CO, AR, CL, ZA, NG, KE, EG, PH, TH, VN, ID, MY, TW, RO, UA, TR, RU, CN
- US States: Alabama, Alaska, Arizona, Arkansas, California, Colorado, Connecticut, Delaware, Florida, Georgia, Hawaii, Idaho, Illinois, Indiana, Iowa, Kansas, Kentucky, Louisiana, Maine, Maryland, Massachusetts, Michigan, Minnesota, Mississippi, Missouri, Montana, Nebraska, Nevada, New Hampshire, New Jersey, New Mexico, New York, North Carolina, North Dakota, Ohio, Oklahoma, Oregon, Pennsylvania, Rhode Island, South Carolina, South Dakota, Tennessee, Texas, Utah, Vermont, Virginia, Washington, West Virginia, Wisconsin, Wyoming

ALWAYS call apply_filters when you have enough information. Be concise in your text response.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "apply_filters",
          description: "Auto-apply search filters based on the user's request. Only include fields you want to change.",
          parameters: {
            type: "object",
            properties: {
              industries: {
                type: "array",
                items: { type: "string" },
                description: "Industry values to include"
              },
              companySizes: {
                type: "array",
                items: { type: "string" },
                description: "Company size ranges"
              },
              annualRevenue: {
                type: "string",
                description: "Revenue range value"
              },
              countries: {
                type: "array",
                items: { type: "string" },
                description: "Country ISO codes"
              },
              citiesOrStates: {
                type: "array",
                items: { type: "string" },
                description: "US state names or city names"
              },
              keywordsInclude: {
                type: "array",
                items: { type: "string" },
                description: "Keywords to include in description search"
              },
              limit: {
                type: "number",
                description: "Number of results to return"
              }
            },
            additionalProperties: false
          }
        }
      }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        stream: false,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    
    let textContent = choice?.message?.content || "";
    let filterSuggestion = null;

    // Check for tool calls
    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        if (tc.function?.name === "apply_filters") {
          try {
            filterSuggestion = JSON.parse(tc.function.arguments);
          } catch (e) {
            console.error("Failed to parse filter suggestion:", e);
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      content: textContent, 
      filters: filterSuggestion 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("prospect-search-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
