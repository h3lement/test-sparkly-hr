import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML sanitization to prevent injection attacks
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char);
}

// In-memory rate limiting
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 5; // 5 submissions per hour per IP

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIP(req: Request): string {
  // Try various headers that might contain the real IP
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; remainingRequests: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  // Clean up old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now - value.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window or expired entry
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { 
      allowed: true, 
      remainingRequests: MAX_REQUESTS_PER_WINDOW - 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    };
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const resetTime = entry.windowStart + RATE_LIMIT_WINDOW_MS;
    return { 
      allowed: false, 
      remainingRequests: 0,
      resetTime
    };
  }
  
  // Increment counter
  entry.count++;
  rateLimitMap.set(ip, entry);
  
  return { 
    allowed: true, 
    remainingRequests: MAX_REQUESTS_PER_WINDOW - entry.count,
    resetTime: entry.windowStart + RATE_LIMIT_WINDOW_MS
  };
}

interface QuizResultsRequest {
  email: string;
  totalScore: number;
  maxScore: number;
  resultTitle: string;
  resultDescription: string;
  insights: string[];
  answers?: Array<{ questionId: number; selectedOption: number }>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-quiz-results function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = getClientIP(req);
  console.log("Client IP:", clientIP);
  
  const rateLimitResult = checkRateLimit(clientIP);
  
  if (!rateLimitResult.allowed) {
    const resetDate = new Date(rateLimitResult.resetTime);
    console.log(`Rate limit exceeded for IP: ${clientIP}. Reset at: ${resetDate.toISOString()}`);
    
    return new Response(
      JSON.stringify({ 
        error: "Too many requests. Please try again later.",
        resetTime: rateLimitResult.resetTime
      }),
      {
        status: 429,
        headers: { 
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
          ...corsHeaders 
        },
      }
    );
  }

  try {
    const { email, totalScore, maxScore, resultTitle, resultDescription, insights, answers }: QuizResultsRequest = await req.json();

    console.log("Processing quiz results for:", email);
    console.log("Score:", totalScore, "/", maxScore);
    console.log(`Rate limit - Remaining requests: ${rateLimitResult.remainingRequests}`);

    // Save lead to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: insertError } = await supabase.from("quiz_leads").insert({
      email,
      score: totalScore,
      total_questions: maxScore,
      result_category: resultTitle,
      answers: answers || null,
    });

    if (insertError) {
      console.error("Error saving lead to database:", insertError);
    } else {
      console.log("Lead saved to database successfully");
    }

    // Sanitize user-provided content to prevent HTML injection
    const safeResultTitle = escapeHtml(resultTitle);
    const safeResultDescription = escapeHtml(resultDescription);
    const safeEmail = escapeHtml(email);
    const safeInsights = insights.map(insight => escapeHtml(insight));

    const insightsList = safeInsights.map((insight, i) => `<li style="margin-bottom: 8px;">${i + 1}. ${insight}</li>`).join("");

    // Sparkly.hr logo URL (hosted on their website)
    const logoUrl = "https://sparkly.hr/wp-content/uploads/2024/05/Sparkly-logo.png";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #faf7f5; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="https://sparkly.hr" target="_blank">
              <img src="${logoUrl}" alt="Sparkly.hr" style="height: 48px; margin-bottom: 20px;" />
            </a>
            <h1 style="color: #6d28d9; font-size: 28px; margin: 0;">Your Team Performance Results</h1>
          </div>
          
          <div style="text-align: center; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: white; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
            <div style="font-size: 48px; font-weight: bold; margin-bottom: 8px;">${totalScore}</div>
            <div style="opacity: 0.9;">out of ${maxScore} points</div>
          </div>
          
          <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">${safeResultTitle}</h2>
          
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 24px;">${safeResultDescription}</p>
          
          <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 12px;">Key Insights:</h3>
          <ul style="color: #6b7280; line-height: 1.8; padding-left: 20px; margin-bottom: 30px;">
            ${insightsList}
          </ul>
          
          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 14px; margin-bottom: 12px;">Want to improve your team's performance?</p>
            <a href="https://sparkly.hr" style="display: inline-block; background: #6d28d9; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Visit Sparkly.hr</a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <a href="https://sparkly.hr" target="_blank">
              <img src="${logoUrl}" alt="Sparkly.hr" style="height: 32px; margin-bottom: 10px;" />
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2025 Sparkly.hr</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send to user
    const userEmailResponse = await resend.emails.send({
      from: "Sparkly.hr <mikk.orglaan@gmail.com>",
      to: [email],
      subject: `Your Team Performance Results: ${safeResultTitle}`,
      html: emailHtml,
    });

    console.log("User email sent:", userEmailResponse);

    // Send copy to admin (mikk@sparkly.hr)
    const adminEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${logoUrl}" alt="Sparkly.hr" style="height: 40px; margin-bottom: 16px;" />
            <h1 style="color: #1f2937; font-size: 24px; margin: 0;">New Quiz Submission</h1>
          </div>
          
          <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0;"><strong>User Email:</strong> ${safeEmail}</p>
            <p style="margin: 0 0 8px 0;"><strong>Score:</strong> ${totalScore} / ${maxScore}</p>
            <p style="margin: 0;"><strong>Result Category:</strong> ${safeResultTitle}</p>
          </div>
          
          <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 12px;">Key Insights:</h3>
          <ul style="color: #6b7280; line-height: 1.8; padding-left: 20px; margin-bottom: 20px;">
            ${insightsList}
          </ul>
          
          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px;">© 2025 Sparkly.hr</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const adminEmailResponse = await resend.emails.send({
      from: "Sparkly.hr Quiz <mikk.orglaan@gmail.com>",
      to: ["mikk@sparkly.hr"],
      subject: `New Quiz Lead: ${safeEmail} - ${safeResultTitle}`,
      html: adminEmailHtml,
    });

    console.log("Admin email sent:", adminEmailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": rateLimitResult.remainingRequests.toString(),
        "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
        ...corsHeaders 
      },
    });
  } catch (error: any) {
    console.error("Error in send-quiz-results:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
