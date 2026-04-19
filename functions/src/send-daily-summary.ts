import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { db, formatDate, sendEmail } from './_shared';

interface SummaryItem {
  title: string;
  parentTitle?: string;
  assignee: string;
  dueDate: string | null;
  type: 'subtask' | 'topic';
}

function isOverdue(d: string | null | undefined, today: string): boolean { return !!d && d < today; }
function isToday(d: string | null | undefined, today: string): boolean { return !!d && d === today; }
function isUpcoming(d: string | null | undefined, today: string, limit: string): boolean { return !!d && d > today && d <= limit; }

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function buildItems(topics: any[], subtasksByTopic: Map<string, any[]>, matchFn: (d: string | null) => boolean): SummaryItem[] {
  const items: SummaryItem[] = [];
  for (const topic of topics) {
    const subs = (subtasksByTopic.get(topic.id) || []).filter((s: any) => !s.completed && matchFn(s.due_date));
    for (const sub of subs) {
      items.push({ title: sub.title, parentTitle: topic.title, assignee: sub.responsible || topic.assignee || '', dueDate: sub.due_date, type: 'subtask' });
    }
    if (subs.length === 0 && matchFn(topic.due_date)) {
      items.push({ title: topic.title, assignee: topic.assignee || '', dueDate: topic.due_date, type: 'topic' });
    }
  }
  return items;
}

function buildSection(title: string, items: SummaryItem[], checklist: any[], today: string, color: string): string {
  const total = items.length + checklist.length;
  if (total === 0) {
    return `<div style="margin:16px 0;padding:12px;background:#f9f9f9;border-radius:8px;border-left:4px solid ${color};"><h3 style="margin:0;color:${color};font-size:15px;">${title} <span style="font-weight:normal;color:#999;">(0)</span></h3><p style="margin:6px 0 0;color:#999;font-size:13px;">Sin pendientes 🎉</p></div>`;
  }
  let html = `<div style="margin:16px 0;padding:12px 16px;background:#f9f9f9;border-radius:8px;border-left:4px solid ${color};"><h3 style="margin:0 0 8px;color:${color};font-size:15px;">${title} <span style="font-weight:normal;color:#999;">(${total})</span></h3>`;
  if (items.length > 0) {
    html += `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#fff;"><th style="padding:4px 8px;text-align:left;border-bottom:1px solid #ddd;">Item</th><th style="padding:4px 8px;text-align:left;border-bottom:1px solid #ddd;">Responsable</th><th style="padding:4px 8px;text-align:center;border-bottom:1px solid #ddd;">Vence</th></tr></thead><tbody>`;
    for (const item of items) {
      const venceColor = isOverdue(item.dueDate, today) ? 'color:#dc2626;font-weight:600;' : '';
      html += `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;"><span style="font-weight:500;">${item.title}</span>${item.parentTitle ? `<br><span style="font-size:11px;color:#888;">→ ${item.parentTitle}</span>` : ''}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;color:#666;">${item.assignee || '—'}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;${venceColor}">${formatDate(item.dueDate) || '—'}</td></tr>`;
    }
    html += `</tbody></table>`;
  }
  if (checklist.length > 0) {
    html += `<p style="margin:8px 0 4px;font-size:12px;font-weight:600;color:#555;">Checklist:</p><ul style="margin:0;padding-left:20px;font-size:13px;">`;
    for (const c of checklist) html += `<li>${c.title}${c.due_date ? ` <em style="color:#888;">(${formatDate(c.due_date)})</em>` : ''}</li>`;
    html += `</ul>`;
  }
  html += `</div>`;
  return html;
}

