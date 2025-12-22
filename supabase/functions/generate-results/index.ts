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
  model?: string;
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
    const { quizId, numberOfLevels, toneOfVoice, higherScoreMeaning, language, model } = params;
    const selectedModel = model || 'google/gemini-2.5-flash';

    console.log('Generating results for quiz:', quizId, 'with params:', { numberOfLevels, toneOfVoice, higherScoreMeaning, language, model: selectedModel });

    // Fetch quiz with questions and answers, including tone settings and AI context
    const { data: quiz, error: quizError } = await supabaseClient
      .from('quizzes')
      .select('title, description, tone_of_voice, use_tone_for_ai, tone_intensity, icp_description, buying_persona')
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

    // Use quiz's saved tone if available and enabled, otherwise use the provided one
    const effectiveTone = (quiz.use_tone_for_ai && quiz.tone_of_voice) 
      ? quiz.tone_of_voice 
      : toneOfVoice;
    
    // Get ICP and Buying Persona if AI context is enabled
    const icpDescription = quiz.use_tone_for_ai ? (quiz.icp_description || '') : '';
    const buyingPersona = quiz.use_tone_for_ai ? (quiz.buying_persona || '') : '';
    const toneIntensity = quiz.use_tone_for_ai ? (quiz.tone_intensity ?? 4) : 4;

    // Build audience context section
    let audienceContext = '';
    if (icpDescription || buyingPersona) {
      audienceContext = `
TARGET AUDIENCE CONTEXT:
${icpDescription ? `Ideal Customer Profile (ICP): ${icpDescription}` : ''}
${buyingPersona ? `Buying Persona: ${buyingPersona}` : ''}

Use this audience context to make the result descriptions more relevant and resonant with this specific audience.
`;
    }

    // Map tone intensity to description
    const toneIntensityLabels = ['Very Casual', 'Casual', 'Friendly', 'Warm', 'Balanced', 'Professional', 'Formal', 'Authoritative', 'Corporate', 'Very Formal'];
    const toneIntensityLabel = toneIntensityLabels[toneIntensity] || 'Balanced';

    const prompt = `You are creating result levels for a personality/assessment quiz. Generate exactly ${numberOfLevels} distinct result levels.

Quiz: "${quizTitle}"
Description: ${quizDescription}
${audienceContext}
Questions and Answers with point values:
${questionsContext}

Score Range: ${minPossibleScore} to ${maxPossibleScore} points
${scoreMeaningInstruction}

Tone of voice: ${effectiveTone}
Tone intensity: ${toneIntensityLabel} (on a scale from Very Casual to Very Formal)
Language: ${language === 'et' ? 'Estonian' : 'English'}

Create ${numberOfLevels} result levels that:
1. Cover the entire score range from ${minPossibleScore} to ${maxPossibleScore} without gaps or overlaps
2. Have meaningful, distinct titles and descriptions (keep descriptions concise, max 2 sentences)
3. Match the specified tone of voice and intensity level
4. Use appropriate emojis
5. Include exactly 3 short, actionable insights for each level (max 15 words each)
${icpDescription || buyingPersona ? '6. Speak directly to the target audience described above' : ''}

CRITICAL: Return ONLY raw JSON. No markdown code blocks, no backticks, no explanation text before or after.
Output format:
{"levels":[{"min_score":0,"max_score":10,"title":"Title here","description":"Description here.","emoji":"🎯","insights":["Insight 1","Insight 2","Insight 3"]}]}`;

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
        model: selectedModel,
        messages: [
          { role: 'system', content: 'You are an expert quiz result designer. Always output valid JSON only, no markdown.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 8192,
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

    console.log('AI response content length:', content.length);
    console.log('AI response first 1000 chars:', content.substring(0, 1000));
    console.log('AI response last 500 chars:', content.substring(content.length - 500));

    // Parse the JSON response with multiple fallback strategies
    let parsedLevels: any;
    try {
      let jsonContent = content.trim();

      // Strategy 1: Extract from markdown code blocks
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]+?)```/);
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1].trim();
        console.log('Extracted from code block, length:', jsonContent.length);
      } else {
        // Strategy 2: Prefer extracting a full JSON array if present
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        const objectMatch = content.match(/\{[\s\S]*\}/);

        if (content.trim().startsWith('[') && arrayMatch) {
          jsonContent = arrayMatch[0].trim();
          console.log('Extracted JSON array directly, length:', jsonContent.length);
        } else if (content.trim().startsWith('{') && objectMatch) {
          jsonContent = objectMatch[0].trim();
          console.log('Extracted JSON object directly, length:', jsonContent.length);
        } else if (arrayMatch) {
          jsonContent = arrayMatch[0].trim();
          console.log('Extracted JSON array (fallback), length:', jsonContent.length);
        } else if (objectMatch) {
          jsonContent = objectMatch[0].trim();
          console.log('Extracted JSON object (fallback), length:', jsonContent.length);
        }
      }

      const parsed = JSON.parse(jsonContent);

      // Normalize accepted formats:
      // 1) { levels: [...] }
      // 2) [...] (array of levels)
      // 3) { min_score, ... } (single level)
      if (Array.isArray(parsed)) {
        parsedLevels = { levels: parsed };
      } else if (parsed && Array.isArray(parsed.levels)) {
        parsedLevels = parsed;
      } else if (parsed && typeof parsed === 'object' && 'min_score' in parsed && 'max_score' in parsed) {
        parsedLevels = { levels: [parsed] };
      } else {
        parsedLevels = parsed;
      }

      console.log('Successfully parsed levels:', parsedLevels?.levels?.length || 0);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Attempted to parse (first 2000 chars):', content.substring(0, 2000));
      throw new Error('Failed to parse AI response as JSON. The AI may have returned an incomplete response.');
    }

    // Calculate estimated cost (based on Gemini Flash pricing ~$0.075/1M input, $0.30/1M output)
    const inputTokens = usage.prompt_tokens || Math.ceil(prompt.length / 4);
    const outputTokens = usage.completion_tokens || Math.ceil(content.length / 4);
    const estimatedCostUsd = (inputTokens * 0.000000075) + (outputTokens * 0.0000003);
    const estimatedCostEur = estimatedCostUsd * 0.92; // Approximate EUR conversion

    // Calculate proper score ranges (robust even when quiz has 0/1 scoring range)
    const numLevels = (parsedLevels.levels || []).length;

    // When there are no (non-open_mindedness) scored questions, min/max can collapse to 0..0.
    // In that case, expand the range so each level gets at least 1 point.
    const effectiveMin = minPossibleScore;
    const effectiveMax = numLevels > 0
      ? Math.max(maxPossibleScore, effectiveMin + (numLevels - 1))
      : maxPossibleScore;

    const totalRange = effectiveMax - effectiveMin + 1;
    const base = numLevels > 0 ? Math.floor(totalRange / numLevels) : 0;
    const remainder = numLevels > 0 ? totalRange % numLevels : 0;

    // Format levels for storage with calculated score ranges (guaranteed contiguous coverage)
    let currentMin = effectiveMin;
    const resultLevels = (parsedLevels.levels || []).map((level: any, index: number) => {
      const extraPoint = index < remainder ? 1 : 0;
      const levelRange = Math.max(1, base + extraPoint);
      const currentMax = index === numLevels - 1
        ? effectiveMax
        : currentMin + levelRange - 1;

      const out = {
        id: `new-${Date.now()}-${index}`,
        min_score: currentMin,
        max_score: currentMax,
        title: { [language]: level.title },
        description: { [language]: level.description },
        insights: level.insights || [],
        emoji: level.emoji || '🌟',
        color_class: 'from-emerald-500 to-green-600',
      };

      currentMin = currentMax + 1;
      return out;
    });


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
