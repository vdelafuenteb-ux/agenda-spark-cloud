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
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.99.2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get current time in Chile timezone
    const nowUtc = new Date();
    const chileTime = new Date(nowUtc.toLocaleString("en-US", { timeZone: "America/Santiago" }));
    const currentDay = chileTime.getDay(); // 0=Sunday
    const currentHour = chileTime.getHours();

    console.log(`Checking schedules: Chile day=${currentDay}, hour=${currentHour}`);

    // Find enabled schedules matching current day and hour
    const { data: schedules, error: schedError } = await supabase
      .from("email_schedules")
      .select("*")
      .eq("enabled", true)
      .eq("day_of_week", currentDay)
      .eq("send_hour", currentHour);

    if (schedError) {
      console.error("Error fetching schedules:", schedError);
      throw schedError;
    }

    if (!schedules || schedules.length === 0) {
      console.log("No matching schedules found");
      return new Response(
        JSON.stringify({ success: true, message: "No schedules to process" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${schedules.length} schedule(s) to process`);

    let emailsSent = 0;

    for (const schedule of schedules) {
      // Fetch all seguimiento topics for this user
      const { data: allTopics, error: topicsError } = await supabase
        .from("topics")
        .select("*, subtasks(*), progress_entries(*)")
        .eq("user_id", schedule.user_id)
        .eq("status", "seguimiento");

      if (topicsError) {
        console.error(`Error fetching topics for user ${schedule.user_id}:`, topicsError);
        continue;
      }

      // Filter topics based on schedule config
      let relevantTopics = allTopics || [];
      if (!schedule.send_all_topics && schedule.selected_topic_ids?.length > 0) {
        relevantTopics = relevantTopics.filter((t: any) => schedule.selected_topic_ids.includes(t.id));
      }

      if (relevantTopics.length === 0) {
        console.log(`No seguimiento topics for schedule ${schedule.id}`);
        continue;
      }

      // Fetch assignees for this user
      const { data: assignees, error: assigneesError } = await supabase
        .from("assignees")
        .select("*")
        .eq("user_id", schedule.user_id);

      if (assigneesError) {
        console.error(`Error fetching assignees:`, assigneesError);
        continue;
      }

      // Filter assignees based on schedule config
      let targetAssignees = (assignees || []).filter((a: any) => a.email);
      if (!schedule.send_to_all_assignees && schedule.selected_assignee_ids?.length > 0) {
        targetAssignees = targetAssignees.filter((a: any) => schedule.selected_assignee_ids.includes(a.id));
      }

      // Group topics by assignee
      for (const assignee of targetAssignees) {
        const assigneeTopics = relevantTopics.filter((t: any) => t.assignee === assignee.name);
        if (assigneeTopics.length === 0) continue;

        // Sort progress entries desc
        assigneeTopics.forEach((t: any) => {
          if (t.progress_entries) {
            t.progress_entries.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          }
        });

        // Build HTML email (same format as bulk notification)
        const topicsWithPending = assigneeTopics.map((topic: any, index: number) => {
          const pending = (topic.subtasks || []).filter((s: any) => !s.completed);
          return { ...topic, pendingSubtasks: pending, num: index + 1 };
        });

        let mensaje = `<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">`;
        mensaje += `<p>Hola ${assignee.name},</p>`;
        mensaje += `<p>Tienes <strong>${assigneeTopics.length} tema${assigneeTopics.length > 1 ? "s" : ""}</strong> pendiente${assigneeTopics.length > 1 ? "s" : ""} de actualizar. <strong>Responde este correo</strong> con el estado de cada uno.</p>`;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Topic cards (mobile-friendly)
        topicsWithPending.forEach((t: any) => {
          const pendingText = t.pendingSubtasks.length > 0
            ? `${t.pendingSubtasks.length} subtarea${t.pendingSubtasks.length > 1 ? "s" : ""}`
            : "Sin pendientes";
          const pendingColor = t.pendingSubtasks.length > 0 ? "#c0392b" : "#888";
          const isOverdue = t.due_date && new Date(t.due_date) < now;
          const cardBorder = isOverdue ? "border-left:4px solid #c0392b;" : "border-left:4px solid #3498db;";
          const titleColor = isOverdue ? "color:#c0392b;" : "color:#2c3e50;";
          const lastEntry = (t.progress_entries || []).length > 0 ? (t.progress_entries || [])[0]?.content || "" : "";

          mensaje += `<div style="margin:10px 0;padding:10px 14px;background:#f8f9fa;border-radius:6px;${cardBorder}">`;
          mensaje += `<p style="margin:0 0 6px;font-size:14px;font-weight:700;${titleColor}">${t.num}. ${t.title}</p>`;
          mensaje += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
          mensaje += `<tr><td style="padding:3px 0;color:#888;width:110px;">Inicio</td><td style="padding:3px 0;">${formatDate(t.start_date) || "—"}</td></tr>`;
          mensaje += `<tr><td style="padding:3px 0;color:#888;">Vencimiento</td><td style="padding:3px 0;">${formatDate(t.due_date) || "—"}</td></tr>`;
          mensaje += `<tr><td style="padding:3px 0;color:#888;">Pendientes</td><td style="padding:3px 0;color:${pendingColor};">${pendingText}</td></tr>`;
          if (lastEntry) {
            mensaje += `<tr><td style="padding:3px 0;color:#888;vertical-align:top;">Último avance</td><td style="padding:3px 0;color:#555;font-size:12px;word-wrap:break-word;">${lastEntry}</td></tr>`;
          }
          mensaje += `</table>`;
          mensaje += `</div>`;
        });

        mensaje += `<p style="font-size:11px;color:#999;margin:4px 0 12px;">🔴 Las tarjetas con borde rojo indican temas con fecha vencida.</p>`;

        const withPending = topicsWithPending.filter((t: any) => t.pendingSubtasks.length > 0);
        if (withPending.length > 0) {
          mensaje += `<p style="margin-top:12px;"><strong>Subtareas pendientes:</strong></p>`;
          withPending.forEach((t: any) => {
            mensaje += `<p style="margin:8px 0 2px;"><strong>${t.num}. ${t.title}</strong></p><ul style="margin:0;padding-left:20px;">`;
            t.pendingSubtasks.forEach((s: any) => {
              mensaje += `<li style="margin-bottom:4px;">${s.title}`;
              if (s.due_date) mensaje += ` <em style="color:#888;">(vence: ${formatDate(s.due_date)})</em>`;
              mensaje += `</li>`;
            });
            mensaje += `</ul>`;
          });
        }

        mensaje += `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0 12px;"/>`;
        mensaje += `<p><strong>⚠️ Responde actualizando CADA tema. Plazo máximo: 48 HORAS.</strong></p>`;
        mensaje += `<p><strong>No olvides responder a todos</strong> para que tu respuesta llegue a todo el equipo.</p>`;
        mensaje += `<p style="font-size:11px;color:#aaa;">📧 Correo automático programado.</p>`;
        mensaje += `</div>`;

        const asunto = `🚨 ${assigneeTopics.length} TEMA${assigneeTopics.length > 1 ? "S" : ""} ACTIVO${assigneeTopics.length > 1 ? "S" : ""} — ¡Actualizar a la brevedad! | Máx. 48 hrs para responder`;

        const CC_EMAILS = ["matias@transitglobalgroup.com", "vicente@transitglobalgroup.com"]
          .filter((cc) => cc.toLowerCase() !== assignee.email.toLowerCase());

        try {
          const response = await fetch(FIREBASE_EMAIL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ para: assignee.email, asunto, mensaje, cc: CC_EMAILS }),
          });

          if (!response.ok) {
            const result = await response.json();
            console.error(`Failed to send to ${assignee.email}:`, result);
          } else {
            emailsSent++;
            console.log(`Sent email to ${assignee.name} (${assignee.email}) with ${assigneeTopics.length} topics`);

            // Log each email in notification_emails
            for (const topic of assigneeTopics) {
              await supabase.from("notification_emails").insert({
                user_id: schedule.user_id,
                topic_id: topic.id,
                assignee_name: assignee.name,
                assignee_email: assignee.email,
              });
            }
          }
        } catch (emailError) {
          console.error(`Error sending to ${assignee.email}:`, emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, emails_sent: emailsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in scheduled emails:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
