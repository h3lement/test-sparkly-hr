import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendRequest {
  logId: string;
}

interface EmailConfigSettings {
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpTls: boolean;
}

async function getEmailConfig(supabase: any): Promise<EmailConfigSettings> {
  const defaults: EmailConfigSettings = {
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
    
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", settingKeys);
    
    if (!error && data && data.length > 0) {
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
function encodeCredential(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
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

// Raw SMTP implementation with proper UTF-8 authentication support
class RawSMTPClient {
  private conn: Deno.Conn | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private buffer = "";

  constructor(private config: EmailConfigSettings) {}

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
      if (line.length >= 4 && line[3] !== "-") break;
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

    const greeting = await this.readResponse();
    if (greeting.code !== 220) {
      throw new Error(`SMTP greeting error: ${greeting.lines.join(" ")}`);
    }

    await this.command(`EHLO localhost`, [250]);
    await this.command("AUTH LOGIN", [334]);
    await this.command(encodeCredential(this.config.smtpUsername), [334]);
    await this.command(encodeCredential(this.config.smtpPassword), [235]);
  }

  async send(from: string, to: string[], subject: string, html: string, replyTo?: string): Promise<void> {
    const fromEmail = from.match(/<(.+)>$/)?.[1] || from;
    
    await this.command(`MAIL FROM:<${fromEmail}>`, [250]);
    
    for (const recipient of to) {
      await this.command(`RCPT TO:<${recipient}>`, [250]);
    }
    
    await this.command("DATA", [354]);

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

    for (const header of headers) {
      await this.writeLine(header);
    }
    
    await this.writeLine("");
    
    const bodyBase64 = utf8ToBase64(html);
    const lines = bodyBase64.match(/.{1,76}/g) || [];
    for (const line of lines) {
      await this.writeLine(line);
    }
    
    await this.command(".", [250]);
  }

  async close(): Promise<void> {
    try { await this.command("QUIT", [221]); } catch {}
    try {
      this.reader?.releaseLock();
      this.writer?.releaseLock();
      this.conn?.close();
    } catch {}
  }
}

async function sendEmailViaSMTP(
  config: EmailConfigSettings,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error: string | null; messageId?: string }> {
  if (!config.smtpHost || !config.smtpUsername || !config.smtpPassword) {
    return { success: false, error: "SMTP not configured" };
  }

  const client = new RawSMTPClient(config);
  
  try {
    await client.connect();
    
    const encodedSenderName = encodeDisplayName(config.senderName);
    const from = `${encodedSenderName} <${config.senderEmail}>`;

    await client.send(from, [to], subject, html, config.replyToEmail || undefined);
    await client.close();
    
    console.log(`Email sent successfully to ${to}`);
    return { success: true, error: null, messageId: `smtp-${Date.now()}` };
  } catch (error: any) {
    console.error("SMTP send error:", error);
    try { await client.close(); } catch {}
    return { success: false, error: error.message || "SMTP send failed" };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("resend-email function called");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - admin role required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { logId }: ResendRequest = await req.json();

    if (!logId) {
      return new Response(
        JSON.stringify({ error: "logId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch the original email log
    const { data: emailLog, error: logError } = await supabase
      .from("email_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (logError || !emailLog) {
      console.error("Error fetching email log:", logError);
      return new Response(
        JSON.stringify({ error: "Email log not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Resending email to:", emailLog.recipient_email);
    console.log("Subject:", emailLog.subject);

    // Get email config
    const emailConfig = await getEmailConfig(supabase);

    // Global email config from app_settings takes priority for sender identity
    const senderName = emailConfig.senderName;
    const senderEmail = emailConfig.senderEmail;

    // Use the original email HTML body if available, otherwise create a fallback
    const emailHtml = emailLog.html_body || `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #faf7f5; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://sparkly.hr/wp-content/uploads/2025/06/sparkly-logo.png" alt="Sparkly.hr" style="height: 48px; margin-bottom: 20px;" />
            <h1 style="color: #6d28d9; font-size: 24px; margin: 0;">Email Resent</h1>
          </div>
          
          <p style="color: #6b7280; line-height: 1.6;">This is a resend of a previous email.</p>
          
          <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Original Subject:</strong> ${emailLog.subject}</p>
            <p style="margin: 0;"><strong>Language:</strong> ${emailLog.language || 'en'}</p>
          </div>
          
          <p style="color: #6b7280; line-height: 1.6;">Please visit <a href="https://sparkly.hr" style="color: #6d28d9;">sparkly.hr</a> for more information about your team's performance assessment.</p>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2025 Sparkly.hr</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await sendEmailViaSMTP(
      { ...emailConfig, senderName, senderEmail },
      emailLog.recipient_email,
      emailLog.subject,
      emailHtml
    );

    console.log("SMTP response:", JSON.stringify(emailResponse));

    const newAttempts = (emailLog.resend_attempts || 0) + 1;
    const now = new Date().toISOString();

    if (!emailResponse.success) {
      // Update the log with failed resend attempt
      await supabase
        .from("email_logs")
        .update({
          resend_attempts: newAttempts,
          last_attempt_at: now,
          error_message: emailResponse.error,
        })
        .eq("id", logId);

      console.error("Resend failed:", emailResponse.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: emailResponse.error,
          attempts: newAttempts 
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update the original log to mark as successfully resent
    await supabase
      .from("email_logs")
      .update({
        status: "sent",
        resend_attempts: newAttempts,
        last_attempt_at: now,
        resend_id: emailResponse.messageId || null,
        error_message: null,
      })
      .eq("id", logId);

    // Ensure quiz_lead_id won't violate FK constraints (hypothesis leads are stored in a different table)
    let safeQuizLeadId: string | null = null;
    if (emailLog.quiz_lead_id) {
      const { data: lead } = await supabase
        .from("quiz_leads")
        .select("id")
        .eq("id", emailLog.quiz_lead_id)
        .maybeSingle();
      safeQuizLeadId = lead?.id ?? null;
    }

    // Log the new resend as a separate entry with HTML body
    await supabase.from("email_logs").insert({
      email_type: emailLog.email_type,
      recipient_email: emailLog.recipient_email,
      sender_email: senderEmail,
      sender_name: senderName,
      subject: emailLog.subject,
      status: "sent",
      resend_id: emailResponse.messageId || null,
      language: emailLog.language,
      quiz_lead_id: safeQuizLeadId,
      original_log_id: logId,
      html_body: emailHtml,
    });

    console.log("Email resent successfully via SMTP");

    return new Response(
      JSON.stringify({ 
        success: true, 
        resendId: emailResponse.messageId,
        attempts: newAttempts 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in resend-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
