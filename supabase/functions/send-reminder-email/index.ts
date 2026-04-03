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

    // Check for test mode
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }
    const testMode = body?.test === true;
    const testReminderId = body?.reminder_id;

    let reminders: any[] = [];

    if (testMode && testReminderId) {
      // Test mode: send a specific reminder regardless of schedule
      const { data, error } = await supabase
        .from("reminder_emails")
        .select("*")
        .eq("id", testReminderId)
        .single();
      if (error) throw error;
      reminders = [data];
      console.log(`[send-reminder-email] TEST mode for reminder ${testReminderId}`);
    } else {
      const now = new Date();
      const chileTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));
      const currentDay = chileTime.getDay();
      const currentHour = chileTime.getHours();

      console.log(`[send-reminder-email] Chile day=${currentDay} hour=${currentHour}`);

      const { data, error: remErr } = await supabase
        .from("reminder_emails")
        .select("*")
        .eq("enabled", true)
        .eq("day_of_week", currentDay)
        .eq("send_hour", currentHour);
      if (remErr) throw remErr;
      reminders = data || [];
    }

    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No reminders to send" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailsSent = 0;

    for (const reminder of reminders) {
      const recipients: string[] = reminder.recipient_emails || [];
      if (recipients.length === 0) continue;

      const { data: userData } = await supabase.auth.admin.getUserById(reminder.user_id);
      const ccEmail = userData?.user?.email || "";
      const subject = reminder.subject || "Recordatorio semanal";

      for (const recipientEmail of recipients) {
        try {
          const htmlBody = `
            <div style="font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <!-- Header con gradiente premium -->
              <div style="background:linear-gradient(135deg,#0f172a 0%,#1e40af 50%,#3b82f6 100%);padding:40px 36px 32px;text-align:center;">
                <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
                  <span style="font-size:28px;line-height:56px;">📋</span>
                </div>
                <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                  ${subject}
                </h1>
              </div>

              <!-- Contenido principal -->
              <div style="padding:36px 36px 28px;">
                <div style="background:linear-gradient(135deg,#eff6ff,#f0f9ff);border-left:4px solid #3b82f6;border-radius:0 12px 12px 0;padding:24px 28px;margin-bottom:28px;">
                  <p style="font-size:15px;color:#1e293b;line-height:1.8;margin:0;white-space:pre-line;">
                    ${reminder.message.replace(/\n/g, "<br/>")}
                  </p>
                </div>

                <!-- Separador decorativo -->
                <div style="text-align:center;margin:24px 0;">
                  <span style="display:inline-block;width:40px;height:3px;background:linear-gradient(90deg,#3b82f6,#60a5fa);border-radius:2px;"></span>
                </div>

                <!-- Footer elegante -->
                <p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;line-height:1.6;">
                  Correo generado automáticamente · Sistema de Gestión
                </p>
              </div>
            </div>
          `;

          const res = await fetch(FIREBASE_EMAIL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              para: recipientEmail,
              asunto: `📋 ${subject}`,
              mensaje: htmlBody,
              cc: ccEmail,
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (res.ok) {
            emailsSent++;
            console.log(`[send-reminder-email] Sent to ${recipientEmail}`);
          } else {
            const errText = await res.text();
            console.error(`[send-reminder-email] Error sending to ${recipientEmail}: ${errText}`);
          }
        } catch (e) {
          console.error(`[send-reminder-email] Error for ${recipientEmail}:`, e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, emails_sent: emailsSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-reminder-email] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
