import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SuggestRequest {
  title: string;
  description: string;
  language: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { title, description, language }: SuggestRequest = await req.json();
    console.log(`Suggesting headline for: "${title}" in ${language}`);

    const languageName = language === "en" ? "English" : language === "et" ? "Estonian" : language;

    const prompt = `You are a marketing copywriter. Based on the quiz title and description, create a compelling headline for a quiz landing page.

Quiz Title: ${title}
Quiz Description: ${description || "Not provided"}
Language: ${languageName}

Create a short, engaging headline (5-10 words max) that:
1. Captures the quiz's essence
2. Creates curiosity or urgency
3. Speaks directly to the target audience

Use **double asterisks** to mark the 1-3 words that should be visually highlighted (the most impactful/emotional words).

Examples of good headlines:
- "Discover your **leadership potential** today"
- "Are you a **team player** or lone wolf?"
- "Unlock your **hidden talents** in 2 minutes"
- "Find out what makes you **truly unique**"

Return ONLY the headline with **highlighted** words, nothing else.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a concise marketing copywriter. Return only the headline, no explanations." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      throw new Error("AI service unavailable");
    }

    const data = await response.json();
    const headline = data.choices?.[0]?.message?.content?.trim() || "";
    
    console.log(`Generated headline: ${headline}`);

    return new Response(JSON.stringify({ headline }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Headline suggestion error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
