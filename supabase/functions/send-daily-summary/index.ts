const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIREBASE_EMAIL_URL = "https://us-central1-sistemattransit.cloudfunctions.net/correoAdministracion";

interface SummaryItem {
  title: string;
  parentTitle?: string;
  assignee: string;
  dueDate: string | null;
  type: 'subtask' | 'topic';
}

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

function buildItems(
  topics: any[],
  matchFn: (date: string | null) => boolean,
  includeCompleted: boolean,
): SummaryItem[] {
  const items: SummaryItem[] = [];
  for (const topic of topics) {
    const subs = (topic.subtasks || []).filter((s: any) =>
      (includeCompleted || !s.completed) && matchFn(s.due_date)
    );
    for (const sub of subs) {
      items.push({
        title: sub.title,
        parentTitle: topic.title,
        assignee: sub.responsible || topic.assignee || "",
        dueDate: sub.due_date,
        type: 'subtask',
      });
    }
    // Only show topic row if no matching subtasks and topic itself matches
    if (subs.length === 0 && matchFn(topic.due_date)) {
      items.push({
        title: topic.title,
        assignee: topic.assignee || "",
        dueDate: topic.due_date,
        type: 'topic',
      });
    }
  }
  return items;
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

    const nowUtc = new Date();
    const chileStr = nowUtc.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
    const today = chileStr;
    const limitDate = addDays(today, 3);

    console.log(`Daily summary: today=${today}, upcoming limit=${limitDate}`);

    const RECIPIENT_EMAIL = "matias@transitglobalgroup.com";

    const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
    if (usersErr) throw usersErr;

    const targetUser = users.users.find((u: any) => u.email === RECIPIENT_EMAIL);
    if (!targetUser) {
      console.log(`User ${RECIPIENT_EMAIL} not found, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "Target user not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailsSent = 0;
    const user = targetUser;

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

    // Build individual items (like ReviewView)
    const todayItems = buildItems(topics, (d) => isToday(d, today), false);
    const overdueItems = buildItems(topics, (d) => isOverdue(d, today), false);
    const upcomingItems = buildItems(topics, (d) => isUpcoming(d, today, limitDate), false);

    // Checklist categorization
    const todayChecklist = (checklistItems || []).filter((i: any) => isToday(i.due_date, today));
    const overdueChecklist = (checklistItems || []).filter((i: any) => isOverdue(i.due_date, today));
    const upcomingChecklist = (checklistItems || []).filter((i: any) => isUpcoming(i.due_date, today, limitDate));

    const totalItems = todayItems.length + overdueItems.length + upcomingItems.length +
      todayChecklist.length + overdueChecklist.length + upcomingChecklist.length;

    if (totalItems === 0) {
      console.log(`No items for user ${user.id}, skipping`);
      return new Response(JSON.stringify({ message: "No pending items" }), { status: 200, headers: corsHeaders });
    }

    // Build HTML email
    let mensaje = `<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;">`;
    mensaje += `<h2 style="color:#1a1a1a;margin-bottom:4px;">📋 Resumen diario — ${formatDate(today)}</h2>`;
    mensaje += `<p style="color:#666;margin-top:0;">Tu revisión del día con temas, subtareas y checklist.</p>`;

    mensaje += buildSection("📌 Hoy", todayItems, todayChecklist, today, "#2563eb");
    mensaje += buildSection("🔴 Atrasados", overdueItems, overdueChecklist, today, "#dc2626");
    mensaje += buildSection("🟡 Próximos (3 días)", upcomingItems, upcomingChecklist, today, "#d97706");

    mensaje += `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;">`;
    mensaje += `<p style="font-size:11px;color:#aaa;">📧 Correo automático de resumen diario.</p>`;
    mensaje += `</div>`;

    const overdueTotal = overdueItems.length + overdueChecklist.length;
    const todayTotal = todayItems.length + todayChecklist.length;
    const upcomingTotal = upcomingItems.length + upcomingChecklist.length;

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
  items: SummaryItem[],
  checklist: any[],
  today: string,
  color: string,
): string {
  const total = items.length + checklist.length;

  if (total === 0) {
    return `<div style="margin:16px 0;padding:12px;background:#f9f9f9;border-radius:8px;border-left:4px solid ${color};">
      <h3 style="margin:0;color:${color};font-size:15px;">${title} <span style="font-weight:normal;color:#999;">(0)</span></h3>
      <p style="margin:6px 0 0;color:#999;font-size:13px;">Sin pendientes 🎉</p>
    </div>`;
  }

  let html = `<div style="margin:16px 0;padding:12px 16px;background:#f9f9f9;border-radius:8px;border-left:4px solid ${color};">`;
  html += `<h3 style="margin:0 0 8px;color:${color};font-size:15px;">${title} <span style="font-weight:normal;color:#999;">(${total})</span></h3>`;

  if (items.length > 0) {
    html += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
    html += `<thead><tr style="background:#fff;"><th style="padding:4px 8px;text-align:left;border-bottom:1px solid #ddd;">Item</th>`;
    html += `<th style="padding:4px 8px;text-align:left;border-bottom:1px solid #ddd;">Responsable</th>`;
    html += `<th style="padding:4px 8px;text-align:center;border-bottom:1px solid #ddd;">Vence</th></tr></thead><tbody>`;

    for (const item of items) {
      const venceColor = isOverdue(item.dueDate, today) ? "color:#dc2626;font-weight:600;" : "";
      html += `<tr>`;
      html += `<td style="padding:4px 8px;border-bottom:1px solid #eee;">`;
      html += `<span style="font-weight:500;">${item.title}</span>`;
      if (item.parentTitle) {
        html += `<br><span style="font-size:11px;color:#888;">→ ${item.parentTitle}</span>`;
      }
      html += `</td>`;
      html += `<td style="padding:4px 8px;border-bottom:1px solid #eee;color:#666;">${item.assignee || "—"}</td>`;
      html += `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;${venceColor}">${formatDate(item.dueDate) || "—"}</td>`;
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
