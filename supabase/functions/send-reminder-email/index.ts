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

      const { data: userData } = await supabase.auth.admin.getUserById(reminder.user_id);
      const ccEmail = userData?.user?.email || "";
      const subject = reminder.subject || "Recordatorio semanal";

      for (const recipientEmail of recipients) {
        try {
          const htmlBody = `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
              <!-- Header -->
              <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:32px 32px 24px;border-radius:12px 12px 0 0;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                  📋 ${subject}
                </h1>
                <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">
                  Notificación automática del sistema de gestión
                </p>
              </div>

              <!-- Body -->
              <div style="border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 12px 12px;">
                <div style="background:#f8fafc;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:24px;">
                  <p style="font-size:15px;color:#1e293b;line-height:1.7;margin:0;white-space:pre-line;">
                    ${reminder.message.replace(/\n/g, "<br/>")}
                  </p>
                </div>

                <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                  <tr>
                    <td style="padding:8px 12px;background:#f1f5f9;border-radius:6px;width:50%;">
                      <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Programado</p>
                      <p style="margin:2px 0 0;font-size:14px;color:#1e293b;font-weight:600;">
                        ${["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][reminder.day_of_week]} a las ${String(reminder.send_hour).padStart(2,"0")}:00
                      </p>
                    </td>
                    <td style="width:12px;"></td>
                    <td style="padding:8px 12px;background:#f1f5f9;border-radius:6px;width:50%;">
                      <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Destinatarios</p>
                      <p style="margin:2px 0 0;font-size:14px;color:#1e293b;font-weight:600;">
                        ${recipients.length} persona${recipients.length !== 1 ? "s" : ""}
                      </p>
                    </td>
                  </tr>
                </table>

                <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;" />
                <p style="font-size:11px;color:#94a3b8;margin:0;text-align:center;">
                  Este es un correo automático enviado por el sistema de gestión.<br/>
                  Por favor no responder a este mensaje.
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
