import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerationParams {
  quizId: string;
  numberOfLevels: number;
  toneOfVoice: string;
  higherScoreMeaning: 'positive' | 'negative';
  language: string;
}

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

    const params: GenerationParams = await req.json();
    const { quizId, numberOfLevels, toneOfVoice, higherScoreMeaning, language } = params;

    console.log('Generating results for quiz:', quizId, 'with params:', { numberOfLevels, toneOfVoice, higherScoreMeaning, language });

    // Fetch quiz with questions and answers
    const { data: quiz, error: quizError } = await supabaseClient
      .from('quizzes')
      .select('title, description')
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;

    const { data: questions, error: questionsError } = await supabaseClient
      .from('quiz_questions')
      .select('id, question_text, question_order')
      .eq('quiz_id', quizId)
      .neq('question_type', 'open_mindedness')
      .order('question_order');

    if (questionsError) throw questionsError;

    const questionIds = (questions || []).map(q => q.id).filter(Boolean);
    
    const { data: answers, error: answersError } = await supabaseClient
      .from('quiz_answers')
      .select('answer_text, score_value, question_id')
      .in('question_id', questionIds);

    // Build context from quiz data
    const quizTitle = (quiz.title as Record<string, string>)?.[language] || (quiz.title as Record<string, string>)?.en || '';
    const quizDescription = (quiz.description as Record<string, string>)?.[language] || (quiz.description as Record<string, string>)?.en || '';
    
    // Calculate max possible score
    let maxPossibleScore = 0;
    let minPossibleScore = 0;
    for (const q of questions) {
      const qAnswers = (answers || []).filter(a => a.question_id === (q as any).id);
      if (qAnswers.length > 0) {
        const scores = qAnswers.map(a => a.score_value);
        maxPossibleScore += Math.max(...scores);
        minPossibleScore += Math.min(...scores);
      }
    }

    const questionsContext = questions.map((q, idx) => {
      const qText = (q.question_text as Record<string, string>)?.[language] || (q.question_text as Record<string, string>)?.en || '';
      const qAnswers = (answers || []).filter(a => a.question_id === (q as any).id);
      const answersText = qAnswers.map(a => {
        const aText = (a.answer_text as Record<string, string>)?.[language] || (a.answer_text as Record<string, string>)?.en || '';
        return `  - "${aText}" (${a.score_value} points)`;
      }).join('\n');
      return `Q${idx + 1}: ${qText}\n${answersText}`;
    }).join('\n\n');

    const scoreMeaningInstruction = higherScoreMeaning === 'positive'
      ? 'Higher scores indicate better/more positive outcomes.'
      : 'Higher scores indicate worse/more concerning outcomes.';

    const prompt = `You are creating result levels for a personality/assessment quiz. Generate exactly ${numberOfLevels} distinct result levels.

Quiz: "${quizTitle}"
Description: ${quizDescription}

Questions and Answers with point values:
${questionsContext}

Score Range: ${minPossibleScore} to ${maxPossibleScore} points
${scoreMeaningInstruction}

Tone of voice: ${toneOfVoice}
Language: ${language === 'et' ? 'Estonian' : 'English'}

Create ${numberOfLevels} result levels that:
1. Cover the entire score range from ${minPossibleScore} to ${maxPossibleScore} without gaps or overlaps
2. Have meaningful, distinct titles and descriptions
3. Match the specified tone of voice
4. Use appropriate emojis
5. Include 2-3 actionable insights for each level

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "levels": [
    {
      "min_score": <number>,
      "max_score": <number>,
      "title": "<title in ${language}>",
      "description": "<2-3 sentence description>",
      "emoji": "<single emoji>",
      "insights": ["<insight 1>", "<insight 2>", "<insight 3>"]
    }
  ]
}`;

    // Call Lovable AI
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
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    const usage = aiData.usage || {};

    console.log('AI response content:', content.substring(0, 500));

    // Parse the JSON response
    let parsedLevels;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      }
      parsedLevels = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Calculate estimated cost (based on Gemini Flash pricing ~$0.075/1M input, $0.30/1M output)
    const inputTokens = usage.prompt_tokens || Math.ceil(prompt.length / 4);
    const outputTokens = usage.completion_tokens || Math.ceil(content.length / 4);
    const estimatedCostUsd = (inputTokens * 0.000000075) + (outputTokens * 0.0000003);
    const estimatedCostEur = estimatedCostUsd * 0.92; // Approximate EUR conversion

    // Format levels for storage
    const resultLevels = (parsedLevels.levels || []).map((level: any, index: number) => ({
      id: `new-${Date.now()}-${index}`,
      min_score: level.min_score,
      max_score: level.max_score,
      title: { [language]: level.title },
      description: { [language]: level.description },
      insights: level.insights || [],
      emoji: level.emoji || '🌟',
      color_class: 'from-emerald-500 to-green-600',
    }));

    // Get next version number
    const { data: existingVersions } = await supabaseClient
      .from('quiz_result_versions')
      .select('version_number')
      .eq('quiz_id', quizId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersionNumber = (existingVersions?.[0]?.version_number || 0) + 1;

    // Save version to database
    const { data: savedVersion, error: saveError } = await supabaseClient
      .from('quiz_result_versions')
      .insert({
        quiz_id: quizId,
        version_number: nextVersionNumber,
        result_levels: resultLevels,
        generation_params: {
          numberOfLevels,
          toneOfVoice,
          higherScoreMeaning,
          language,
        },
        estimated_cost_eur: estimatedCostEur,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        created_by: user.id,
        created_by_email: user.email,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save version:', saveError);
      throw saveError;
    }

    return new Response(JSON.stringify({
      success: true,
      resultLevels,
      version: savedVersion,
      estimatedCostEur,
      inputTokens,
      outputTokens,
      scoreRange: { min: minPossibleScore, max: maxPossibleScore },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating results:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
