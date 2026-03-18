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

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const pendingSubtasks = (subtasks || []).filter((s: any) => !s.completed);
    const entries = (progress_entries || []).slice(0, 5);
    const lastEntry = entries.length > 0 ? entries[0]?.content || "" : "";
    const truncated = lastEntry;
    const pendingCount = pendingSubtasks.length;
    const pendingText = pendingCount > 0
      ? `${pendingCount} subtarea${pendingCount > 1 ? "s" : ""}`
      : "Sin pendientes";
    const pendingColor = pendingCount > 0 ? "#c0392b" : "#888";
    const isOverdue = due_date && new Date(due_date) < now;
    const rowBg = isOverdue ? "background-color:#fff5f5;" : "";
    const rowColor = isOverdue ? "color:#c0392b;" : "";

    // Build executive HTML email body with summary table (same format as bulk)
    let mensaje = `<p>Hola ${to_name || ""},</p>`;
    mensaje += `<p>Tienes <strong>1 tema</strong> pendiente de actualizar. <strong>Responde este correo</strong> con el estado.</p>`;

    // Summary table
    mensaje += `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">`;
    mensaje += `<thead><tr style="background-color:#f2f2f2;text-align:left;">`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:30px;">#</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;">Tema</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;">Último comentario</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:90px;">Inicio</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:90px;">Vencimiento</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:110px;">Pendientes</th>`;
    mensaje += `</tr></thead><tbody>`;

    mensaje += `<tr style="${rowBg}${rowColor}">`;
    mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">1</td>`;
    mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;font-weight:600;">${topic_title}</td>`;
    mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;${isOverdue ? '' : 'color:#555;'}font-size:13px;">${truncated || "<em style='color:#aaa;'>—</em>"}</td>`;
    mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;">${formatDate(start_date) || "—"}</td>`;
    mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;">${formatDate(due_date) || "—"}</td>`;
    mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;color:${pendingColor};">${pendingText}</td>`;
    mensaje += `</tr>`;
    mensaje += `</tbody></table>`;

    if (isOverdue) {
      mensaje += `<p style="font-size:12px;color:#999;margin:0 0 16px;">🔴 La fila en rojo indica que el tema tiene fecha de vencimiento ya pasada.</p>`;
    }

    // Detail section — pending subtasks
    if (pendingCount > 0) {
      mensaje += `<p style="margin-top:16px;"><strong>Detalle de subtareas pendientes:</strong></p>`;
      mensaje += `<p style="margin:8px 0 2px;"><strong>1. ${topic_title}</strong></p><ul style="margin:0;">`;
      pendingSubtasks.forEach((s: any) => {
        mensaje += `<li>${s.title}`;
        if (s.due_date) mensaje += ` <em style="color:#888;">(vence: ${formatDate(s.due_date)})</em>`;
        if (s.notes) mensaje += `<br/><span style="color:#666;font-size:0.9em;">📝 ${s.notes}</span>`;
        mensaje += `</li>`;
      });
      mensaje += `</ul>`;
    }

    mensaje += `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0 12px;"/>`;
    mensaje += `<p><strong>⚠️ Responde actualizando CADA tema. Plazo máximo: 48 HORAS.</strong></p>`;
    mensaje += `<p><strong>No olvides responder a todos</strong> para que tu respuesta llegue a todo el equipo.</p>`;

    const CC_EMAILS = ["matias@transitglobalgroup.com", "vicente@transitglobalgroup.com"]
      .filter((cc) => cc.toLowerCase() !== to_email.toLowerCase());

    const response = await fetch(FIREBASE_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        para: to_email,
        asunto: `⚠️ URGENTE: "${topic_title}" — Actualizar a la brevedad | 48 hrs para responder`,
        mensaje: mensaje,
        cc: CC_EMAILS,
      }),
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
    console.error("Error sending notification email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
