import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 10;
const PROCESSING_TIMEOUT_MINUTES = 5;

interface EmailQueueItem {
  id: string;
  recipient_email: string;
  sender_email: string;
  sender_name: string;
  subject: string;
  html_body: string;
  email_type: string;
  retry_count: number;
  max_retries: number;
  quiz_lead_id: string | null;
  hypothesis_lead_id: string | null;
  quiz_id: string | null;
  language: string | null;
  reply_to_email: string | null;
}

interface EmailConfig {
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpTls: boolean;
}

async function getEmailConfig(supabase: any): Promise<EmailConfig> {
  const defaults: EmailConfig = {
    smtpHost: "",
    smtpPort: "587",
    smtpUsername: "",
    smtpPassword: "",
    smtpTls: true,
  };

  try {
    const settingKeys = ["smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_tls"];
    
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", settingKeys);
    
    if (!error && data && data.length > 0) {
      data.forEach((setting: { setting_key: string; setting_value: string }) => {
        switch (setting.setting_key) {
          case "smtp_host": defaults.smtpHost = setting.setting_value; break;
          case "smtp_port": defaults.smtpPort = setting.setting_value || defaults.smtpPort; break;
          case "smtp_username": defaults.smtpUsername = setting.setting_value; break;
          case "smtp_password": defaults.smtpPassword = setting.setting_value; break;
          case "smtp_tls": defaults.smtpTls = setting.setting_value === "true"; break;
        }
      });
      console.log("Loaded SMTP config:", {
        smtpHost: defaults.smtpHost,
        smtpPort: defaults.smtpPort,
        smtpTls: defaults.smtpTls,
      });
    }
  } catch (error) {
    console.error("Error fetching email config:", error);
  }
  
  return defaults;
}

// UTF-8 safe base64 encoding (handles any Unicode string)
function utf8ToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Safe base64 encoding for SMTP AUTH (RFC 4954)
// SMTP AUTH LOGIN uses base64, but the credential bytes should be UTF-8 encoded first
function encodeCredential(str: string): string {
  // Use TextEncoder to get UTF-8 bytes, then convert to base64
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  
  // Convert Uint8Array to binary string
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary);
}

// Encode subject line for UTF-8 support (RFC 2047)
function encodeSubject(subject: string): string {
  if (!/^[\x00-\x7F]*$/.test(subject)) {
    const encoded = utf8ToBase64(subject);
    return `=?UTF-8?B?${encoded}?=`;
  }
  return subject;
}

// Encode display name for UTF-8 support (RFC 2047)
function encodeDisplayName(name: string): string {
  if (!/^[\x00-\x7F]*$/.test(name)) {
    const encoded = utf8ToBase64(name);
    return `=?UTF-8?B?${encoded}?=`;
  }
  return name;
}

function hasSmtpConfigured(config: EmailConfig): boolean {
  return !!(config.smtpHost && config.smtpUsername && config.smtpPassword);
}

// Raw SMTP implementation with proper UTF-8 authentication support
class RawSMTPClient {
  private conn: Deno.Conn | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private buffer = "";

  constructor(private config: EmailConfig) {}

  private async readLine(): Promise<string> {
    while (!this.buffer.includes("\r\n")) {
      if (!this.reader) throw new Error("Connection not established");
      const { value, done } = await this.reader.read();
      if (done) throw new Error("Connection closed");
      this.buffer += this.decoder.decode(value);
    }
    const lineEnd = this.buffer.indexOf("\r\n");
    const line = this.buffer.slice(0, lineEnd);
    this.buffer = this.buffer.slice(lineEnd + 2);
    return line;
  }

