import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { quizId, minScore, maxScore, instructions, language } = await req.json();

    console.log('Filling result level for quiz:', quizId, 'score range:', minScore, '-', maxScore);

    // Fetch quiz info
    const { data: quiz, error: quizError } = await supabaseClient
      .from('quizzes')
      .select('title, description')
      .eq('id', quizId)
      .maybeSingle();

    if (quizError) throw quizError;

    // Fetch questions for context
    const { data: questions } = await supabaseClient
      .from('quiz_questions')
      .select('id, question_text')
      .eq('quiz_id', quizId)
      .neq('question_type', 'open_mindedness')
      .order('question_order');

    const questionIds = (questions || []).map(q => q.id).filter(Boolean);
    
    const { data: answers } = await supabaseClient
      .from('quiz_answers')
      .select('answer_text, score_value, question_id')
      .in('question_id', questionIds);

    // Calculate total score range
    let maxPossibleScore = 0;
    let minPossibleScore = 0;
    for (const q of questions || []) {
      const qAnswers = (answers || []).filter(a => a.question_id === q.id);
      if (qAnswers.length > 0) {
        const scores = qAnswers.map(a => a.score_value);
        maxPossibleScore += Math.max(...scores);
        minPossibleScore += Math.min(...scores);
      }
    }

    const quizTitle = (quiz?.title as Record<string, string>)?.[language] || (quiz?.title as Record<string, string>)?.en || 'Quiz';
    const quizDescription = (quiz?.description as Record<string, string>)?.[language] || (quiz?.description as Record<string, string>)?.en || '';

    // Build context about the score range
    const scorePercentMin = ((minScore - minPossibleScore) / (maxPossibleScore - minPossibleScore) * 100).toFixed(0);
    const scorePercentMax = ((maxScore - minPossibleScore) / (maxPossibleScore - minPossibleScore) * 100).toFixed(0);

    const prompt = `You are creating a single result level for a quiz.

Quiz: "${quizTitle}"
Description: ${quizDescription}

This result level is for scores ${minScore} to ${maxScore} points.
The total quiz score range is ${minPossibleScore} to ${maxPossibleScore} points.
This represents approximately ${scorePercentMin}% to ${scorePercentMax}% of the maximum score.

${instructions ? `Additional instructions: ${instructions}` : ''}

Language: ${language === 'et' ? 'Estonian' : 'English'}

Create a result for this score range that includes:
1. A catchy, meaningful title (max 6 words)
2. A description (2-3 sentences explaining what this score means)
3. An appropriate single emoji
4. 2-3 actionable insights or tips

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "title": "<title in ${language}>",
  "description": "<description in ${language}>",
  "emoji": "<single emoji>",
  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"]
}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert quiz result designer. Always output valid JSON only, no markdown.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    console.log('AI response:', content.substring(0, 300));

    // Parse JSON
    let parsed;
    try {
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      }
      parsed = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      throw new Error('Failed to parse AI response');
    }

    return new Response(JSON.stringify({
      title: parsed.title,
      description: parsed.description,
      emoji: parsed.emoji,
      insights: parsed.insights || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error filling result level:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
