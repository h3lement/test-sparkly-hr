import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailLogRecord {
  id: string;
  email_type: string;
  recipient_email: string;
  sender_email: string;
  sender_name: string;
  subject: string;
  status: string;
  resend_id: string | null;
  error_message: string | null;
  language: string | null;
  quiz_lead_id: string | null;
  created_at: string;
  resend_attempts: number;
  last_attempt_at: string | null;
  original_log_id: string | null;
  html_body: string | null;
}

function parseCSVLine(line: string, delimiter: string = ";"): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

function parseMultiLineCSV(content: string, delimiter: string = ";"): string[][] {
  const rows: string[][] = [];
  const lines = content.split("\n");
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let fieldIndex = 0;
  
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        currentRow.push(currentField);
        currentField = "";
        fieldIndex++;
      } else {
        currentField += char;
      }
    }
    
    if (inQuotes) {
      currentField += "\n";
    } else {
      currentRow.push(currentField);
      if (currentRow.length > 0 && currentRow[0] !== "") {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
      fieldIndex = 0;
    }
  }
  
  return rows;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvContent } = await req.json();
    
    if (!csvContent) {
      return new Response(
        JSON.stringify({ error: "CSV content is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Parsing CSV content...");
    const rows = parseMultiLineCSV(csvContent);
    
    // Skip header row
    const dataRows = rows.slice(1);
    console.log(`Found ${dataRows.length} records to import`);

    const records: EmailLogRecord[] = [];
    let parseErrors = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      if (row.length < 16) {
        console.log(`Skipping row ${i + 1}: insufficient columns (${row.length})`);
        parseErrors++;
        continue;
      }

      try {
        const record: EmailLogRecord = {
          id: row[0],
          email_type: row[1],
          recipient_email: row[2],
          sender_email: row[3],
          sender_name: row[4],
          subject: row[5],
          status: row[6],
          resend_id: row[7] || null,
          error_message: row[8] || null,
          language: row[9] || null,
          quiz_lead_id: row[10] || null,
          created_at: row[11],
          resend_attempts: parseInt(row[12]) || 0,
          last_attempt_at: row[13] || null,
          original_log_id: row[14] || null,
          html_body: row[15] || null,
        };

        // Validate required fields
        if (record.id && record.email_type && record.recipient_email && record.sender_email && record.sender_name && record.subject && record.status && record.created_at) {
          records.push(record);
        } else {
          console.log(`Skipping row ${i + 1}: missing required fields`);
          parseErrors++;
        }
      } catch (e) {
        console.log(`Error parsing row ${i + 1}:`, e);
        parseErrors++;
      }
    }

    console.log(`Parsed ${records.length} valid records, ${parseErrors} errors`);

    // Get all existing quiz_lead_ids to validate foreign keys
    const quizLeadIds = [...new Set(records.map(r => r.quiz_lead_id).filter(Boolean))];
    const { data: existingLeads } = await supabase
      .from("quiz_leads")
      .select("id")
      .in("id", quizLeadIds);
    
    const validLeadIds = new Set((existingLeads || []).map(l => l.id));
    console.log(`Found ${validLeadIds.size} valid quiz_lead_ids out of ${quizLeadIds.length}`);

    // Nullify quiz_lead_id if it doesn't exist in quiz_leads table
    const cleanedRecords = records.map(record => ({
      ...record,
      quiz_lead_id: record.quiz_lead_id && validLeadIds.has(record.quiz_lead_id) 
        ? record.quiz_lead_id 
        : null
    }));

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < cleanedRecords.length; i += batchSize) {
      const batch = cleanedRecords.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from("email_logs")
        .upsert(batch, { onConflict: "id" });

      if (error) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, error);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        inserted += batch.length;
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalParsed: records.length,
        inserted,
        parseErrors,
        errors,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
