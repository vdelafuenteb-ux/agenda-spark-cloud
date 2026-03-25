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

    const { to_email, to_name, topic_title, start_date, due_date, subtasks, is_urgent, days_until_due } = await req.json();

    if (!to_email || !topic_title) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: to_email, topic_title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pendingSubtasks = (subtasks || []).filter((s: any) => !s.completed);
    const pendingCount = pendingSubtasks.length;

    // Build informational HTML email
    let asunto: string;
    if (is_urgent) {
      asunto = `⚠️ Nuevo tema URGENTE agregado — vence en ${days_until_due} día${days_until_due !== 1 ? "s" : ""}`;
    } else {
      asunto = `📋 Nuevo tema agregado a tu listado de seguimiento`;
    }

    let mensaje = `<p>Hola ${to_name || ""},</p>`;

    if (is_urgent) {
      mensaje += `<p style="color:#c0392b;font-weight:bold;">⚠️ Se ha agregado un nuevo tema a tu listado de seguimiento que requiere atención urgente (vence en ${days_until_due} día${days_until_due !== 1 ? "s" : ""}).</p>`;
    } else {
      mensaje += `<p>Se ha agregado un nuevo tema a tu listado de seguimiento para que lo tengas en consideración. Este tema aparecerá en tu reporte del próximo lunes.</p>`;
    }

    // Topic detail table
    mensaje += `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;table-layout:fixed;">`;
    mensaje += `<thead><tr style="background-color:#f2f2f2;text-align:left;">`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:30%;">Tema</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:100px;">Inicio</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:100px;">Vencimiento</th>`;
    mensaje += `<th style="padding:8px;border:1px solid #ddd;width:100px;">Subtareas</th>`;
    mensaje += `</tr></thead><tbody>`;

    const isOverdue = due_date && new Date(due_date) < new Date(new Date().toDateString());
    const rowBg = isOverdue ? "background-color:#fff5f5;" : "";
    const rowColor = isOverdue ? "color:#c0392b;" : "";

    mensaje += `<tr style="${rowBg}${rowColor}">`;
    mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;font-weight:600;">${topic_title}</td>`;
    mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;">${formatDate(start_date) || "—"}</td>`;
    mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;">${formatDate(due_date) || "—"}</td>`;
    mensaje += `<td style="padding:6px 8px;border:1px solid #ddd;">${pendingCount > 0 ? `${pendingCount} pendiente${pendingCount > 1 ? "s" : ""}` : "Sin subtareas"}</td>`;
    mensaje += `</tr>`;
    mensaje += `</tbody></table>`;

    // Pending subtasks detail
    if (pendingCount > 0) {
      mensaje += `<p style="margin-top:16px;"><strong>Subtareas:</strong></p><ul style="margin:0;">`;
      pendingSubtasks.forEach((s: any) => {
        mensaje += `<li>${s.title}`;
        if (s.due_date) mensaje += ` <em style="color:#888;">(vence: ${formatDate(s.due_date)})</em>`;
        mensaje += `</li>`;
      });
      mensaje += `</ul>`;
    }

    mensaje += `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0 12px;"/>`;

    if (is_urgent) {
      mensaje += `<p><strong>⚠️ Este tema es urgente. Por favor revísalo a la brevedad.</strong></p>`;
    } else {
      mensaje += `<p>Este correo es informativo. El detalle completo lo recibirás en el reporte del próximo lunes.</p>`;
    }

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
