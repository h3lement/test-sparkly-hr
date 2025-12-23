import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Common DNS blacklists to check
const DNSBL_SERVERS = [
  { name: "Spamhaus ZEN", server: "zen.spamhaus.org", description: "Combined spam/malware blocklist" },
  { name: "Spamhaus DBL", server: "dbl.spamhaus.org", description: "Domain blocklist" },
  { name: "Barracuda", server: "b.barracudacentral.org", description: "Barracuda reputation" },
  { name: "SpamCop", server: "bl.spamcop.net", description: "SpamCop blocklist" },
  { name: "SORBS", server: "dnsbl.sorbs.net", description: "SORBS spam database" },
  { name: "URIBL", server: "multi.uribl.com", description: "URI blocklist" },
  { name: "SURBL", server: "multi.surbl.org", description: "Spam URI blocklist" },
];

interface DNSBLResult {
  name: string;
  server: string;
  description: string;
  listed: boolean;
  error?: string;
}

interface VirusTotalResult {
  harmless: number;
  malicious: number;
  suspicious: number;
  undetected: number;
  timeout: number;
  lastAnalysisDate: string | null;
  reputation: number;
  categories: Record<string, string>;
  error?: string;
}

interface DomainReputationResult {
  domain: string;
  checkedAt: string;
  dnsbl: {
    results: DNSBLResult[];
    listedCount: number;
    checkedCount: number;
  };
  virusTotal: VirusTotalResult | null;
  overallStatus: "clean" | "warning" | "danger" | "error";
  recommendations: string[];
  notificationSent?: boolean;
}

// Reverse IP for DNSBL lookup
function reverseDomain(domain: string): string {
  return domain;
}

// Check domain against a single DNSBL
async function checkDNSBL(domain: string, dnsbl: { name: string; server: string; description: string }): Promise<DNSBLResult> {
  try {
    const lookupDomain = `${reverseDomain(domain)}.${dnsbl.server}`;
    console.log(`Checking DNSBL: ${lookupDomain}`);
    
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(lookupDomain)}&type=A`);
    const data = await response.json();
    
    const listed = data.Answer && data.Answer.length > 0;
    
    return {
      name: dnsbl.name,
      server: dnsbl.server,
      description: dnsbl.description,
      listed,
    };
  } catch (error) {
    console.error(`DNSBL check failed for ${dnsbl.name}:`, error);
    return {
      name: dnsbl.name,
      server: dnsbl.server,
      description: dnsbl.description,
      listed: false,
      error: error instanceof Error ? error.message : "Check failed",
    };
  }
}

// Check domain with VirusTotal
async function checkVirusTotal(domain: string, apiKey: string): Promise<VirusTotalResult> {
  try {
    console.log(`Checking VirusTotal for domain: ${domain}`);
    
    const response = await fetch(`https://www.virustotal.com/api/v3/domains/${encodeURIComponent(domain)}`, {
      headers: {
        "x-apikey": apiKey,
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          harmless: 0,
          malicious: 0,
          suspicious: 0,
          undetected: 0,
          timeout: 0,
          lastAnalysisDate: null,
          reputation: 0,
          categories: {},
          error: "Domain not found in VirusTotal database",
        };
      }
      throw new Error(`VirusTotal API error: ${response.status}`);
    }
    
    const data = await response.json();
    const attributes = data.data?.attributes || {};
    const stats = attributes.last_analysis_stats || {};
    
    return {
      harmless: stats.harmless || 0,
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      undetected: stats.undetected || 0,
      timeout: stats.timeout || 0,
      lastAnalysisDate: attributes.last_analysis_date 
        ? new Date(attributes.last_analysis_date * 1000).toISOString() 
        : null,
      reputation: attributes.reputation || 0,
      categories: attributes.categories || {},
    };
  } catch (error) {
    console.error("VirusTotal check failed:", error);
    return {
      harmless: 0,
      malicious: 0,
      suspicious: 0,
      undetected: 0,
      timeout: 0,
      lastAnalysisDate: null,
      reputation: 0,
      categories: {},
      error: error instanceof Error ? error.message : "VirusTotal check failed",
    };
  }
}