async function run(): Promise<{ success: boolean; emails_sent: number; message?: string }> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const limitDate = addDays(today, 3);
  const RECIPIENT_EMAIL = 'matias@transitglobalgroup.com';

  // Find target user by email
  const usersList = await admin.auth().listUsers(1000);
  const targetUser = usersList.users.find((u) => u.email === RECIPIENT_EMAIL);
  if (!targetUser) return { success: true, emails_sent: 0, message: 'Target user not found' };

  const topicsSnap = await db().collection('topics').where('user_id', '==', targetUser.uid).where('status', 'in', ['activo', 'seguimiento']).get();
  const topics = topicsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  if (topics.length === 0) return { success: true, emails_sent: 0, message: 'No active topics' };

  // Pull subtasks for these topics (chunked)
  const topicIds = topics.map((t: any) => t.id);
  const subtasksByTopic = new Map<string, any[]>();
  for (let i = 0; i < topicIds.length; i += 30) {
    const ch = topicIds.slice(i, i + 30);
    const s = await db().collection('subtasks').where('topic_id', 'in', ch).get();
    for (const d of s.docs) {
      const data = d.data() as any;
      const arr = subtasksByTopic.get(data.topic_id);
      if (arr) arr.push(data);
      else subtasksByTopic.set(data.topic_id, [data]);
    }
  }

  const checklistSnap = await db().collection('checklist_items').where('user_id', '==', targetUser.uid).where('completed', '==', false).get();
  const checklistItems = checklistSnap.docs.map((d) => d.data() as any);

  const todayItems = buildItems(topics, subtasksByTopic, (d) => isToday(d, today));
  const overdueItems = buildItems(topics, subtasksByTopic, (d) => isOverdue(d, today));
  const upcomingItems = buildItems(topics, subtasksByTopic, (d) => isUpcoming(d, today, limitDate));

  const todayChecklist = checklistItems.filter((i) => isToday(i.due_date, today));
  const overdueChecklist = checklistItems.filter((i) => isOverdue(i.due_date, today));
  const upcomingChecklist = checklistItems.filter((i) => isUpcoming(i.due_date, today, limitDate));

  const totalItems = todayItems.length + overdueItems.length + upcomingItems.length + todayChecklist.length + overdueChecklist.length + upcomingChecklist.length;
  if (totalItems === 0) return { success: true, emails_sent: 0, message: 'No pending items' };

  let mensaje = `<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;">`;
  mensaje += `<h2 style="color:#1a1a1a;margin-bottom:4px;">📋 Resumen diario — ${formatDate(today)}</h2>`;
  mensaje += `<p style="color:#666;margin-top:0;">Tu revisión del día con temas, subtareas y checklist.</p>`;
  mensaje += buildSection('📌 Hoy', todayItems, todayChecklist, today, '#2563eb');
  mensaje += buildSection('🔴 Atrasados', overdueItems, overdueChecklist, today, '#dc2626');
  mensaje += buildSection('🟡 Próximos (3 días)', upcomingItems, upcomingChecklist, today, '#d97706');
  mensaje += `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"><p style="font-size:11px;color:#aaa;">📧 Correo automático de resumen diario.</p></div>`;

  const overdueTotal = overdueItems.length + overdueChecklist.length;
  const todayTotal = todayItems.length + todayChecklist.length;
  const upcomingTotal = upcomingItems.length + upcomingChecklist.length;
  const asunto = `📋 Resumen diario | ${overdueTotal > 0 ? `🔴 ${overdueTotal} atrasado${overdueTotal > 1 ? 's' : ''} | ` : ''}${todayTotal} hoy | ${upcomingTotal} próximos`;

  try {
    await sendEmail({ to: targetUser.email!, subject: asunto, html: mensaje, cc: [] });
    return { success: true, emails_sent: 1 };
  } catch (e) {
    console.error('Daily summary send error:', e);
    return { success: true, emails_sent: 0 };
  }
}

export const sendDailySummaryScheduled = onSchedule(
  { schedule: 'every day 07:30', timeZone: 'America/Santiago' },
  async () => { await run(); },
);
export const sendDailySummary = onCall(async () => run());
