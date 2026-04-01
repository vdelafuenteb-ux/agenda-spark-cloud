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

    const { to_email, to_name, topic_title, due_date, closed_at, is_ongoing, last_progress_entry } = await req.json();

    if (!to_email || !topic_title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if closed on time
    let onTime = true;
    let statusBadge = `<span style="background:#22c55e;color:#fff;padding:4px 12px;border-radius:12px;font-size:14px;font-weight:600;">✅ A tiempo</span>`;

    if (!is_ongoing && due_date && closed_at) {
      const dueD = new Date(due_date + "T23:59:59");
      const closedD = new Date(closed_at);
      if (closedD > dueD) {
        onTime = false;
        statusBadge = `<span style="background:#ef4444;color:#fff;padding:4px 12px;border-radius:12px;font-size:14px;font-weight:600;">⚠️ Fuera de plazo</span>`;
      }
    }

    const lastEntryHtml = last_progress_entry
      ? `<div style="margin-top:16px;padding:12px 16px;background:#f8fafc;border-left:4px solid #3b82f6;border-radius:4px;">
           <p style="margin:0 0 4px;font-size:12px;color:#64748b;font-weight:600;">Último avance registrado:</p>
           <p style="margin:0;font-size:14px;color:#1e293b;">${last_progress_entry}</p>
         </div>`
      : "";

    const dueDateHtml = is_ongoing
      ? `<p style="font-size:14px;color:#64748b;">Tipo: <strong>Tema continuo</strong></p>`
      : due_date
        ? `<p style="font-size:14px;color:#64748b;">Fecha comprometida: <strong>${formatDate(due_date)}</strong></p>`
        : "";

    const closedDateHtml = closed_at
      ? `<p style="font-size:14px;color:#64748b;">Fecha de cierre: <strong>${formatDate(closed_at)}</strong></p>`
      : "";

    const html = `
      <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="text-align:center;padding:24px 0;">
          <h1 style="margin:0 0 8px;font-size:24px;color:#1e293b;">🎉 ¡Felicitaciones!</h1>
          <p style="margin:0;font-size:16px;color:#475569;">Se ha cerrado exitosamente el siguiente tema</p>
        </div>
        
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:16px 0;">
          <h2 style="margin:0 0 12px;font-size:18px;color:#1e293b;">${topic_title}</h2>
          ${dueDateHtml}
          ${closedDateHtml}
          <div style="margin-top:12px;">${statusBadge}</div>
          ${lastEntryHtml}
        </div>

        <p style="text-align:center;font-size:13px;color:#94a3b8;margin-top:24px;">
          Este correo fue enviado automáticamente por el sistema de gestión.
        </p>
      </div>
    `;

    const emailPayload = {
      para: to_email,
      asunto: `✅ Tema cerrado: ${topic_title}`,
      mensaje: html,
      cc: ["matias@transitglobalgroup.com", "vicente@transitglobalgroup.com"],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const emailRes = await fetch(FIREBASE_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      throw new Error(`Email API error: ${emailRes.status} - ${errText}`);
    }

    return new Response(
      JSON.stringify({ success: true, on_time: onTime }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
