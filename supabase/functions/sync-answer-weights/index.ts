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
    const { quizId, targetMinScore, targetMaxScore, instructions, language } = await req.json();

    if (!quizId) {
      return new Response(
        JSON.stringify({ error: "quizId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch quiz with questions and answers
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("title, description")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      return new Response(
        JSON.stringify({ error: "Quiz not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: questions, error: questionsError } = await supabase
      .from("quiz_questions")
      .select("id, question_text, question_order, question_type")
      .eq("quiz_id", quizId)
      .neq("question_type", "open_mindedness")
      .order("question_order");

    if (questionsError || !questions || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No scoring questions found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch answers for each question
    const questionsWithAnswers = [];
    for (const q of questions) {
      const { data: answers } = await supabase
        .from("quiz_answers")
        .select("id, answer_text, answer_order, score_value")
        .eq("question_id", q.id)
        .order("answer_order");

      questionsWithAnswers.push({
        ...q,
        answers: answers || [],
      });
    }

    // Build context for AI
    const getLocalizedText = (obj: any, lang: string): string => {
      if (typeof obj === "string") return obj;
      if (obj && typeof obj === "object") return obj[lang] || obj["en"] || "";
      return "";
    };

    const questionsContext = questionsWithAnswers.map((q, idx) => {
      const answersText = q.answers
        .map((a: any, i: number) => `  ${i + 1}. "${getLocalizedText(a.answer_text, language)}" (current weight: ${a.score_value}, id: ${a.id})`)
        .join("\n");
      return `Q${idx + 1}: "${getLocalizedText(q.question_text, language)}" (id: ${q.id})\n${answersText}`;
    }).join("\n\n");

    const numQuestions = questionsWithAnswers.length;
    const avgPointsPerQuestion = Math.round((targetMaxScore - targetMinScore) / numQuestions);

    const systemPrompt = `You are an expert quiz designer. Your task is to assign score weights to quiz answers so that:
1. The total minimum possible score (sum of lowest answer weights per question) equals approximately ${targetMinScore}
2. The total maximum possible score (sum of highest answer weights per question) equals approximately ${targetMaxScore}
3. Weights are meaningful - more positive/correct answers should generally have higher weights
4. Weights should be integers

Quiz: "${getLocalizedText(quiz.title, language)}"
Number of questions: ${numQuestions}
Target score range: ${targetMinScore} to ${targetMaxScore}
Average points per question: ~${avgPointsPerQuestion}

${instructions ? `Additional instructions: ${instructions}` : ""}`;

    const userPrompt = `Here are the quiz questions with their answers and current weights:

${questionsContext}

Assign new integer weights to each answer. Return a JSON object where keys are question IDs and values are objects mapping answer IDs to their new weights.

Example format:
{
  "question-id-1": {
    "answer-id-1": 0,
    "answer-id-2": 5,
    "answer-id-3": 10
  },
  "question-id-2": {
    "answer-id-4": 0,
    "answer-id-5": 5
  }
}

Return ONLY the JSON object, no other text.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse JSON from response (handle markdown code blocks)
    let weightsJson = content.trim();
    if (weightsJson.startsWith("```")) {
      weightsJson = weightsJson.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }

    let weights;
    try {
      weights = JSON.parse(weightsJson);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generated weights:", weights);

    return new Response(
      JSON.stringify({ weights }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in sync-answer-weights:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
