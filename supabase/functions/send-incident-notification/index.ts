const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIREBASE_EMAIL_URL = "https://us-central1-sistemattransit.cloudfunctions.net/correoAdministracion";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.99.2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseAnonKey!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to_email, to_name, incident_title, incident_description, incident_date, category } = await req.json();

    if (!to_email || !incident_title) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formattedDate = (() => {
      try {
        return new Date(incident_date).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
      } catch { return incident_date; }
    })();

    const categoryLabel: Record<string, string> = {
      leve: "Observación menor",
      moderada: "Falta moderada",
      grave: "Incumplimiento grave",
    };

    const severityColor: Record<string, string> = {
      leve: "#f59e0b",
      moderada: "#f97316",
      grave: "#dc2626",
    };

    let mensaje = `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">`;

    // Header
    mensaje += `<div style="background:#1a1a2e;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">`;
    mensaje += `<h2 style="margin:0;font-size:18px;font-weight:700;">Notificación Formal de Incidencia Laboral</h2>`;
    mensaje += `</div>`;

    // Body
    mensaje += `<div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">`;

    mensaje += `<p>Estimado/a <strong>${to_name || ""}</strong>,</p>`;
    mensaje += `<p>Por medio de la presente, le informamos que se ha registrado la siguiente incidencia en su historial laboral:</p>`;

    // Incident card
    mensaje += `<div style="margin:16px 0;padding:16px;background:#fef2f2;border-radius:8px;border-left:4px solid ${severityColor[category] || "#dc2626"};">`;
    mensaje += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
    mensaje += `<tr><td style="padding:4px 0;color:#888;width:120px;font-weight:600;">Fecha</td><td style="padding:4px 0;">${formattedDate}</td></tr>`;
    mensaje += `<tr><td style="padding:4px 0;color:#888;font-weight:600;">Severidad</td><td style="padding:4px 0;"><span style="background:${severityColor[category] || "#dc2626"};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${categoryLabel[category] || category}</span></td></tr>`;
    mensaje += `<tr><td style="padding:4px 0;color:#888;font-weight:600;">Asunto</td><td style="padding:4px 0;font-weight:700;">${incident_title}</td></tr>`;
    if (incident_description) {
      mensaje += `<tr><td style="padding:4px 0;color:#888;font-weight:600;vertical-align:top;">Detalle</td><td style="padding:4px 0;">${incident_description}</td></tr>`;
    }
    mensaje += `</table>`;
    mensaje += `</div>`;

    mensaje += `<p>Le recordamos que el cumplimiento de las normas y procedimientos internos de la empresa es de carácter obligatorio para todos los colaboradores. Esta notificación queda registrada como antecedente formal en su historial laboral.</p>`;

    mensaje += `<p>Si tiene alguna consulta o desea presentar sus descargos respecto a esta situación, puede responder a este correo o comunicarse con su jefatura directa.</p>`;

    mensaje += `<p style="margin-top:20px;">Atentamente,<br/><strong>Gerencia de Operaciones</strong><br/>Transit Global Group</p>`;

    mensaje += `</div></div>`;

    const CC_EMAILS = ["matias@transitglobalgroup.com", "vicente@transitglobalgroup.com"]
      .filter((cc) => cc.toLowerCase() !== to_email.toLowerCase());

    const asunto = category === 'grave'
      ? `⚠️ Notificación Formal — Incidencia Laboral Grave | ${formattedDate}`
      : `Notificación — Registro de Incidencia Laboral | ${formattedDate}`;

    const response = await fetch(FIREBASE_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        para: to_email,
        asunto,
        mensaje,
        cc: CC_EMAILS,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Email API error: ${text}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending incident notification:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
