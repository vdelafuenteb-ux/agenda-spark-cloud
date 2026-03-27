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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Supabase anon key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth client to get user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for update_tokens
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { to_email, to_name, topic_title, topic_id, start_date, due_date, subtasks, is_urgent, days_until_due, initial_note } = await req.json();

    if (!to_email || !topic_title) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: to_email, topic_title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create update token with topic_id for this specific topic
    let updateToken: string | null = null;
    if (topic_id && to_name) {
      const { data: tokenRow } = await supabase
        .from("update_tokens")
        .insert({
          user_id: user.id,
          assignee_name: to_name,
          topic_id: topic_id,
        })
        .select("token")
        .single();
      if (tokenRow) updateToken = tokenRow.token;
    }

    const APP_URL = "https://project-zenflow-66.lovable.app";

    const pendingSubtasks = (subtasks || []).filter((s: any) => !s.completed);
    const pendingCount = pendingSubtasks.length;

    // Build informational HTML email
    let asunto: string;
    if (is_urgent) {
      asunto = `⚠️ Nuevo tema URGENTE agregado — vence en ${days_until_due} día${days_until_due !== 1 ? "s" : ""}`;
    } else {
      asunto = `📋 Nuevo tema agregado a tu listado de seguimiento`;
    }

    let mensaje = `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">`;
    mensaje += `<p>Hola ${to_name || ""},</p>`;

    if (is_urgent) {
      mensaje += `<p style="color:#c0392b;font-weight:bold;">⚠️ Se ha agregado un nuevo tema a tu listado de seguimiento que requiere atención urgente (vence en ${days_until_due} día${days_until_due !== 1 ? "s" : ""}).</p>`;
    } else {
      mensaje += `<p>Se ha agregado un nuevo tema a tu listado de seguimiento para que lo tengas en consideración. Este tema aparecerá en tu reporte del próximo lunes.</p>`;
    }

    // Topic detail card (mobile-friendly)
    const isOverdue = due_date && new Date(due_date) < new Date(new Date().toDateString());
    const cardBorder = isOverdue ? "border-left:4px solid #c0392b;" : "border-left:4px solid #3498db;";
    const titleColor = isOverdue ? "color:#c0392b;" : "color:#2c3e50;";

    mensaje += `<div style="margin:16px 0;padding:12px 16px;background:#f8f9fa;border-radius:6px;${cardBorder}">`;
    mensaje += `<p style="margin:0 0 8px;font-size:16px;font-weight:700;${titleColor}">${topic_title}</p>`;
    mensaje += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
    mensaje += `<tr><td style="padding:4px 0;color:#888;width:100px;">Inicio</td><td style="padding:4px 0;font-weight:500;">${formatDate(start_date) || "—"}</td></tr>`;
    mensaje += `<tr><td style="padding:4px 0;color:#888;">Vencimiento</td><td style="padding:4px 0;font-weight:500;">${formatDate(due_date) || "—"}</td></tr>`;
    mensaje += `<tr><td style="padding:4px 0;color:#888;">Subtareas</td><td style="padding:4px 0;font-weight:500;">${pendingCount > 0 ? `${pendingCount} pendiente${pendingCount > 1 ? "s" : ""}` : "Sin subtareas"}</td></tr>`;
    mensaje += `</table>`;
    mensaje += `</div>`;

    // Pending subtasks detail
    if (pendingCount > 0) {
      mensaje += `<p style="margin-top:16px;"><strong>Subtareas:</strong></p><ul style="margin:0;padding-left:20px;">`;
      pendingSubtasks.forEach((s: any) => {
        mensaje += `<li style="margin-bottom:4px;">${s.title}`;
        if (s.due_date) mensaje += ` <em style="color:#888;">(vence: ${formatDate(s.due_date)})</em>`;
        mensaje += `</li>`;
      });
      mensaje += `</ul>`;
    }

    // Initial note / bitácora
    if (initial_note) {
      const formattedNote = initial_note.replace(/\n/g, '<br>');
      mensaje += `<div style="margin:16px 0;padding:12px 16px;background:#f8f9fa;border-left:3px solid #6c757d;border-radius:4px;">`;
      mensaje += `<p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#555;text-transform:uppercase;">📝 Detalle / Instrucciones</p>`;
      mensaje += `<p style="margin:0;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;">${formattedNote}</p>`;
      mensaje += `</div>`;
    }

    // Update link button
    if (updateToken) {
      mensaje += `<div style="margin:20px 0;text-align:center;">`;
      mensaje += `<a href="${APP_URL}/update/${updateToken}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">📝 Actualizar este tema</a>`;
      mensaje += `</div>`;
      mensaje += `<p style="font-size:12px;color:#999;text-align:center;">Este link es de uso único. Una vez envíes tu actualización, expirará automáticamente.</p>`;
    }

    mensaje += `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0 12px;"/>`;

    if (is_urgent) {
      mensaje += `<p><strong>⚠️ Este tema es urgente. Por favor revísalo a la brevedad.</strong></p>`;
    } else {
      mensaje += `<p style="font-size:13px;color:#666;">Este correo es informativo. El detalle completo lo recibirás en el reporte del próximo lunes.</p>`;
    }

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
        asunto,
        mensaje,
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
        result?.error || result?.message || responseText || `Firebase email API failed [${response.status}]`
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending new topic notification:", error);
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