  private async readResponse(): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = [];
    let code = 0;
    
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      code = parseInt(line.slice(0, 3), 10);
      // Check if this is the last line (space after code, not hyphen)
      if (line.length >= 4 && line[3] !== "-") {
        break;
      }
    }
    
    return { code, lines };
  }

  private async writeLine(line: string): Promise<void> {
    if (!this.writer) throw new Error("Connection not established");
    await this.writer.write(this.encoder.encode(line + "\r\n"));
  }

  private async command(cmd: string, expectedCodes: number[]): Promise<{ code: number; lines: string[] }> {
    await this.writeLine(cmd);
    const response = await this.readResponse();
    if (!expectedCodes.includes(response.code)) {
      throw new Error(`SMTP error: expected ${expectedCodes.join(" or ")}, got ${response.code}: ${response.lines.join(" ")}`);
    }
    return response;
  }

  async connect(): Promise<void> {
    const port = parseInt(this.config.smtpPort, 10) || 587;
    
    // For port 465, use implicit TLS
    if (port === 465 || this.config.smtpTls) {
      this.conn = await Deno.connectTls({
        hostname: this.config.smtpHost,
        port,
      });
    } else {
      this.conn = await Deno.connect({
        hostname: this.config.smtpHost,
        port,
      });
    }

    this.reader = this.conn.readable.getReader();
    this.writer = this.conn.writable.getWriter();

    // Read server greeting
    const greeting = await this.readResponse();
    if (greeting.code !== 220) {
      throw new Error(`SMTP greeting error: ${greeting.lines.join(" ")}`);
    }

    // Send EHLO
    await this.command(`EHLO localhost`, [250]);

    // Authenticate using AUTH LOGIN with base64 encoded UTF-8 credentials
    await this.command("AUTH LOGIN", [334]);
    await this.command(encodeCredential(this.config.smtpUsername), [334]);
    await this.command(encodeCredential(this.config.smtpPassword), [235]);
  }

  async send(from: string, to: string[], subject: string, html: string, replyTo?: string): Promise<void> {
    // Extract email address from "Name <email>" format
    const fromEmail = from.match(/<(.+)>$/)?.[1] || from;
    
    await this.command(`MAIL FROM:<${fromEmail}>`, [250]);
    
    for (const recipient of to) {
      await this.command(`RCPT TO:<${recipient}>`, [250]);
    }
    
    await this.command("DATA", [354]);

    // Build email headers and body
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const date = new Date().toUTCString();
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${this.config.smtpHost}>`;
    
    const headers = [
      `From: ${from}`,
      `To: ${to.join(", ")}`,
      `Subject: ${encodeSubject(subject)}`,
      `Date: ${date}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
    ];
    
    if (replyTo) {
      headers.push(`Reply-To: ${replyTo}`);
    }

    // Send headers
    for (const header of headers) {
      await this.writeLine(header);
    }
    
    // Empty line between headers and body
    await this.writeLine("");
    
    // Send body as base64 (split into 76-char lines per RFC 2045)
    const bodyBase64 = utf8ToBase64(html);
    const lines = bodyBase64.match(/.{1,76}/g) || [];
    for (const line of lines) {
      await this.writeLine(line);
    }
    
    // End DATA section
    const endResponse = await this.command(".", [250]);
    console.log("Email accepted:", endResponse.lines[0]);
  }

  async close(): Promise<void> {
    try {
      await this.command("QUIT", [221]);
    } catch {
      // Ignore quit errors
    }
    
    try {
      this.reader?.releaseLock();
      this.writer?.releaseLock();
      this.conn?.close();
    } catch {
      // Ignore close errors
    }
  }
}

async function sendEmailViaSMTP(
  config: EmailConfig,
  item: EmailQueueItem
): Promise<{ success: boolean; error: string | null; messageId?: string }> {
  if (!hasSmtpConfigured(config)) {
    return { success: false, error: "SMTP not configured - missing host, username, or password" };
  }

  const client = new RawSMTPClient(config);
  
  try {
    await client.connect();
    
    const encodedSenderName = encodeDisplayName(item.sender_name);
    const from = `${encodedSenderName} <${item.sender_email}>`;

    await client.send(
      from,
      [item.recipient_email],
      item.subject,
      item.html_body,
      item.reply_to_email || undefined
    );

    await client.close();

    const messageId = `smtp-${Date.now()}-${item.id.slice(0, 8)}`;
    console.log(`Email sent successfully to ${item.recipient_email}`);
    return { success: true, error: null, messageId };
  } catch (error: any) {
    console.error("SMTP send error:", error);
    try { await client.close(); } catch {}
    return { success: false, error: error?.message || "SMTP send failed" };
  }
}

async function getSafeQuizLeadId(supabase: any, quizLeadId: string | null): Promise<string | null> {
  if (!quizLeadId) return null;
  const { data, error } = await supabase
    .from("quiz_leads")
    .select("id")
    .eq("id", quizLeadId)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data.id;
}

