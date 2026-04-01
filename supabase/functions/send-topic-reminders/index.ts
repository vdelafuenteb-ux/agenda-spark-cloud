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
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.99.2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get today's date in Chile timezone
    const now = new Date();
    const chileDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));
    const todayStr = `${chileDate.getFullYear()}-${String(chileDate.getMonth() + 1).padStart(2, '0')}-${String(chileDate.getDate()).padStart(2, '0')}`;

    // Get all unsent reminders for today
    const { data: reminders, error: remErr } = await supabase
      .from("topic_reminders")
      .select("*, topics(title, status, due_date, assignee)")
      .eq("reminder_date", todayStr)
      .eq("sent", false);

    if (remErr) throw remErr;
    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user emails for each reminder
    let emailsSent = 0;
    for (const reminder of reminders) {
      const topic = reminder.topics;
      if (!topic) continue;

      // Get user email from auth
      const { data: userData } = await supabase.auth.admin.getUserById(reminder.user_id);
      const userEmail = userData?.user?.email || "matias@transitglobalgroup.com";

      const noteText = reminder.note ? `<p style="color:#555;font-size:13px;">📝 ${reminder.note}</p>` : "";

      const mensaje = `
        <div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">
          <p>Hola,</p>
          <p>Este es un <strong>recordatorio programado</strong> para revisar el siguiente tema:</p>
          <div style="margin:12px 0;padding:12px 16px;background:#f8f9fa;border-radius:6px;border-left:4px solid #f59e0b;">
            <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#2c3e50;">${topic.title}</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr><td style="padding:3px 0;color:#888;width:110px;">Estado</td><td style="padding:3px 0;">${topic.status}</td></tr>
              <tr><td style="padding:3px 0;color:#888;">Responsable</td><td style="padding:3px 0;">${topic.assignee || "—"}</td></tr>
              <tr><td style="padding:3px 0;color:#888;">Vencimiento</td><td style="padding:3px 0;">${topic.due_date || "Sin fecha"}</td></tr>
            </table>
            ${noteText}
          </div>
          <p style="font-size:12px;color:#888;">Este recordatorio fue programado por ti en el sistema de gestión.</p>
        </div>
      `;

      try {
        const response = await fetch(FIREBASE_EMAIL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            para: userEmail,
            asunto: `🔔 Recordatorio: ${topic.title}`,
            mensaje,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          await supabase
            .from("topic_reminders")
            .update({ sent: true })
            .eq("id", reminder.id);
          emailsSent++;
        }
      } catch (e) {
        console.error(`Failed to send reminder ${reminder.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, sent: emailsSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in send-topic-reminders:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
