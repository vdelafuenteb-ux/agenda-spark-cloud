import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEADLINE_HOURS = 48;

function isOverdue(dateStr: string | null, today: string): boolean {
  if (!dateStr) return false;
  return dateStr < today;
}

interface ScoreResult {
  score: number;
  dimensions: Record<string, number>;
}

function calculateScore(
  topics: any[],
  subtasks: any[],
  emails: any[],
  assigneeName: string,
  todayStr: string
): ScoreResult | null {
  const assigneeTopics = topics.filter((t: any) => t.assignee === assigneeName);
  if (assigneeTopics.length === 0) return null;

  const active = assigneeTopics.filter((t: any) => t.status === 'activo' || t.status === 'seguimiento');
  const completed = assigneeTopics.filter((t: any) => t.status === 'completado');

  // 1. Closure compliance (50%)
  const closedWithDates = completed.filter((t: any) => t.due_date && t.closed_at);
  let closureOnTime = 0;
  for (const t of closedWithDates) {
    const closedDate = new Date(t.closed_at);
    const dueDate = new Date(t.due_date + 'T23:59:59');
    if (closedDate.getTime() <= dueDate.getTime()) closureOnTime++;
  }
  const closureRate = closedWithDates.length > 0 ? Math.round((closureOnTime / closedWithDates.length) * 100) : null;

  // 2. Subtask timeliness (20%)
  const assigneeSubtasks = subtasks.filter((s: any) =>
    assigneeTopics.some((t: any) => t.id === s.topic_id)
  );
  const completedWithDue = assigneeSubtasks.filter((s: any) => s.completed && s.due_date && s.completed_at);
  const subtasksOnTime = completedWithDue.filter((s: any) => {
    const dueDate = new Date(s.due_date + 'T23:59:59');
    const completedDate = new Date(s.completed_at);
    return completedDate.getTime() <= dueDate.getTime();
  });
  const subtaskRate = completedWithDue.length > 0 ? Math.round((subtasksOnTime.length / completedWithDue.length) * 100) : null;

  // 3. Email compliance (10%)
  const assigneeEmails = emails.filter((e: any) => e.assignee_name === assigneeName && e.email_type === 'weekly');
  const confirmedEmails = assigneeEmails.filter((e: any) => e.confirmed && e.confirmed_at);
  const onTimeEmails = confirmedEmails.filter((e: any) => {
    const deadlineTime = new Date(e.sent_at).getTime() + DEADLINE_HOURS * 60 * 60 * 1000;
    return new Date(e.confirmed_at).getTime() <= deadlineTime;
  });
  const emailRate = confirmedEmails.length > 0 ? Math.round((onTimeEmails.length / confirmedEmails.length) * 100) : null;

  // 4. Active deadlines (10%)
  const activeWithDue = active.filter((t: any) => t.due_date && !t.is_ongoing);
  const activeOnTime = activeWithDue.filter((t: any) => !isOverdue(t.due_date, todayStr));
  const deadlineRate = activeWithDue.length > 0 ? Math.round((activeOnTime.length / activeWithDue.length) * 100) : null;

  // 5. Velocity (10%)
  const closedWithStartAndDue = completed.filter((t: any) => t.start_date && t.due_date && t.closed_at);
  let velocityScore: number | null = null;
  if (closedWithStartAndDue.length > 0) {
    const pcts = closedWithStartAndDue.map((t: any) => {
      const start = new Date(t.start_date).getTime();
      const due = new Date(t.due_date + 'T23:59:59').getTime();
      const closed = new Date(t.closed_at).getTime();
      const totalTime = due - start;
      if (totalTime <= 0) return 100;
      const usedTime = closed - start;
      return Math.min(Math.round((usedTime / totalTime) * 100), 150);
    });
    const avgPct = Math.round(pcts.reduce((a: number, b: number) => a + b, 0) / pcts.length);
    velocityScore = Math.max(0, Math.min(100, Math.round(100 - (avgPct - 50) * (100 / 100))));
  }

  // Build weighted score
  const dimensions: { value: number; weight: number; name: string }[] = [];
  if (closureRate !== null) dimensions.push({ value: closureRate, weight: 0.50, name: 'cierre_temas' });
  if (subtaskRate !== null) dimensions.push({ value: subtaskRate, weight: 0.20, name: 'puntualidad_subtareas' });
  if (emailRate !== null) dimensions.push({ value: emailRate, weight: 0.10, name: 'respuesta_correos' });
  if (deadlineRate !== null) dimensions.push({ value: deadlineRate, weight: 0.10, name: 'plazos_activos' });
  if (velocityScore !== null) dimensions.push({ value: velocityScore, weight: 0.10, name: 'velocidad' });

  if (dimensions.length === 0) return null;

  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
  const score = Math.round(dimensions.reduce((s, d) => s + d.value * (d.weight / totalWeight), 0));

  const dimRecord: Record<string, number> = {};
  for (const d of dimensions) {
    dimRecord[d.name] = d.value;
  }

  return { score, dimensions: dimRecord };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Get all users who have assignees
    const { data: assignees, error: assErr } = await supabase
      .from("assignees")
      .select("user_id, name");
    if (assErr) throw assErr;

    if (!assignees || assignees.length === 0) {
      return new Response(JSON.stringify({ message: "No assignees found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique user IDs
    const userIds = [...new Set(assignees.map((a: any) => a.user_id))];

    // Fetch all data needed
    const [topicsRes, subtasksRes, emailsRes] = await Promise.all([
      supabase.from("topics").select("*").in("user_id", userIds),
      supabase.from("subtasks").select("*"),
      supabase.from("notification_emails").select("*").in("user_id", userIds),
    ]);

    if (topicsRes.error) throw topicsRes.error;
    if (subtasksRes.error) throw subtasksRes.error;
    if (emailsRes.error) throw emailsRes.error;

    const topics = topicsRes.data || [];
    const subtasks = subtasksRes.data || [];
    const emails = emailsRes.data || [];

    let saved = 0;
    const errors: string[] = [];

    for (const assignee of assignees) {
      const userTopics = topics.filter((t: any) => t.user_id === assignee.user_id);
      const userEmails = emails.filter((e: any) => e.user_id === assignee.user_id);

      const result = calculateScore(userTopics, subtasks, userEmails, assignee.name, todayStr);
      if (!result) continue;

      const { error: insertErr } = await supabase
        .from("score_snapshots")
        .upsert(
          {
            user_id: assignee.user_id,
            assignee_name: assignee.name,
            score: result.score,
            dimensions: result.dimensions,
            snapshot_date: todayStr,
          },
          { onConflict: "user_id,assignee_name,snapshot_date" }
        );

      if (insertErr) {
        errors.push(`${assignee.name}: ${insertErr.message}`);
      } else {
        saved++;
      }
    }

    return new Response(
      JSON.stringify({ saved, errors, date: todayStr }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
