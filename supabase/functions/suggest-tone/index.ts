import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mode, sampleText, quizId } = await req.json();

    console.log("Suggest tone request:", { mode, hasText: !!sampleText, quizId });

    let contextText = "";
    
    if (mode === "from_quizzes") {
      // Analyze existing quizzes to suggest tone
      const { data: quizzes } = await supabaseClient
        .from("quizzes")
        .select("title, description, headline, headline_highlight")
        .order("created_at", { ascending: false })
        .limit(5);

      if (!quizzes || quizzes.length === 0) {
        return new Response(JSON.stringify({ 
          error: "No existing quizzes to analyze. Create some quizzes first or provide sample text." 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const quizTexts = quizzes.map(q => {
        const title = (q.title as Record<string, string>)?.en || "";
        const desc = (q.description as Record<string, string>)?.en || "";
        const headline = (q.headline as Record<string, string>)?.en || "";
        const highlight = (q.headline_highlight as Record<string, string>)?.en || "";
        return `Title: ${title}\nDescription: ${desc}\nHeadline: ${headline} ${highlight}`;
      }).join("\n\n---\n\n");

      contextText = `Analyze these existing quiz texts to identify the tone of voice:\n\n${quizTexts}`;
    } else if (mode === "from_text" && sampleText) {
      contextText = `Analyze this sample text to extract the tone of voice guidelines:\n\n${sampleText}`;
    } else if (mode === "from_current_quiz" && quizId) {
      // Analyze the current quiz
      const { data: quiz } = await supabaseClient
        .from("quizzes")
        .select("title, description, headline, headline_highlight")
        .eq("id", quizId)
        .single();

      if (!quiz) {
        return new Response(JSON.stringify({ error: "Quiz not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const title = (quiz.title as Record<string, string>)?.en || "";
      const desc = (quiz.description as Record<string, string>)?.en || "";
      const headline = (quiz.headline as Record<string, string>)?.en || "";
      const highlight = (quiz.headline_highlight as Record<string, string>)?.en || "";
      
      contextText = `Analyze this quiz to suggest tone of voice guidelines:\n\nTitle: ${title}\nDescription: ${desc}\nHeadline: ${headline} ${highlight}`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode or missing data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `${contextText}

Based on the above, create concise tone of voice guidelines (2-4 sentences) that capture:
1. The overall mood/feeling (e.g., professional, playful, encouraging, serious)
2. The communication style (e.g., direct, friendly, formal, casual)
3. Any specific characteristics to maintain (e.g., use of humor, empathy, motivational language)

Return ONLY the tone of voice guidelines text, nothing else. Keep it actionable and specific.
Example format: "Use a warm, encouraging tone that feels like advice from a supportive mentor. Be direct but kind, using simple language. Include motivational phrases and focus on growth potential rather than limitations."`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert copywriter and brand voice consultant. Extract and describe tone of voice guidelines concisely." },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toneOfVoice = aiData.choices?.[0]?.message?.content?.trim() || "";

    if (!toneOfVoice) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Generated tone:", toneOfVoice.substring(0, 100));

    return new Response(
      JSON.stringify({ toneOfVoice }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in suggest-tone:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
