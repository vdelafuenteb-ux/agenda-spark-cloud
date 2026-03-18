import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GMAIL_USER = Deno.env.get("GMAIL_USER");
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "Gmail credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to_email, to_name, topic_title, subtasks } = await req.json();

    if (!to_email || !topic_title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to_email, topic_title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email body
    const pendingSubtasks = (subtasks || []).filter((s: any) => !s.completed);
    let body = `Hola ${to_name || ""},\n\nTe escribimos para recordarte sobre la tarea: "${topic_title}".\n\n`;

    if (pendingSubtasks.length > 0) {
      body += "Subtareas pendientes:\n";
      pendingSubtasks.forEach((s: any, i: number) => {
        body += `  ${i + 1}. ${s.title}${s.due_date ? ` (vence: ${s.due_date})` : ""}\n`;
      });
      body += "\n";
    }

    body += "Por favor actualiza sobre el estado de esta tarea.\n\nGracias.";

    // Send via Gmail SMTP using fetch to a simple SMTP relay
    // Using Deno's built-in SMTP via denopkg
    const emailPayload = {
      from: GMAIL_USER,
      to: to_email,
      subject: `Recordatorio: ${topic_title}`,
      text: body,
    };

    // Use Gmail SMTP via base64 encoded credentials
    const credentials = btoa(`${GMAIL_USER}:${GMAIL_APP_PASSWORD}`);

    // Send using Gmail's SMTP relay via Deno smtp
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: GMAIL_USER,
          password: GMAIL_APP_PASSWORD,
        },
      },
    });

    await client.send({
      from: GMAIL_USER,
      to: to_email,
      subject: `Recordatorio: ${topic_title}`,
      content: body,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
