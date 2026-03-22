const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIREBASE_EMAIL_URL = "https://us-central1-sistemattransit.cloudfunctions.net/correoAdministracion";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function isOverdue(dateStr: string | null, today: string): boolean {
  if (!dateStr) return false;
  return dateStr < today;
}

function isToday(dateStr: string | null, today: string): boolean {
  if (!dateStr) return false;
  return dateStr === today;
}

function isUpcoming(dateStr: string | null, today: string, limitDate: string): boolean {
  if (!dateStr) return false;
  return dateStr > today && dateStr <= limitDate;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
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

    // Chile timezone today
    const nowUtc = new Date();
    const chileStr = nowUtc.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
    const today = chileStr; // YYYY-MM-DD
    const limitDate = addDays(today, 3);

    console.log(`Daily summary: today=${today}, upcoming limit=${limitDate}`);

    const RECIPIENT_EMAIL = "matias@transitglobalgroup.com";

    // Find the user by email
    const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
    if (usersErr) throw usersErr;

    const targetUser = users.users.find(u => u.email === RECIPIENT_EMAIL);
    if (!targetUser) {
      console.log(`User ${RECIPIENT_EMAIL} not found, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "Target user not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailsSent = 0;

    // Process only the target user
    const user = targetUser;
    {

      // Fetch active/seguimiento topics with subtasks
      const { data: topics, error: topicsErr } = await supabase
        .from("topics")
        .select("*, subtasks(*)")
        .eq("user_id", user.id)
        .in("status", ["activo", "seguimiento"]);

      if (topicsErr) {
        console.error(`Error fetching topics for ${user.id}:`, topicsErr);
        return new Response(JSON.stringify({ error: "Error fetching topics" }), { status: 500, headers: corsHeaders });
      }

      if (!topics || topics.length === 0) {
        return new Response(JSON.stringify({ message: "No active topics found" }), { status: 200, headers: corsHeaders });
      }

      // Fetch checklist items
      const { data: checklistItems } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", false);

      // Fetch reminders
      const { data: reminders } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", user.id);

      // Categorize topics
      const todayTopics: any[] = [];
      const overdueTopics: any[] = [];
      const upcomingTopics: any[] = [];

      for (const t of topics) {
        const topicToday = isToday(t.due_date, today);
        const topicOverdue = !t.is_ongoing && isOverdue(t.due_date, today);
        const topicUpcoming = isUpcoming(t.due_date, today, limitDate);

        const subtasksToday = (t.subtasks || []).filter((s: any) => isToday(s.due_date, today));
        const subtasksOverdue = (t.subtasks || []).filter((s: any) => !s.completed && isOverdue(s.due_date, today));
        const subtasksUpcoming = (t.subtasks || []).filter((s: any) => !s.completed && isUpcoming(s.due_date, today, limitDate));

        if (topicToday || subtasksToday.length > 0) {
          todayTopics.push({ ...t, matchCount: subtasksToday.length || 1 });
        }
        if (topicOverdue || subtasksOverdue.length > 0) {
          overdueTopics.push({ ...t, matchCount: subtasksOverdue.length || 1 });
        }
        if (topicUpcoming || subtasksUpcoming.length > 0) {
          upcomingTopics.push({ ...t, matchCount: subtasksUpcoming.length || 1 });
        }
      }

      // Checklist categorization
      const todayChecklist = (checklistItems || []).filter((i: any) => isToday(i.due_date, today));
      const overdueChecklist = (checklistItems || []).filter((i: any) => isOverdue(i.due_date, today));
      const upcomingChecklist = (checklistItems || []).filter((i: any) => isUpcoming(i.due_date, today, limitDate));

      const totalItems = todayTopics.length + overdueTopics.length + upcomingTopics.length +
        todayChecklist.length + overdueChecklist.length + upcomingChecklist.length;

      if (totalItems === 0) {
        console.log(`No items for user ${user.id}, skipping`);
        continue;
      }

      // Build HTML email
      let mensaje = `<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;">`;
      mensaje += `<h2 style="color:#1a1a1a;margin-bottom:4px;">📋 Resumen diario — ${formatDate(today)}</h2>`;
      mensaje += `<p style="color:#666;margin-top:0;">Tu revisión del día con temas, subtareas y checklist.</p>`;

      // --- HOY ---
      const todayTotal = todayTopics.reduce((s: number, t: any) => s + t.matchCount, 0) + todayChecklist.length;
      mensaje += buildSection("📌 Hoy", todayTopics, todayChecklist, today, "#2563eb", todayTotal);

      // --- ATRASADOS ---
      const overdueTotal = overdueTopics.reduce((s: number, t: any) => s + t.matchCount, 0) + overdueChecklist.length;
      mensaje += buildSection("🔴 Atrasados", overdueTopics, overdueChecklist, today, "#dc2626", overdueTotal);

      // --- PRÓXIMOS ---
      const upcomingTotal = upcomingTopics.reduce((s: number, t: any) => s + t.matchCount, 0) + upcomingChecklist.length;
      mensaje += buildSection("🟡 Próximos (3 días)", upcomingTopics, upcomingChecklist, today, "#d97706", upcomingTotal);

      mensaje += `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;">`;
      mensaje += `<p style="font-size:11px;color:#aaa;">📧 Correo automático de resumen diario.</p>`;
      mensaje += `</div>`;

      const asunto = `📋 Resumen diario | ${overdueTotal > 0 ? `🔴 ${overdueTotal} atrasado${overdueTotal > 1 ? "s" : ""} | ` : ""}${todayTotal} hoy | ${upcomingTotal} próximos`;

      try {
        const response = await fetch(FIREBASE_EMAIL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            para: user.email,
            asunto,
            mensaje,
            cc: [],
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          console.error(`Failed to send daily summary to ${user.email}:`, result);
        } else {
          emailsSent++;
          console.log(`Sent daily summary to ${user.email}: ${todayTotal} today, ${overdueTotal} overdue, ${upcomingTotal} upcoming`);
        }
      } catch (emailError) {
        console.error(`Error sending to ${user.email}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, emails_sent: emailsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in daily summary:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildSection(
  title: string,
  topics: any[],
  checklist: any[],
  today: string,
  color: string,
  total: number,
): string {
  if (total === 0) {
    return `<div style="margin:16px 0;padding:12px;background:#f9f9f9;border-radius:8px;border-left:4px solid ${color};">
      <h3 style="margin:0;color:${color};font-size:15px;">${title} <span style="font-weight:normal;color:#999;">(0)</span></h3>
      <p style="margin:6px 0 0;color:#999;font-size:13px;">Sin pendientes 🎉</p>
    </div>`;
  }

  let html = `<div style="margin:16px 0;padding:12px 16px;background:#f9f9f9;border-radius:8px;border-left:4px solid ${color};">`;
  html += `<h3 style="margin:0 0 8px;color:${color};font-size:15px;">${title} <span style="font-weight:normal;color:#999;">(${total})</span></h3>`;

  if (topics.length > 0) {
    html += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
    html += `<thead><tr style="background:#fff;"><th style="padding:4px 8px;text-align:left;border-bottom:1px solid #ddd;">Tema</th>`;
    html += `<th style="padding:4px 8px;text-align:left;border-bottom:1px solid #ddd;">Responsable</th>`;
    html += `<th style="padding:4px 8px;text-align:center;border-bottom:1px solid #ddd;">Vence</th>`;
    html += `<th style="padding:4px 8px;text-align:center;border-bottom:1px solid #ddd;">Items</th></tr></thead><tbody>`;

    for (const t of topics) {
      const venceColor = isOverdue(t.due_date, today) ? "color:#dc2626;font-weight:600;" : "";
      html += `<tr>`;
      html += `<td style="padding:4px 8px;border-bottom:1px solid #eee;font-weight:500;">${t.title}</td>`;
      html += `<td style="padding:4px 8px;border-bottom:1px solid #eee;color:#666;">${t.assignee || "—"}</td>`;
      html += `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;${venceColor}">${formatDate(t.due_date) || "—"}</td>`;
      html += `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;">${t.matchCount}</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table>`;
  }

  if (checklist.length > 0) {
    html += `<p style="margin:8px 0 4px;font-size:12px;font-weight:600;color:#555;">Checklist:</p>`;
    html += `<ul style="margin:0;padding-left:20px;font-size:13px;">`;
    for (const c of checklist) {
      html += `<li>${c.title}${c.due_date ? ` <em style="color:#888;">(${formatDate(c.due_date)})</em>` : ""}</li>`;
    }
    html += `</ul>`;
  }

  html += `</div>`;
  return html;
}