// Generate recommendations based on results
function generateRecommendations(dnsblResults: DNSBLResult[], vtResult: VirusTotalResult | null): string[] {
  const recommendations: string[] = [];
  
  const listedCount = dnsblResults.filter(r => r.listed).length;
  if (listedCount > 0) {
    recommendations.push(`Your domain is listed on ${listedCount} blacklist(s). Consider contacting these services to request delisting.`);
    
    const listedServices = dnsblResults.filter(r => r.listed).map(r => r.name);
    if (listedServices.includes("Spamhaus ZEN") || listedServices.includes("Spamhaus DBL")) {
      recommendations.push("Spamhaus listing is critical - many email providers use this. Visit spamhaus.org to request removal.");
    }
  }
  
  if (vtResult && !vtResult.error) {
    if (vtResult.malicious > 0) {
      recommendations.push(`${vtResult.malicious} security vendor(s) flagged your domain as malicious. Investigate potential security issues.`);
    }
    if (vtResult.suspicious > 0) {
      recommendations.push(`${vtResult.suspicious} security vendor(s) marked your domain as suspicious. Monitor for false positives.`);
    }
    if (vtResult.reputation < 0) {
      recommendations.push("Your domain has negative reputation on VirusTotal. This may affect deliverability.");
    }
    if (!vtResult.lastAnalysisDate) {
      recommendations.push("Domain not yet analyzed by VirusTotal. Consider requesting a scan for baseline reputation data.");
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push("Your domain has a clean reputation across all checked sources.");
    recommendations.push("Continue monitoring regularly to maintain good deliverability.");
  }
  
  return recommendations;
}

// UTF-8 safe base64 encoding
function utf8ToBase64(str: string): string {
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

// Get email config from app_settings
async function getEmailConfig(supabase: any): Promise<{
  senderName: string;
  senderEmail: string;
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpTls: boolean;
}> {
  const defaults = {
    senderName: "Sparkly System",
    senderEmail: "noreply@sparkly.hr",
    smtpHost: "",
    smtpPort: "587",
    smtpUsername: "",
    smtpPassword: "",
    smtpTls: true,
  };

  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "email_sender_name", "email_sender_email",
        "smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_tls"
      ]);

    if (!error && data) {
      for (const s of data) {
        switch (s.setting_key) {
          case "email_sender_name": defaults.senderName = s.setting_value || defaults.senderName; break;
          case "email_sender_email": defaults.senderEmail = s.setting_value || defaults.senderEmail; break;
          case "smtp_host": defaults.smtpHost = s.setting_value; break;
          case "smtp_port": defaults.smtpPort = s.setting_value || defaults.smtpPort; break;
          case "smtp_username": defaults.smtpUsername = s.setting_value; break;
          case "smtp_password": defaults.smtpPassword = s.setting_value; break;
          case "smtp_tls": defaults.smtpTls = s.setting_value === "true"; break;
        }
      }
    }
  } catch (e) {
    console.error("Error fetching email config:", e);
  }

  return defaults;
}

