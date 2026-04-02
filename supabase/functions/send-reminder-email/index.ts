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

    // Get current day and hour in Chile timezone
    const now = new Date();
    const chileTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));
    const currentDay = chileTime.getDay();
    const currentHour = chileTime.getHours();

    console.log(`[send-reminder-email] Chile day=${currentDay} hour=${currentHour}`);

    const { data: reminders, error: remErr } = await supabase
      .from("reminder_emails")
      .select("*")
      .eq("enabled", true)
      .eq("day_of_week", currentDay)
      .eq("send_hour", currentHour);

    if (remErr) throw remErr;
    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No reminders to send" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailsSent = 0;

    for (const reminder of reminders) {
      const recipients: string[] = reminder.recipient_emails || [];
      if (recipients.length === 0) continue;

      // Get user email for CC
      const { data: userData } = await supabase.auth.admin.getUserById(reminder.user_id);
      const ccEmail = userData?.user?.email || "";

      for (const recipientEmail of recipients) {
        try {
          const htmlBody = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <div style="background:#1e40af;color:white;padding:16px 24px;border-radius:8px 8px 0 0;">
                <h2 style="margin:0;font-size:18px;">📋 Recordatorio</h2>
              </div>
              <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
                <p style="font-size:15px;color:#1f2937;line-height:1.6;margin:0;">
                  ${reminder.message.replace(/\n/g, "<br/>")}
                </p>
                <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;" />
                <p style="font-size:11px;color:#9ca3af;margin:0;">
                  Este es un correo automático enviado por el sistema de gestión.
                </p>
              </div>
            </div>
          `;

          const res = await fetch(FIREBASE_EMAIL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              para: recipientEmail,
              asunto: "📋 Recordatorio semanal",
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
