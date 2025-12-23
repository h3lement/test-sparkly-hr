import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailConfig {
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpTls: boolean;
}

async function getEmailConfig(supabase: any): Promise<EmailConfig> {
  const defaults: EmailConfig = {
    senderName: "Sparkly",
    senderEmail: "noreply@sparkly.hr",
    replyToEmail: "",
    smtpHost: "",
    smtpPort: "587",
    smtpUsername: "",
    smtpPassword: "",
    smtpTls: true,
  };

  try {
    const settingKeys = [
      "email_sender_name", "email_sender_email", "email_reply_to",
      "smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_tls"
    ];
    
    const { data } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", settingKeys);
    
    if (data && data.length > 0) {
      data.forEach((setting: { setting_key: string; setting_value: string }) => {
        switch (setting.setting_key) {
          case "email_sender_name": defaults.senderName = setting.setting_value || defaults.senderName; break;
          case "email_sender_email": defaults.senderEmail = setting.setting_value || defaults.senderEmail; break;
          case "email_reply_to": defaults.replyToEmail = setting.setting_value; break;
          case "smtp_host": defaults.smtpHost = setting.setting_value; break;
          case "smtp_port": defaults.smtpPort = setting.setting_value || defaults.smtpPort; break;
          case "smtp_username": defaults.smtpUsername = setting.setting_value; break;
          case "smtp_password": defaults.smtpPassword = setting.setting_value; break;
          case "smtp_tls": defaults.smtpTls = setting.setting_value === "true"; break;
        }
      });
    }
  } catch (error) {
    console.error("Error fetching email config:", error);
  }
  
  return defaults;
}