// Send notification email to all admins via SMTP
async function sendAdminNotification(
  supabase: any,
  domain: string,
  status: string,
  result: DomainReputationResult,
  isTest: boolean = false
) {
  const emailConfig = await getEmailConfig(supabase);
  
  if (!emailConfig.smtpHost || !emailConfig.smtpUsername || !emailConfig.smtpPassword) {
    console.log("SMTP not configured, skipping notification");
    return false;
  }

  try {
    // Get admin emails from profiles joined with user_roles
    const { data: admins, error: adminsError } = await supabase
      .from("profiles")
      .select("email, user_id")
      .not("email", "is", null);

    if (adminsError) {
      console.error("Error fetching admins:", adminsError);
      return false;
    }

    // Filter to only admins
    const adminEmails: string[] = [];
    for (const admin of admins || []) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", admin.user_id)
        .eq("role", "admin")
        .single();
      
      if (roleData && admin.email) {
        adminEmails.push(admin.email);
      }
    }

    if (adminEmails.length === 0) {
      console.log("No admin emails found for notification");
      return false;
    }

    console.log(`Sending domain reputation alert to ${adminEmails.length} admin(s) via SMTP`);

    const statusEmoji = status === "danger" ? "🚨" : "⚠️";
    const statusText = status === "danger" ? "DANGER" : "WARNING";
    const listedBlacklists = result.dnsbl.results.filter(r => r.listed).map(r => r.name);
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${status === "danger" ? "#dc2626" : "#f59e0b"}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .stat { display: inline-block; margin: 10px; padding: 15px; background: white; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; }
          .stat-label { font-size: 12px; color: #666; }
          .recommendation { padding: 10px; margin: 5px 0; background: white; border-left: 4px solid ${status === "danger" ? "#dc2626" : "#f59e0b"}; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${statusEmoji} Domain Reputation Alert: ${statusText}</h1>
            <p>Domain: <strong>${domain}</strong></p>
          </div>
          <div class="content">
            <h2>Summary</h2>
            <div>
              <div class="stat">
                <div class="stat-value">${result.dnsbl.listedCount}</div>
                <div class="stat-label">Blacklists</div>
              </div>
              ${result.virusTotal && !result.virusTotal.error ? `
              <div class="stat">
                <div class="stat-value" style="color: ${result.virusTotal.malicious > 0 ? '#dc2626' : '#22c55e'}">${result.virusTotal.malicious}</div>
                <div class="stat-label">VT Malicious</div>
              </div>
              <div class="stat">
                <div class="stat-value">${result.virusTotal.reputation}</div>
                <div class="stat-label">VT Reputation</div>
              </div>
              ` : ''}
            </div>
            
            ${listedBlacklists.length > 0 ? `
            <h3>Listed on Blacklists:</h3>
            <ul>
              ${listedBlacklists.map(bl => `<li>${bl}</li>`).join('')}
            </ul>
            ` : ''}
            
            <h3>Recommendations:</h3>
            ${result.recommendations.map(rec => `<div class="recommendation">${rec}</div>`).join('')}
            
            <div class="footer">
              <p>Checked at: ${new Date(result.checkedAt).toLocaleString()}</p>
              <p>This is an automated alert from your email system.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `${statusEmoji} Domain Reputation ${statusText}: ${domain}`;
    const encodedSubject = encodeSubject(subject);
    
    // Raw SMTP send
    const port = parseInt(emailConfig.smtpPort, 10) || 587;
    const conn = await Deno.connectTls({
      hostname: emailConfig.smtpHost,
      port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = conn.readable.getReader();
    const writer = conn.writable.getWriter();
    let buffer = "";

    const readLine = async (): Promise<string> => {
      while (!buffer.includes("\r\n")) {
        const { value, done } = await reader.read();
        if (done) throw new Error("Connection closed");
        buffer += decoder.decode(value);
      }
      const lineEnd = buffer.indexOf("\r\n");
      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 2);
      return line;
    };

    const readResponse = async (): Promise<number> => {
      let code = 0;
      while (true) {
        const line = await readLine();
        code = parseInt(line.slice(0, 3), 10);
        if (line.length >= 4 && line[3] !== "-") break;
      }
      return code;
    };

    const writeLine = async (line: string) => {
      await writer.write(encoder.encode(line + "\r\n"));
    };

    const command = async (cmd: string, expected: number[]) => {
      await writeLine(cmd);
      const code = await readResponse();
      if (!expected.includes(code)) throw new Error(`SMTP error: got ${code}`);
    };

    // SMTP handshake
    await readResponse(); // greeting
    await command("EHLO localhost", [250]);
    await command("AUTH LOGIN", [334]);
    await command(utf8ToBase64(emailConfig.smtpUsername), [334]);
    await command(utf8ToBase64(emailConfig.smtpPassword), [235]);

    // Send email
    await command(`MAIL FROM:<${emailConfig.senderEmail}>`, [250]);
    for (const to of adminEmails) {
      await command(`RCPT TO:<${to}>`, [250]);
    }
    await command("DATA", [354]);

    const encodedName = encodeSubject(emailConfig.senderName);
    const headers = [
      `From: ${encodedName} <${emailConfig.senderEmail}>`,
      `To: ${adminEmails.join(", ")}`,
      `Subject: ${encodedSubject}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
    ];
    for (const h of headers) await writeLine(h);
    await writeLine("");
    const bodyB64 = utf8ToBase64(emailHtml);
    const lines = bodyB64.match(/.{1,76}/g) || [];
    for (const l of lines) await writeLine(l);
    await command(".", [250]);

    try { await command("QUIT", [221]); } catch {}
    reader.releaseLock();
    writer.releaseLock();
    conn.close();

    console.log("Notification sent successfully via SMTP");
    
    // Log successful email for each recipient
    for (const recipientEmail of adminEmails) {
      await supabase.from("email_logs").insert({
        email_type: "domain_reputation_alert",
        recipient_email: recipientEmail,
        sender_email: emailConfig.senderEmail,
        sender_name: emailConfig.senderName,
        subject,
        html_body: emailHtml,
        status: "sent",
      });
    }
    
    // Log to activity log
    const activityRecordId = crypto.randomUUID();
    const emailTypeLabel = isTest ? "TEST " : "";
    await supabase.from("activity_logs").insert({
      action_type: "EMAIL_SENT",
      table_name: "domain_reputation",
      record_id: activityRecordId,
      field_name: "notification_email",
      old_value: null,
      new_value: status,
      description: `${emailTypeLabel}Domain reputation alert (${statusText}) sent to ${adminEmails.length} admin(s) for ${domain}: ${adminEmails.join(", ")}`,
    });
    
    return true;
  } catch (error: any) {
    console.error("Failed to send admin notification:", error);
    
    // Log failure
    const activityRecordId = crypto.randomUUID();
    const emailTypeLabel = isTest ? "TEST " : "";
    await supabase.from("activity_logs").insert({
      action_type: "EMAIL_FAILED",
      table_name: "domain_reputation",
      record_id: activityRecordId,
      field_name: "notification_email",
      old_value: null,
      new_value: status,
      description: `${emailTypeLabel}Domain reputation alert email failed: ${error.message || "Unknown error"}`,
    });
    
    return false;
  }
}

// Save result to history
async function saveToHistory(
  supabase: any,
  result: DomainReputationResult,
  notificationSent: boolean
) {
  try {
    const { error } = await supabase
      .from("domain_reputation_history")
      .insert({
        domain: result.domain,
        checked_at: result.checkedAt,
        overall_status: result.overallStatus,
        dnsbl_listed_count: result.dnsbl.listedCount,
        dnsbl_checked_count: result.dnsbl.checkedCount,
        vt_malicious: result.virusTotal?.malicious || 0,
        vt_suspicious: result.virusTotal?.suspicious || 0,
        vt_harmless: result.virusTotal?.harmless || 0,
        vt_reputation: result.virusTotal?.reputation || 0,
        recommendations: result.recommendations,
        full_result: result,
        notification_sent: notificationSent,
      });

    if (error) {
      console.error("Error saving to history:", error);
    } else {
      console.log("Saved reputation check to history");
    }
  } catch (error) {
    console.error("Failed to save history:", error);
  }
}

// Get previous status to compare
async function getPreviousStatus(supabase: any, domain: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("domain_reputation_history")
      .select("overall_status")
      .eq("domain", domain)
      .order("checked_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.overall_status;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, skipVirusTotal, skipNotification, testNotification } = await req.json();
    
    if (!domain) {
      return new Response(
        JSON.stringify({ error: "Domain is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for DB operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle test notification request
    if (testNotification) {
      console.log(`Sending test notification for domain: ${domain}`);
      
      const testResult: DomainReputationResult = {
        domain,
        checkedAt: new Date().toISOString(),
        dnsbl: {
          results: [
            { name: "Test Blacklist 1", server: "test1.example.com", description: "Test blacklist", listed: true },
            { name: "Test Blacklist 2", server: "test2.example.com", description: "Test blacklist", listed: false },
          ],
          listedCount: 1,
          checkedCount: 2,
        },
        virusTotal: {
          harmless: 70,
          malicious: 1,
          suspicious: 2,
          undetected: 10,
          timeout: 0,
          lastAnalysisDate: new Date().toISOString(),
          reputation: -5,
          categories: { "test-vendor": "test-category" },
        },
        overallStatus: "warning",
        recommendations: [
          "This is a TEST notification to verify the alert system is working.",
          "No action is required - this was manually triggered.",
        ],
      };

      const notificationSent = await sendAdminNotification(supabase, domain, "warning", testResult, true);
      
      return new Response(
        JSON.stringify({ 
          success: notificationSent, 
          message: notificationSent 
            ? "Test notification sent successfully to all admins" 
            : "Failed to send test notification - check RESEND_API_KEY and admin emails" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting domain reputation check for: ${domain}`);
    const checkedAt = new Date().toISOString();

    // Get previous status for comparison
    const previousStatus = await getPreviousStatus(supabase, domain);
    console.log(`Previous status: ${previousStatus || "none"}`);

    // Run DNSBL checks in parallel
    const dnsblPromises = DNSBL_SERVERS.map(server => checkDNSBL(domain, server));
    const dnsblResults = await Promise.all(dnsblPromises);
    
    const listedCount = dnsblResults.filter(r => r.listed).length;
    console.log(`DNSBL check complete: ${listedCount}/${dnsblResults.length} blacklists`);

    // Check VirusTotal
    let vtResult: VirusTotalResult | null = null;
    const vtApiKey = Deno.env.get("VIRUSTOTAL_API_KEY");
    
    if (!skipVirusTotal && vtApiKey) {
      vtResult = await checkVirusTotal(domain, vtApiKey);
      console.log("VirusTotal check complete:", vtResult);
    } else if (!vtApiKey) {
      console.log("VirusTotal API key not configured, skipping");
    }

    // Calculate overall status
    let overallStatus: "clean" | "warning" | "danger" | "error" = "clean";
    
    if (vtResult?.malicious && vtResult.malicious > 0) {
      overallStatus = "danger";
    } else if (listedCount > 2 || (vtResult?.suspicious && vtResult.suspicious > 0)) {
      overallStatus = "danger";
    } else if (listedCount > 0 || (vtResult?.reputation !== undefined && vtResult.reputation < 0)) {
      overallStatus = "warning";
    }

    // Generate recommendations
    const recommendations = generateRecommendations(dnsblResults, vtResult);

    const result: DomainReputationResult = {
      domain,
      checkedAt,
      dnsbl: {
        results: dnsblResults,
        listedCount,
        checkedCount: dnsblResults.length,
      },
      virusTotal: vtResult,
      overallStatus,
      recommendations,
    };

    // Send notification if status is warning/danger AND status changed
    let notificationSent = false;
    if (!skipNotification && (overallStatus === "warning" || overallStatus === "danger")) {
      // Only notify if status changed to warning/danger from clean
      if (previousStatus !== overallStatus && previousStatus !== "warning" && previousStatus !== "danger") {
        notificationSent = await sendAdminNotification(supabase, domain, overallStatus, result, false);
      } else if (!previousStatus) {
        // First check ever, notify if not clean
        notificationSent = await sendAdminNotification(supabase, domain, overallStatus, result, false);
      }
    }

    result.notificationSent = notificationSent;

    // Save to history
    await saveToHistory(supabase, result, notificationSent);

    console.log(`Domain reputation check complete for ${domain}: ${overallStatus}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Domain reputation check error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
