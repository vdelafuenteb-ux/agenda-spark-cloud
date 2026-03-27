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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to_email, to_name, topic_title, subtasks, start_date, due_date, progress_entries, topic_id } = await req.json();

    if (!to_email || !topic_title) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: to_email, topic_title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create/reuse update token for this assignee
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient: createServiceClient } = await import("https://esm.sh/@supabase/supabase-js@2.99.2");
    const serviceSupabase = createServiceClient(supabaseUrl, serviceRoleKey);

    // Get user_id from authenticated user
    const userId = user.id;

    // Check for existing valid token
    let updateToken = "";
    const { data: existingToken } = await serviceSupabase
      .from("update_tokens")
      .select("token, expires_at")
      .eq("user_id", userId)
      .eq("assignee_name", to_name || "")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .single();

    if (existingToken) {
      updateToken = existingToken.token;
    } else {
      const { data: newToken } = await serviceSupabase
        .from("update_tokens")
        .insert({ user_id: userId, assignee_name: to_name || "" })
        .select("token")
        .single();
      updateToken = newToken?.token || "";
    }

    const APP_URL = "https://project-zenflow-66.lovable.app";

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

    // Build mobile-friendly HTML email
    let mensaje = `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">`;
    mensaje += `<p>Hola ${to_name || ""},</p>`;
    mensaje += `<p>Tienes <strong>1 tema</strong> pendiente de actualizar. <strong>Responde este correo</strong> con el estado.</p>`;

    // Topic card
    const cardBorder = isOverdue ? "border-left:4px solid #c0392b;" : "border-left:4px solid #3498db;";
    const titleColor = isOverdue ? "color:#c0392b;" : "color:#2c3e50;";

    mensaje += `<div style="margin:12px 0;padding:12px 16px;background:#f8f9fa;border-radius:6px;${cardBorder}">`;
    mensaje += `<p style="margin:0 0 8px;font-size:15px;font-weight:700;${titleColor}">1. ${topic_title}</p>`;
    mensaje += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
    mensaje += `<tr><td style="padding:3px 0;color:#888;width:110px;">Inicio</td><td style="padding:3px 0;">${formatDate(start_date) || "—"}</td></tr>`;
    mensaje += `<tr><td style="padding:3px 0;color:#888;">Vencimiento</td><td style="padding:3px 0;">${formatDate(due_date) || "—"}</td></tr>`;
    mensaje += `<tr><td style="padding:3px 0;color:#888;">Pendientes</td><td style="padding:3px 0;color:${pendingColor};">${pendingText}</td></tr>`;
    if (truncated) {
      mensaje += `<tr><td style="padding:3px 0;color:#888;vertical-align:top;">Último avance</td><td style="padding:3px 0;color:#555;font-size:12px;word-wrap:break-word;">${truncated}</td></tr>`;
    }
    mensaje += `</table>`;
    mensaje += `</div>`;

    if (isOverdue) {
      mensaje += `<p style="font-size:12px;color:#c0392b;margin:0 0 12px;">🔴 Este tema tiene fecha de vencimiento ya pasada.</p>`;
    }

    // Detail section — pending subtasks
    if (pendingCount > 0) {
      mensaje += `<p style="margin-top:12px;"><strong>Subtareas pendientes:</strong></p>`;
      mensaje += `<ul style="margin:0;padding-left:20px;">`;
      pendingSubtasks.forEach((s: any) => {
        mensaje += `<li style="margin-bottom:4px;">${s.title}`;
        if (s.due_date) mensaje += ` <em style="color:#888;">(vence: ${formatDate(s.due_date)})</em>`;
        if (s.notes) mensaje += `<br/><span style="color:#666;font-size:12px;">📝 ${s.notes}</span>`;
        mensaje += `</li>`;
      });
      mensaje += `</ul>`;
    }

    mensaje += `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0 12px;"/>`;

    if (updateToken) {
      mensaje += `<div style="text-align:center;margin:16px 0;">`;
      mensaje += `<a href="${APP_URL}/update/${updateToken}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">📝 Actualizar mis temas</a>`;
      mensaje += `</div>`;
    }

    mensaje += `<p><strong>⚠️ Responde actualizando CADA tema. Plazo máximo: 48 HORAS.</strong></p>`;
    mensaje += `<p><strong>No olvides responder a todos</strong> para que tu respuesta llegue a todo el equipo.</p>`;
    mensaje += `</div>`;

    const CC_EMAILS = ["matias@transitglobalgroup.com", "vicente@transitglobalgroup.com"]
      .filter((cc) => cc.toLowerCase() !== to_email.toLowerCase());

    const response = await fetch(FIREBASE_EMAIL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain;q=0.9, */*;q=0.8",
      },
      body: JSON.stringify({
        para: to_email,
        asunto: `🚨 1 TEMA ACTIVO — ¡Actualizar a la brevedad! | Máx. 48 hrs para responder`,
        mensaje: mensaje,
        cc: CC_EMAILS,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const responseText = await response.text();
    const contentType = response.headers.get("content-type") || "";
    let result: any = null;

    if (contentType.includes("application/json") && responseText) {
      try {
        result = JSON.parse(responseText);
      } catch {
        result = null;
      }
    }

    if (!response.ok) {
      throw new Error(
        result?.error ||
        result?.message ||
        responseText ||
        `Firebase email API failed [${response.status}]`
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending notification email:", error);
    const errorMessage = error instanceof DOMException && error.name === "TimeoutError"
      ? "El servicio de correo tardó demasiado en responder"
      : error instanceof Error
        ? error.message
        : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
