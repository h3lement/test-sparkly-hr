import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
}

// Reverse IP for DNSBL lookup
function reverseDomain(domain: string): string {
  // For domain lookups, we just use the domain as-is
  return domain;
}

// Check domain against a single DNSBL
async function checkDNSBL(domain: string, dnsbl: { name: string; server: string; description: string }): Promise<DNSBLResult> {
  try {
    const lookupDomain = `${reverseDomain(domain)}.${dnsbl.server}`;
    console.log(`Checking DNSBL: ${lookupDomain}`);
    
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(lookupDomain)}&type=A`);
    const data = await response.json();
    
    // If we get an answer, the domain is listed
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
  
  // Check DNSBL listings
  const listedCount = dnsblResults.filter(r => r.listed).length;
  if (listedCount > 0) {
    recommendations.push(`Your domain is listed on ${listedCount} blacklist(s). Consider contacting these services to request delisting.`);
    
    const listedServices = dnsblResults.filter(r => r.listed).map(r => r.name);
    if (listedServices.includes("Spamhaus ZEN") || listedServices.includes("Spamhaus DBL")) {
      recommendations.push("Spamhaus listing is critical - many email providers use this. Visit spamhaus.org to request removal.");
    }
  }
  
  // Check VirusTotal results
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
  
  // General recommendations if clean
  if (recommendations.length === 0) {
    recommendations.push("Your domain has a clean reputation across all checked sources.");
    recommendations.push("Continue monitoring regularly to maintain good deliverability.");
  }
  
  return recommendations;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, skipVirusTotal } = await req.json();
    
    if (!domain) {
      return new Response(
        JSON.stringify({ error: "Domain is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting domain reputation check for: ${domain}`);
    const checkedAt = new Date().toISOString();

    // Run DNSBL checks in parallel
    const dnsblPromises = DNSBL_SERVERS.map(server => checkDNSBL(domain, server));
    const dnsblResults = await Promise.all(dnsblPromises);
    
    const listedCount = dnsblResults.filter(r => r.listed).length;
    console.log(`DNSBL check complete: ${listedCount}/${dnsblResults.length} blacklists`);

    // Check VirusTotal if API key is available and not skipped
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
