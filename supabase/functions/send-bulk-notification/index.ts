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

    const { to_email, to_name, topics } = await req.json();

    if (!to_email || !topics || !Array.isArray(topics) || topics.length === 0) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: to_email, topics[]" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build executive HTML email body with summary table
    const topicsWithPending = topics.map((topic: any, index: number) => {
      const pending = (topic.subtasks || []).filter((s: any) => !s.completed);
      return { ...topic, pendingSubtasks: pending, num: index + 1 };
    });

    let mensaje = `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">`;
    mensaje += `<p>Hola ${to_name || ""},</p>`;
    mensaje += `<p>Tienes <strong>${topics.length} tema${topics.length > 1 ? "s" : ""}</strong> pendiente${topics.length > 1 ? "s" : ""} de actualizar. <strong>Responde este correo</strong> con el estado de cada uno.</p>`;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Topic cards (mobile-friendly)
    topicsWithPending.forEach((t: any) => {
      const pendingText = t.pendingSubtasks.length > 0
        ? `${t.pendingSubtasks.length} subtarea${t.pendingSubtasks.length > 1 ? "s" : ""}`
        : "Sin pendientes";
      const pendingColor = t.pendingSubtasks.length > 0 ? "#c0392b" : "#888";
      const isOverdue = t.due_date && new Date(t.due_date) < now;
      const cardBorder = isOverdue ? "border-left:4px solid #c0392b;" : "border-left:4px solid #3498db;";
      const titleColor = isOverdue ? "color:#c0392b;" : "color:#2c3e50;";
      const lastEntry = (t.progress_entries || []).length > 0 ? (t.progress_entries || [])[0]?.content || "" : "";

      mensaje += `<div style="margin:10px 0;padding:10px 14px;background:#f8f9fa;border-radius:6px;${cardBorder}">`;
      mensaje += `<p style="margin:0 0 6px;font-size:14px;font-weight:700;${titleColor}">${t.num}. ${t.title}</p>`;
      mensaje += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
      mensaje += `<tr><td style="padding:3px 0;color:#888;width:110px;">Inicio</td><td style="padding:3px 0;">${formatDate(t.start_date) || "—"}</td></tr>`;
      mensaje += `<tr><td style="padding:3px 0;color:#888;">Vencimiento</td><td style="padding:3px 0;">${formatDate(t.due_date) || "—"}</td></tr>`;
      mensaje += `<tr><td style="padding:3px 0;color:#888;">Pendientes</td><td style="padding:3px 0;color:${pendingColor};">${pendingText}</td></tr>`;
      if (lastEntry) {
        mensaje += `<tr><td style="padding:3px 0;color:#888;vertical-align:top;">Último avance</td><td style="padding:3px 0;color:#555;font-size:12px;word-wrap:break-word;">${lastEntry}</td></tr>`;
      }
      mensaje += `</table>`;
      mensaje += `</div>`;
    });

    mensaje += `<p style="font-size:11px;color:#999;margin:4px 0 12px;">🔴 Las tarjetas con borde rojo indican temas con fecha vencida.</p>`;

    // Detail section — only topics with pending subtasks
    const withPending = topicsWithPending.filter((t: any) => t.pendingSubtasks.length > 0);
    if (withPending.length > 0) {
      mensaje += `<p style="margin-top:12px;"><strong>Subtareas pendientes:</strong></p>`;
      withPending.forEach((t: any) => {
        mensaje += `<p style="margin:8px 0 2px;"><strong>${t.num}. ${t.title}</strong></p><ul style="margin:0;padding-left:20px;">`;
        t.pendingSubtasks.forEach((s: any) => {
          mensaje += `<li style="margin-bottom:4px;">${s.title}`;
          if (s.due_date) mensaje += ` <em style="color:#888;">(vence: ${formatDate(s.due_date)})</em>`;
          mensaje += `</li>`;
        });
        mensaje += `</ul>`;
      });
    }

    mensaje += `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0 12px;"/>`;
    mensaje += `<p><strong>⚠️ Responde actualizando CADA tema. Plazo máximo: 48 HORAS.</strong></p>`;
    mensaje += `<p><strong>No olvides responder a todos</strong> para que tu respuesta llegue a todo el equipo.</p>`;
    mensaje += `</div>`;

    const asunto = `🚨 ${topics.length} TEMA${topics.length > 1 ? "S" : ""} ACTIVO${topics.length > 1 ? "S" : ""} — ¡Actualizar a la brevedad! | Máx. 48 hrs para responder`;

    const CC_EMAILS = ["matias@transitglobalgroup.com", "vicente@transitglobalgroup.com"]
      .filter((cc) => cc.toLowerCase() !== to_email.toLowerCase());

    const response = await fetch(FIREBASE_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ para: to_email, asunto, mensaje, cc: CC_EMAILS }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Firebase email API failed [${response.status}]`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending bulk notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
