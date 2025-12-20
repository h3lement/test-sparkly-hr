import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerationParams {
  quizId: string;
  numberOfLevels: number;
  toneOfVoice: string;
  higherScoreMeaning: "positive" | "negative";
  language: string;
  model?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const params: GenerationParams = await req.json();
    const { quizId, numberOfLevels, toneOfVoice, higherScoreMeaning, language, model } = params;

    console.log("Generating open-mindedness results for quiz:", quizId);
    console.log("Parameters:", { numberOfLevels, toneOfVoice, higherScoreMeaning, language });

    // Fetch quiz data
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      throw new Error("Quiz not found");
    }

    // Fetch open-mindedness question with answers
    const { data: omQuestion, error: omError } = await supabase
      .from("quiz_questions")
      .select(`
        *,
        quiz_answers (*)
      `)
      .eq("quiz_id", quizId)
      .eq("question_type", "open_mindedness")
      .single();

    if (omError || !omQuestion) {
      throw new Error("Open-mindedness question not found");
    }

    // Get localized values
    const getLocalizedValue = (obj: any, lang: string): string => {
      if (typeof obj === "string") return obj;
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        return obj[lang] || obj["en"] || "";
      }
      return "";
    };

    const quizTitle = getLocalizedValue(quiz.title, language);
    const questionText = getLocalizedValue(omQuestion.question_text, language);
    const maxScore = omQuestion.quiz_answers?.length || 0;

    // Build answer options
    const answerOptions = (omQuestion.quiz_answers || [])
      .sort((a: any, b: any) => a.answer_order - b.answer_order)
      .map((a: any) => `- ${getLocalizedValue(a.answer_text, language)} (${a.score_value} points)`)
      .join("\n");

    // Build the prompt
    const prompt = `You are an expert at creating meaningful quiz result descriptions. Generate ${numberOfLevels} result levels for an Open-Mindedness assessment module.

QUIZ CONTEXT:
- Quiz Title: ${quizTitle}
- Open-Mindedness Question: ${questionText}
- Answer Options (multi-select, users can select multiple):
${answerOptions}
- Maximum possible score: ${maxScore} points
- Higher scores mean: ${higherScoreMeaning === "positive" ? "More open-minded" : "Less open-minded"}
- Tone of voice: ${toneOfVoice}
- Target audience: ${quiz.icp_description || "General professionals"}
${quiz.tone_of_voice && quiz.use_tone_for_ai ? `- Brand voice guidelines: ${quiz.tone_of_voice}` : ""}

REQUIREMENTS:
1. Create exactly ${numberOfLevels} result levels with NON-OVERLAPPING score ranges covering 0 to ${maxScore}
2. Each level needs: title, description (2-3 sentences), and an appropriate emoji
3. ${higherScoreMeaning === "positive" ? "Higher score levels should be more positive/encouraging" : "Lower score levels should be more positive/encouraging"}
4. Keep descriptions focused on open-mindedness traits and growth potential
5. Match the specified tone of voice
6. Language: ${language === "en" ? "English" : language === "et" ? "Estonian" : language}

OUTPUT FORMAT (JSON array):
[
  {
    "min_score": 0,
    "max_score": 1,
    "title": "Title here",
    "description": "Description here",
    "emoji": "🧠"
  }
]

Generate the ${numberOfLevels} result levels now:`;

    console.log("Calling AI with prompt length:", prompt.length);

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert at creating quiz result descriptions. Always respond with valid JSON only, no markdown formatting." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices?.[0]?.message?.content;

    if (!generatedText) {
      throw new Error("No response from AI");
    }

    console.log("AI response:", generatedText.substring(0, 500));

    // Parse the JSON response
    let parsedLevels;
    try {
      // Remove markdown code blocks if present
      let cleanedText = generatedText.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsedLevels = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw text:", generatedText);
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!Array.isArray(parsedLevels)) {
      throw new Error("AI response is not an array");
    }

    // Format result levels with proper structure
    const resultLevels = parsedLevels.map((level: any, index: number) => ({
      id: crypto.randomUUID(),
      min_score: level.min_score,
      max_score: level.max_score,
      title: { [language]: level.title },
      description: { [language]: level.description },
      emoji: level.emoji || "🧠",
      color_class: "from-blue-500 to-indigo-600",
    }));

    // Calculate estimated cost
    const inputTokens = aiData.usage?.prompt_tokens || Math.ceil(prompt.length / 4);
    const outputTokens = aiData.usage?.completion_tokens || Math.ceil(generatedText.length / 4);
    const estimatedCostEur = (inputTokens * 0.000000075 + outputTokens * 0.0000003) * 0.92;

    console.log("Generated", resultLevels.length, "open-mindedness result levels");

    return new Response(
      JSON.stringify({
        resultLevels,
        estimatedCostEur,
        inputTokens,
        outputTokens,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error generating open-mindedness results:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate results" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
