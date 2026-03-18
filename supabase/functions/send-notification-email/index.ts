const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIREBASE_EMAIL_URL = "https://us-central1-sistemattransit.cloudfunctions.net/correoAdministracion";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.99.2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Supabase anon key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to_email, to_name, topic_title, subtasks, start_date, due_date, progress_entries } = await req.json();

    if (!to_email || !topic_title) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: to_email, topic_title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build HTML email body
    let mensaje = `<p>Hola ${to_name || ""},</p>`;
    mensaje += `<p><strong>Te recordamos el siguiente tema</strong> para que por favor puedas <strong>responder sobre este correo y actualizar</strong> el estado:</p>`;
    mensaje += `<h3>${topic_title}</h3>`;

    // Dates
    if (start_date || due_date) {
      mensaje += `<p style="color:#555;">`;
      if (start_date) mensaje += `📅 Inicio: <strong>${formatDate(start_date)}</strong>`;
      if (start_date && due_date) mensaje += ` &nbsp;|&nbsp; `;
      if (due_date) mensaje += `⏰ Vencimiento: <strong>${formatDate(due_date)}</strong>`;
      mensaje += `</p>`;
    }

    // Pending subtasks
    const pendingSubtasks = (subtasks || []).filter((s: any) => !s.completed);
    if (pendingSubtasks.length > 0) {
      mensaje += `<p><strong>Subtareas pendientes:</strong></p><ul>`;
      pendingSubtasks.forEach((s: any) => {
        mensaje += `<li>${s.title}`;
        if (s.due_date) mensaje += ` <em>(vence: ${formatDate(s.due_date)})</em>`;
        if (s.notes) mensaje += `<br/><span style="color:#666;font-size:0.9em;">📝 ${s.notes}</span>`;
        mensaje += `</li>`;
      });
      mensaje += `</ul>`;
    }

    // Progress entries (last 5)
    const entries = (progress_entries || []).slice(0, 5);
    if (entries.length > 0) {
      mensaje += `<p><strong>Últimas notas de bitácora:</strong></p><ul style="color:#555;">`;
      entries.forEach((e: any) => {
        const dateStr = e.created_at ? formatDate(e.created_at) : "";
        mensaje += `<li>${e.content}${dateStr ? ` <em style="color:#999;">(${dateStr})</em>` : ""}</li>`;
      });
      mensaje += `</ul>`;
    }

    mensaje += `<p style="font-size:1.1em;"><strong>⚠️ IMPORTANTE: Por favor responde a este correo actualizando sobre este tema.</strong></p>`;
    mensaje += `<p style="font-size:1.1em;"><strong>🕐 Plazo máximo de respuesta: 48 HORAS.</strong></p>`;
    mensaje += `<p><strong>No olvides responder a todos</strong> para que tu respuesta llegue a todo el equipo.</p>`;
    mensaje += `<p>Gracias.</p>`;

    const CC_EMAILS = ["matias@transitglobalgroup.com", "vicente@transitglobalgroup.com"];

    const response = await fetch(FIREBASE_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        para: to_email,
        asunto: `Recordatorio: ${topic_title}`,
        mensaje: mensaje,
      }),
    });

    await Promise.allSettled(
      CC_EMAILS
        .filter((cc) => cc.toLowerCase() !== to_email.toLowerCase())
        .map((cc) =>
          fetch(FIREBASE_EMAIL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              para: cc,
              asunto: `[CC] Recordatorio: ${topic_title}`,
              mensaje: mensaje,
            }),
          })
        )
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Firebase email API failed [${response.status}]`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending notification email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