async function getSafeHypothesisLeadId(supabase: any, hypothesisLeadId: string | null): Promise<string | null> {
  if (!hypothesisLeadId) return null;
  const { data, error } = await supabase
    .from("hypothesis_leads")
    .select("id")
    .eq("id", hypothesisLeadId)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data.id;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("process-email-queue function called");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if email sending is enabled globally
    const { data: emailEnabledSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "email_sending_enabled")
      .maybeSingle();

    // If explicitly set to "false", skip processing
    if (emailEnabledSetting?.setting_value === "false") {
      console.log("Email sending is disabled globally, skipping queue processing");
      return new Response(
        JSON.stringify({ 
          processed: 0, 
          failed: 0, 
          skipped: true,
          reason: "Email sending is disabled globally" 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get SMTP config from database
    const emailConfig = await getEmailConfig(supabase);

    if (!emailConfig.smtpHost) {
      console.error("SMTP not configured");
      return new Response(
        JSON.stringify({ error: "SMTP not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Reset stuck processing items (older than timeout)
    const timeoutThreshold = new Date(Date.now() - PROCESSING_TIMEOUT_MINUTES * 60 * 1000).toISOString();
    const { data: stuckItems } = await supabase
      .from("email_queue")
      .update({ status: "pending", processing_started_at: null })
      .eq("status", "processing")
      .lt("processing_started_at", timeoutThreshold)
      .select("id");

    if (stuckItems && stuckItems.length > 0) {
      console.log(`Reset ${stuckItems.length} stuck processing items`);
    }

    // Auto-retry legacy failures caused by non-Latin1 credential encoding.
    // These failures can become sendable after a code/config fix, but they were previously marked as final "failed".
    const { data: revivedItems } = await supabase
      .from("email_queue")
      .update({
        status: "pending",
        retry_count: 0,
        error_message: null,
        processing_started_at: null,
        scheduled_for: new Date().toISOString(),
      })
      .eq("status", "failed")
      .or(
        "error_message.ilike.%non-Latin1%,error_message.ilike.%outside of the Latin1 range%"
      )
      .select("id");

    if (revivedItems && revivedItems.length > 0) {
      console.log(`Revived ${revivedItems.length} legacy failed emails back to pending for retry`);
    }

    // Fetch pending emails ready to be sent
    const { data: pendingEmails, error: fetchError } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching pending emails:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log("No pending emails to process");
      return new Response(
        JSON.stringify({ processed: 0, sent: 0, failed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Processing ${pendingEmails.length} pending emails`);

    // Mark items as processing
    const emailIds = pendingEmails.map((e: EmailQueueItem) => e.id);
    await supabase
      .from("email_queue")
      .update({ status: "processing", processing_started_at: new Date().toISOString() })
      .in("id", emailIds);

    let sent = 0;
    let failed = 0;

    for (const email of pendingEmails as EmailQueueItem[]) {
      console.log(`Sending email to: ${email.recipient_email}, type: ${email.email_type}`);
      
      const result = await sendEmailViaSMTP(emailConfig, email);

      if (result.success) {
        // Update queue item as sent
        await supabase
          .from("email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", email.id);

        const safeQuizLeadId = await getSafeQuizLeadId(supabase, email.quiz_lead_id);
        const safeHypothesisLeadId = await getSafeHypothesisLeadId(supabase, email.hypothesis_lead_id);

        // Log to email_logs
        await supabase.from("email_logs").insert({
          email_type: email.email_type,
          recipient_email: email.recipient_email,
          sender_email: email.sender_email,
          sender_name: email.sender_name,
          subject: email.subject,
          status: "sent",
          resend_id: result.messageId || null,
          language: email.language,
          quiz_lead_id: safeQuizLeadId,
          hypothesis_lead_id: safeHypothesisLeadId,
          quiz_id: email.quiz_id,
          html_body: email.html_body,
          delivery_status: "sent",
        });

        sent++;
        console.log(`Email sent successfully to: ${email.recipient_email}`);
      } else {
        const newRetryCount = email.retry_count + 1;
        const isFinalFailure = newRetryCount >= email.max_retries;

        // Update queue item
        await supabase
          .from("email_queue")
          .update({
            status: isFinalFailure ? "failed" : "pending",
            retry_count: newRetryCount,
            error_message: result.error,
            processing_started_at: null,
            // Exponential backoff: 1min, 2min, 4min...
            scheduled_for: isFinalFailure 
              ? new Date().toISOString()
              : new Date(Date.now() + Math.pow(2, newRetryCount) * 60 * 1000).toISOString(),
          })
          .eq("id", email.id);

        if (isFinalFailure) {
          const safeQuizLeadId = await getSafeQuizLeadId(supabase, email.quiz_lead_id);
          const safeHypothesisLeadId = await getSafeHypothesisLeadId(supabase, email.hypothesis_lead_id);

          // Log final failure to email_logs
          await supabase.from("email_logs").insert({
            email_type: email.email_type,
            recipient_email: email.recipient_email,
            sender_email: email.sender_email,
            sender_name: email.sender_name,
            subject: email.subject,
            status: "failed",
            error_message: result.error,
            language: email.language,
            quiz_lead_id: safeQuizLeadId,
            hypothesis_lead_id: safeHypothesisLeadId,
            quiz_id: email.quiz_id,
            html_body: email.html_body,
            resend_attempts: newRetryCount,
            delivery_status: "failed",
          });
        }

        failed++;
        console.error(`Email failed to: ${email.recipient_email}, error: ${result.error}, retry: ${newRetryCount}/${email.max_retries}`);
      }
    }

    console.log(`Processed ${pendingEmails.length} emails: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ processed: pendingEmails.length, sent, failed }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in process-email-queue:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
