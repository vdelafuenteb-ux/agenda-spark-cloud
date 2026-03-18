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

    let mensaje = `<p>Hola ${to_name || ""},</p>`;
    mensaje += `<p>Tienes <strong>${topics.length} tema${topics.length > 1 ? "s" : ""}</strong> pendiente${topics.length > 1 ? "s" : ""} de actualizar. <strong>Responde este correo</strong> con el estado de cada uno.</p>`;

    // Summary table
    mensaje += `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;table-layout:fixed;">`;
    mensaje += `<thead><tr style="background-color:#f2f2f2;text-align:left;">`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:28px;">#</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:20%;">Tema</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;">Último comentario</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:80px;">Inicio</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:80px;">Vencimiento</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:90px;">Pendientes</th>`;
    mensaje += `</tr></thead><tbody>`;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    topicsWithPending.forEach((t: any) => {
      const pendingText = t.pendingSubtasks.length > 0
        ? `${t.pendingSubtasks.length} subtarea${t.pendingSubtasks.length > 1 ? "s" : ""}`
        : "Sin pendientes";
      const pendingColor = t.pendingSubtasks.length > 0 ? "#c0392b" : "#888";
      const isOverdue = t.due_date && new Date(t.due_date) < now;
      const rowBg = isOverdue ? "background-color:#fff5f5;" : "";
      const rowColor = isOverdue ? "color:#c0392b;" : "";
      const lastEntry = (t.progress_entries || []).length > 0 ? (t.progress_entries || [])[0]?.content || "" : "";
      const truncated = lastEntry;
      mensaje += `<tr style="${rowBg}${rowColor}">`;
      mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">${t.num}</td>`;
      mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;font-weight:600;">${t.title}</td>`;
      mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;${isOverdue ? '' : 'color:#555;'}font-size:13px;word-wrap:break-word;">${truncated || "<em style='color:#aaa;'>—</em>"}</td>`;
      mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;">${formatDate(t.start_date) || "—"}</td>`;
      mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;">${formatDate(t.due_date) || "—"}</td>`;
      mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;color:${pendingColor};">${pendingText}</td>`;
      mensaje += `</tr>`;
    });
    mensaje += `</tbody></table>`;
    mensaje += `<p style="font-size:12px;color:#999;margin:0 0 16px;">🔴 Las filas en rojo indican temas con fecha de vencimiento ya pasada.</p>`;

    // Detail section — only topics with pending subtasks
    const withPending = topicsWithPending.filter((t: any) => t.pendingSubtasks.length > 0);
    if (withPending.length > 0) {
      mensaje += `<p style="margin-top:16px;"><strong>Detalle de subtareas pendientes:</strong></p>`;
      withPending.forEach((t: any) => {
        mensaje += `<p style="margin:8px 0 2px;"><strong>${t.num}. ${t.title}</strong></p><ul style="margin:0;">`;
        t.pendingSubtasks.forEach((s: any) => {
          mensaje += `<li>${s.title}`;
          if (s.due_date) mensaje += ` <em style="color:#888;">(vence: ${formatDate(s.due_date)})</em>`;
          mensaje += `</li>`;
        });
        mensaje += `</ul>`;
      });
    }

    mensaje += `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0 12px;"/>`;
    mensaje += `<p><strong>⚠️ Responde actualizando CADA tema. Plazo máximo: 48 HORAS.</strong></p>`;
    mensaje += `<p><strong>No olvides responder a todos</strong> para que tu respuesta llegue a todo el equipo.</p>`;

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
