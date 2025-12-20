import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuizLeadRecord {
  id: string;
  email: string;
  score: number;
  total_questions: number;
  result_category: string;
  answers: any | null;
  created_at: string;
  openness_score: number | null;
  language: string | null;
  quiz_id?: string | null;
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
    const lines = csvContent.split("\n").filter((line: string) => line.trim());
    
    // Skip header row
    const dataLines = lines.slice(1);
    console.log(`Found ${dataLines.length} records to import`);

    const records: QuizLeadRecord[] = [];
    let parseErrors = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const row = parseCSVLine(dataLines[i]);
      
      if (row.length < 9) {
        console.log(`Skipping row ${i + 1}: insufficient columns (${row.length})`);
        parseErrors++;
        continue;
      }

      try {
        // Parse answers JSON if present
        let answersData = null;
        if (row[5] && row[5].trim()) {
          try {
            answersData = JSON.parse(row[5]);
          } catch {
            // If not valid JSON, store as null
            answersData = null;
          }
        }

        const record: QuizLeadRecord = {
          id: row[0],
          email: row[1],
          score: parseInt(row[2]) || 0,
          total_questions: parseInt(row[3]) || 0,
          result_category: row[4],
          answers: answersData,
          created_at: row[6],
          openness_score: row[7] ? parseInt(row[7]) : null,
          language: row[8] || null,
        };

        // Validate required fields
        if (record.id && record.email && record.result_category && record.created_at) {
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

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from("quiz_leads")
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