function getLocalizedValue(
  jsonObj: Record<string, string> | null | undefined,
  language: string,
  fallback: string = ''
): string {
  if (!jsonObj) return fallback;
  return jsonObj[language] || jsonObj['en'] || fallback;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("process-pending-emails function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const emailConfig = await getEmailConfig(supabase);
    
    if (!emailConfig.smtpHost) {
      console.log("SMTP not configured, skipping email processing");
      return new Response(
        JSON.stringify({ success: false, message: "SMTP not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // First, find leads without any emails (orphaned leads)
    // These are leads that don't have entries in pending_email_notifications, email_logs, or email_queue
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    
    // Find quiz_leads without emails
    const { data: orphanedQuizLeads } = await supabase
      .from("quiz_leads")
      .select("id, created_at")
      .lt("created_at", thirtySecondsAgo)
      .order("created_at", { ascending: true })
      .limit(20);
    
    if (orphanedQuizLeads && orphanedQuizLeads.length > 0) {
      console.log(`Checking ${orphanedQuizLeads.length} quiz leads for missing emails`);
      
      for (const lead of orphanedQuizLeads) {
        // Check if any email exists for this lead
        const { data: existingLog } = await supabase
          .from("email_logs")
          .select("id")
          .eq("quiz_lead_id", lead.id)
          .limit(1)
          .maybeSingle();
        
        const { data: existingQueue } = await supabase
          .from("email_queue")
          .select("id")
          .eq("quiz_lead_id", lead.id)
          .limit(1)
          .maybeSingle();
        
        const { data: existingNotification } = await supabase
          .from("pending_email_notifications")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("lead_type", "quiz")
          .limit(1)
          .maybeSingle();
        
        // If no email record exists, create a pending notification
        if (!existingLog && !existingQueue && !existingNotification) {
          console.log(`Found orphaned quiz lead ${lead.id}, creating pending notification`);
          await supabase.from("pending_email_notifications").insert({
            lead_type: "quiz",
            lead_id: lead.id,
            status: "pending",
          });
        }
      }
    }
    
    // Find hypothesis_leads without emails
    const { data: orphanedHypothesisLeads } = await supabase
      .from("hypothesis_leads")
      .select("id, created_at")
      .lt("created_at", thirtySecondsAgo)
      .order("created_at", { ascending: true })
      .limit(20);
    
    if (orphanedHypothesisLeads && orphanedHypothesisLeads.length > 0) {
      console.log(`Checking ${orphanedHypothesisLeads.length} hypothesis leads for missing emails`);
      
      for (const lead of orphanedHypothesisLeads) {
        const { data: existingLog } = await supabase
          .from("email_logs")
          .select("id")
          .eq("hypothesis_lead_id", lead.id)
          .limit(1)
          .maybeSingle();
        
        const { data: existingQueue } = await supabase
          .from("email_queue")
          .select("id")
          .eq("hypothesis_lead_id", lead.id)
          .limit(1)
          .maybeSingle();
        
        const { data: existingNotification } = await supabase
          .from("pending_email_notifications")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("lead_type", "hypothesis")
          .limit(1)
          .maybeSingle();
        
        if (!existingLog && !existingQueue && !existingNotification) {
          console.log(`Found orphaned hypothesis lead ${lead.id}, creating pending notification`);
          await supabase.from("pending_email_notifications").insert({
            lead_type: "hypothesis",
            lead_id: lead.id,
            status: "pending",
          });
        }
      }
    }
    
    // Now get pending notifications that are either:
    // 1. Status 'pending' and created more than 30 seconds ago (give frontend time to send)
    // 2. Status 'failed' with attempts < max_attempts (default max is 3)
    const { data: pendingItems, error: fetchError } = await supabase
      .from("pending_email_notifications")
      .select("*")
      .or(`and(status.eq.pending,created_at.lt.${thirtySecondsAgo}),and(status.eq.failed,attempts.lt.3)`)
      .order("created_at", { ascending: true })
      .limit(10);
    
    if (fetchError) {
      console.error("Error fetching pending notifications:", fetchError);
      throw fetchError;
    }
    
    if (!pendingItems || pendingItems.length === 0) {
      console.log("No pending notifications to process");
      return new Response(
        JSON.stringify({ success: true, processed: 0, orphansChecked: (orphanedQuizLeads?.length || 0) + (orphanedHypothesisLeads?.length || 0) }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    console.log(`Found ${pendingItems.length} pending notifications to process`);
    
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    
    for (const item of pendingItems) {
      console.log(`Processing ${item.lead_type} lead: ${item.lead_id}`);
      
      // Mark as processing
      await supabase
        .from("pending_email_notifications")
        .update({ status: "processing", attempts: item.attempts + 1 })
        .eq("id", item.id);
      
      try {
        // Check if email was already sent for this lead
        const emailLogTable = "email_logs";
        const leadIdColumn = item.lead_type === "quiz" ? "quiz_lead_id" : "hypothesis_lead_id";
        
        const { data: existingEmail } = await supabase
          .from(emailLogTable)
          .select("id")
          .eq(leadIdColumn, item.lead_id)
          .eq("status", "sent")
          .limit(1)
          .maybeSingle();
        
        if (existingEmail) {
          console.log(`Email already sent for lead ${item.lead_id}, marking as sent`);
          await supabase
            .from("pending_email_notifications")
            .update({ status: "sent", processed_at: new Date().toISOString() })
            .eq("id", item.id);
          succeeded++;
          processed++;
          continue;
        }
        
        // Check if email is in the queue (will be processed by process-email-queue)
        const { data: queuedEmail } = await supabase
          .from("email_queue")
          .select("id")
          .eq(leadIdColumn, item.lead_id)
          .in("status", ["pending", "processing"])
          .limit(1)
          .maybeSingle();
        
        if (queuedEmail) {
          console.log(`Email already queued for lead ${item.lead_id}, marking as sent`);
          await supabase
            .from("pending_email_notifications")
            .update({ status: "sent", processed_at: new Date().toISOString() })
            .eq("id", item.id);
          succeeded++;
          processed++;
          continue;
        }
        
        // Get the lead data
        let leadData: Record<string, unknown> | null = null;
        
        if (item.lead_type === "quiz") {
          const { data } = await supabase
            .from("quiz_leads")
            .select("*, quiz:quizzes(*)")
            .eq("id", item.lead_id)
            .maybeSingle();
          leadData = data;
        } else {
          const { data } = await supabase
            .from("hypothesis_leads")
            .select("*, quiz:quizzes(*)")
            .eq("id", item.lead_id)
            .maybeSingle();
          leadData = data;
        }
        
        if (!leadData) {
          console.log(`Lead ${item.lead_id} not found, marking as failed`);
          await supabase
            .from("pending_email_notifications")
            .update({ 
              status: "failed", 
              error_message: "Lead not found",
              processed_at: new Date().toISOString() 
            })
            .eq("id", item.id);
          failed++;
          processed++;
          continue;
        }
        
        // Get result level for the lead's score
        const quiz = leadData.quiz as Record<string, unknown>;
        const language = (leadData.language as string) || "en";
        const score = leadData.score as number;
        const totalQuestions = leadData.total_questions as number;
        const email = leadData.email as string;
        
        // For quiz leads, get the matching result level
        if (item.lead_type === "quiz") {
          const { data: resultLevels } = await supabase
            .from("quiz_result_levels")
            .select("*")
            .eq("quiz_id", quiz?.id)
            .lte("min_score", score)
            .gte("max_score", score)
            .limit(1)
            .maybeSingle();
          
          if (!resultLevels) {
            console.log(`No matching result level for score ${score}`);
            // Try to get the closest result level
            const { data: allLevels } = await supabase
              .from("quiz_result_levels")
              .select("*")
              .eq("quiz_id", quiz?.id)
              .order("min_score", { ascending: true });
            
            if (allLevels && allLevels.length > 0) {
              // Find the closest match
              const matchedLevel = allLevels.find(
                (l: Record<string, unknown>) => 
                  score >= (l.min_score as number) && score <= (l.max_score as number)
              ) || allLevels[allLevels.length - 1];
              
              if (matchedLevel) {
                const resultTitle = getLocalizedValue(matchedLevel.title as Record<string, string>, language, "Your Results");
                const resultDescription = getLocalizedValue(matchedLevel.description as Record<string, string>, language, "");
                const insights = matchedLevel.insights as unknown[];
                
                // Queue the email using the existing email queue system
                await queueQuizEmail(supabase, {
                  leadId: item.lead_id,
                  email,
                  score,
                  totalQuestions,
                  resultTitle,
                  resultDescription,
                  insights,
                  language,
                  quizId: quiz?.id as string,
                  emailConfig,
                });
                
                console.log(`Queued email for quiz lead ${item.lead_id}`);
              }
            }
          } else {
            const resultTitle = getLocalizedValue(resultLevels.title as Record<string, string>, language, "Your Results");
            const resultDescription = getLocalizedValue(resultLevels.description as Record<string, string>, language, "");
            const insights = resultLevels.insights as unknown[];
            
            await queueQuizEmail(supabase, {
              leadId: item.lead_id,
              email,
              score,
              totalQuestions,
              resultTitle,
              resultDescription,
              insights,
              language,
              quizId: quiz?.id as string,
              emailConfig,
            });
            
            console.log(`Queued email for quiz lead ${item.lead_id}`);
          }
        } else {
          // Hypothesis lead - queue both user and admin emails
          await queueHypothesisEmails(supabase, {
            leadId: item.lead_id,
            email,
            score,
            totalQuestions,
            language,
            quizId: quiz?.id as string,
            quizTitle: getLocalizedValue(quiz?.title as Record<string, string>, language, "Quiz"),
            sessionId: leadData.session_id as string,
            emailConfig,
          });
          
          console.log(`Queued emails for hypothesis lead ${item.lead_id}`);
        }
        
        // Mark as sent (emails are now in the queue)
        await supabase
          .from("pending_email_notifications")
          .update({ status: "sent", processed_at: new Date().toISOString() })
          .eq("id", item.id);
        
        succeeded++;
        processed++;
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error processing lead ${item.lead_id}:`, errorMessage);
        
        const newStatus = item.attempts + 1 >= item.max_attempts ? "failed" : "failed";
        await supabase
          .from("pending_email_notifications")
          .update({ 
            status: newStatus, 
            error_message: errorMessage,
            processed_at: new Date().toISOString() 
          })
          .eq("id", item.id);
        
        failed++;
        processed++;
      }
    }
    
    console.log(`Processed ${processed} notifications: ${succeeded} succeeded, ${failed} failed`);
    
    return new Response(
      JSON.stringify({ success: true, processed, succeeded, failed }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in process-pending-emails:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

async function queueQuizEmail(
  supabase: any,
  params: {
    leadId: string;
    email: string;
    score: number;
    totalQuestions: number;
    resultTitle: string;
    resultDescription: string;
    insights: unknown[];
    language: string;
    quizId: string;
    emailConfig: EmailConfig;
  }
) {
  const { leadId, email, score, totalQuestions, resultTitle, resultDescription, language, quizId, emailConfig } = params;
  
  // Build simple HTML email
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Your Quiz Results</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Your Quiz Results</h1>
      <p>Thank you for completing the quiz!</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #6366f1; margin-top: 0;">${escapeHtml(resultTitle)}</h2>
        <p style="font-size: 24px; font-weight: bold; color: #333;">
          Score: ${score}/${totalQuestions} (${percentage}%)
        </p>
        <p>${escapeHtml(resultDescription)}</p>
      </div>
      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        This email was sent automatically from Sparkly.hr
      </p>
    </body>
    </html>
  `;
  
  // Insert into email queue
  await supabase.from("email_queue").insert({
    email_type: "quiz_result_user",
    recipient_email: email,
    sender_email: emailConfig.senderEmail,
    sender_name: emailConfig.senderName,
    reply_to_email: emailConfig.replyToEmail || null,
    subject: `Your Quiz Results: ${resultTitle}`,
    html_body: htmlBody,
    quiz_id: quizId,
    quiz_lead_id: leadId,
    language,
    status: "pending",
    scheduled_for: new Date().toISOString(),
  });
}

async function queueHypothesisEmails(
  supabase: any,
  params: {
    leadId: string;
    email: string;
    score: number;
    totalQuestions: number;
    language: string;
    quizId: string;
    quizTitle: string;
    sessionId: string;
    emailConfig: EmailConfig;
  }
) {
  const { leadId, email, score, totalQuestions, language, quizId, quizTitle, emailConfig } = params;
  
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  
  // User email
  const userHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Your Quiz Results</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Your Quiz Results</h1>
      <p>Thank you for completing the ${escapeHtml(quizTitle)} quiz!</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="font-size: 24px; font-weight: bold; color: #333;">
          Score: ${score}/${totalQuestions} (${percentage}%)
        </p>
      </div>
      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        This email was sent automatically from Sparkly.hr
      </p>
    </body>
    </html>
  `;
  
  await supabase.from("email_queue").insert({
    email_type: "hypothesis_results",
    recipient_email: email,
    sender_email: emailConfig.senderEmail,
    sender_name: emailConfig.senderName,
    reply_to_email: emailConfig.replyToEmail || null,
    subject: `Your ${quizTitle} Results`,
    html_body: userHtml,
    quiz_id: quizId,
    hypothesis_lead_id: leadId,
    language,
    status: "pending",
    scheduled_for: new Date().toISOString(),
  });
  
  // Admin notification
  const adminHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>New Quiz Completion</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">New Quiz Completion</h1>
      <p>A new respondent has completed the ${escapeHtml(quizTitle)} quiz.</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Score:</strong> ${score}/${totalQuestions} (${percentage}%)</p>
        <p><strong>Language:</strong> ${language.toUpperCase()}</p>
      </div>
    </body>
    </html>
  `;
  
  await supabase.from("email_queue").insert({
    email_type: "hypothesis_admin",
    recipient_email: "mikk@sparkly.hr",
    sender_email: emailConfig.senderEmail,
    sender_name: emailConfig.senderName,
    subject: `New ${quizTitle} Completion: ${email}`,
    html_body: adminHtml,
    quiz_id: quizId,
    hypothesis_lead_id: leadId,
    language,
    status: "pending",
    scheduled_for: new Date().toISOString(),
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(handler);
