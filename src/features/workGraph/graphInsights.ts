import type { WorkGraphData, WorkGraphEdge, WorkGraphNode, WorkStatus } from './types';

export type InsightSeverity = 'ok' | 'warn' | 'critical' | 'info';

export interface Insight {
  key: string;
  severity: InsightSeverity;
  text: string;
  nodeId?: string;           // when set, clicking the insight selects this node
  category?: 'overdue' | 'blocked' | 'overload' | 'isolated' | 'dependencies' | 'late_response' | 'score';
}

export interface KPISnapshot {
  activeTasks: number;
  overdueTasks: number;
  overdueWithBlame: number;
  blockedTasks: number;
  overloadedUsers: number;
  connectedAreas: number;
  avgScore: number | null;
  criticalDependencies: number;
  totalTasks: number;
  completedTasks: number;
}

export interface WorkspaceScore {
  score: number | null;       // 0..100
  narrative: string;
  dimensions: {
    cumplimiento: number | null;
    puntualidad: number | null;
    colaboracion: number | null;
    salud_general: number | null;
  };
}

function edgeSourceId(e: WorkGraphEdge): string {
  return typeof e.source === 'string' ? e.source : (e.source as any)?.id;
}
function edgeTargetId(e: WorkGraphEdge): string {
  return typeof e.target === 'string' ? e.target : (e.target as any)?.id;
}

function indexBy<T extends { id: string }>(arr: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of arr) m.set(x.id, x);
  return m;
}

// ---------- Individual analyses ----------

export function detectOverdueTasks(data: WorkGraphData): Insight[] {
  const overdue = data.nodes.filter((n) => n.type === 'task' && n.status === 'overdue');
  if (overdue.length === 0) return [];
  const withBlame = overdue.filter((n) => (n.metadata as any)?.noFaultOfAssignee).length;
  return [{
    key: 'overdue.total',
    severity: withBlame === overdue.length ? 'warn' : 'critical',
    category: 'overdue',
    text: withBlame > 0
      ? `${overdue.length} tareas vencidas (${withBlame} con bloqueo externo que justifica el atraso).`
      : `${overdue.length} tareas vencidas sin bloqueo identificado — revisar urgentemente.`,
  }];
}

export function detectBlockedChains(data: WorkGraphData): Insight[] {
  // Look for OUTGOING BLOCKED_BY / DEPENDS_ON / WAITING_FOR edges where the target
  // is non-completed. Group by blocker to produce executive sentences like:
  // "Operaciones bloquea 3 tareas de Finanzas".
  const byIndex = indexBy(data.nodes);
  const blockerCounts = new Map<string, { blocker: WorkGraphNode; tasks: Set<string>; areas: Set<string> }>();
  for (const e of data.links) {
    if (!['BLOCKED_BY', 'DEPENDS_ON', 'WAITING_FOR'].includes(e.type)) continue;
    const src = byIndex.get(edgeSourceId(e));
    const tgt = byIndex.get(edgeTargetId(e));
    if (!src || !tgt || src.type !== 'task') continue;
    if (tgt.type === 'task' && tgt.status === 'completed') continue;
    const entry = blockerCounts.get(tgt.id) ?? { blocker: tgt, tasks: new Set<string>(), areas: new Set<string>() };
    entry.tasks.add(src.id);
    if (src.areaId) entry.areas.add(src.areaId);
    blockerCounts.set(tgt.id, entry);
  }
  const out: Insight[] = [];
  for (const { blocker, tasks, areas } of blockerCounts.values()) {
    if (tasks.size === 0) continue;
    const areaLabels = [...areas].map((a) => byIndex.get(a)?.label).filter(Boolean).slice(0, 2).join(', ');
    out.push({
      key: `blocked.${blocker.id}`,
      severity: tasks.size >= 3 ? 'critical' : 'warn',
      category: 'blocked',
      nodeId: blocker.id,
      text: `${blocker.label} está bloqueando ${tasks.size} tarea${tasks.size === 1 ? '' : 's'}${areaLabels ? ` (${areaLabels})` : ''}.`,
    });
  }
  return out.slice(0, 6);
}

export function detectOverloadedUsers(data: WorkGraphData, threshold = 5): Insight[] {
  // Count active tasks assigned to each user via ASSIGNED_TO edges.
  const byIndex = indexBy(data.nodes);
  const load = new Map<string, { user: WorkGraphNode; active: number; overdue: number }>();
  for (const e of data.links) {
    if (e.type !== 'ASSIGNED_TO') continue;
    const task = byIndex.get(edgeSourceId(e));
    const user = byIndex.get(edgeTargetId(e));
    if (!task || !user || user.type !== 'user') continue;
    const entry = load.get(user.id) ?? { user, active: 0, overdue: 0 };
    if (task.status === 'active' || task.status === 'overdue') entry.active += 1;
    if (task.status === 'overdue') entry.overdue += 1;
    load.set(user.id, entry);
  }
  return [...load.values()]
    .filter((x) => x.active >= threshold)
    .sort((a, b) => b.active - a.active)
    .slice(0, 6)
    .map(({ user, active, overdue }) => ({
      key: `overload.${user.id}`,
      severity: overdue > 0 ? 'critical' : 'warn',
      category: 'overload',
      nodeId: user.id,
      text: `${user.label} tiene ${active} tarea${active === 1 ? '' : 's'} activa${active === 1 ? '' : 's'}${overdue > 0 ? ` y ${overdue} vencida${overdue === 1 ? '' : 's'}` : ''}.`,
    }));
}

export function detectIsolatedAreas(data: WorkGraphData): Insight[] {
  // An area is "isolated" if it has no task connections to users outside its
  // own membership. Quick heuristic: area has ≤1 connected task.
  const byIndex = indexBy(data.nodes);
  const tasksByArea = new Map<string, number>();
  for (const e of data.links) {
    if (e.type !== 'BELONGS_TO_AREA') continue;
    const src = byIndex.get(edgeSourceId(e));
    const tgt = byIndex.get(edgeTargetId(e));
    if (!src || !tgt || tgt.type !== 'area') continue;
    if (src.type !== 'task') continue;
    tasksByArea.set(tgt.id, (tasksByArea.get(tgt.id) ?? 0) + 1);
  }
  const areas = data.nodes.filter((n) => n.type === 'area');
  const isolated = areas.filter((a) => (tasksByArea.get(a.id) ?? 0) <= 1);
  return isolated.slice(0, 4).map((a) => ({
    key: `isolated.${a.id}`,
    severity: 'info' as InsightSeverity,
    category: 'isolated' as const,
    nodeId: a.id,
    text: `${a.label} tiene poca actividad conectada — revisar carga.`,
  }));
}

export function detectCriticalDependencies(data: WorkGraphData): Insight[] {
  // Tasks with ≥3 open outgoing blockers are critical.
  const byIndex = indexBy(data.nodes);
  const openBlockers = new Map<string, number>();
  for (const e of data.links) {
    if (!['BLOCKED_BY', 'DEPENDS_ON', 'WAITING_FOR', 'APPROVED_BY'].includes(e.type)) continue;
    const src = byIndex.get(edgeSourceId(e));
    const tgt = byIndex.get(edgeTargetId(e));
    if (!src || !tgt) continue;
    if (src.type !== 'task') continue;
    if (tgt.type === 'task' && tgt.status === 'completed') continue;
    openBlockers.set(src.id, (openBlockers.get(src.id) ?? 0) + 1);
  }
  const critical = [...openBlockers.entries()]
    .filter(([, n]) => n >= 3)
    .map(([taskId, count]) => {
      const node = byIndex.get(taskId)!;
      return {
        key: `critdep.${taskId}`,
        severity: 'critical' as InsightSeverity,
        category: 'dependencies' as const,
        nodeId: taskId,
        text: `${node.label} tiene ${count} dependencias abiertas — riesgo alto de atraso.`,
      };
    });
  return critical.slice(0, 4);
}

export function detectLateResponders(data: WorkGraphData): Insight[] {
  // Count RESPONDED_LATE and RESPONDED_ON_TIME edges per user.
  const byIndex = indexBy(data.nodes);
  const stats = new Map<string, { user: WorkGraphNode; late: number; onTime: number }>();
  for (const e of data.links) {
    if (e.type !== 'RESPONDED_LATE' && e.type !== 'RESPONDED_ON_TIME') continue;
    const user = byIndex.get(edgeSourceId(e));
    if (!user || user.type !== 'user') continue;
    const entry = stats.get(user.id) ?? { user, late: 0, onTime: 0 };
    if (e.type === 'RESPONDED_LATE') entry.late += 1; else entry.onTime += 1;
    stats.set(user.id, entry);
  }
  return [...stats.values()]
    .filter((x) => x.late > 0 && x.late / (x.late + x.onTime) >= 0.3)
    .sort((a, b) => b.late - a.late)
    .slice(0, 5)
    .map(({ user, late, onTime }) => ({
      key: `latersp.${user.id}`,
      severity: late > onTime ? 'critical' : 'warn' as InsightSeverity,
      category: 'late_response' as const,
      nodeId: user.id,
      text: `${user.label} respondió tarde ${late} de ${late + onTime} correos.`,
    }));
}

// ---------- KPIs + score ----------

export function computeKPIs(data: WorkGraphData): KPISnapshot {
  const tasks = data.nodes.filter((n) => n.type === 'task');
  const totalTasks = tasks.length;
  const activeTasks = tasks.filter((t) => t.status === 'active' || t.status === 'overdue').length;
  const overdueTasks = tasks.filter((t) => t.status === 'overdue').length;
  const overdueWithBlame = tasks.filter((t) => t.status === 'overdue' && (t.metadata as any)?.noFaultOfAssignee).length;
  const blockedTasks = tasks.filter((t) => t.status === 'blocked').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;

  // Overloaded users = assigned ≥5 active tasks.
  const overloaded = detectOverloadedUsers(data, 5);
  const overloadedUsers = overloaded.length;

  // Areas that have at least one ASSIGNED_TO-linked task.
  const byIndex = indexBy(data.nodes);
  const connectedAreaIds = new Set<string>();
  for (const e of data.links) {
    if (e.type !== 'BELONGS_TO_AREA') continue;
    const src = byIndex.get(edgeSourceId(e));
    const tgt = byIndex.get(edgeTargetId(e));
    if (!src || !tgt) continue;
    if (src.type !== 'task') continue;
    connectedAreaIds.add(tgt.id);
  }
  const connectedAreas = connectedAreaIds.size;

  const scores = tasks.map((t) => t.score).filter((v): v is number => typeof v === 'number');
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const criticalDependencies = detectCriticalDependencies(data).length;

  return {
    activeTasks,
    overdueTasks,
    overdueWithBlame,
    blockedTasks,
    overloadedUsers,
    connectedAreas,
    avgScore,
    criticalDependencies,
    totalTasks,
    completedTasks,
  };
}

export function computeWorkspaceScore(data: WorkGraphData): WorkspaceScore {
  const kpis = computeKPIs(data);

  const cumplimiento = kpis.totalTasks > 0
    ? Math.round((kpis.completedTasks / kpis.totalTasks) * 100)
    : null;
  // Punctuality: 1 - (overdue_without_blame / total_tasks).
  const overdueNoBlame = kpis.overdueTasks - kpis.overdueWithBlame;
  const puntualidad = kpis.totalTasks > 0
    ? Math.max(0, Math.round((1 - overdueNoBlame / kpis.totalTasks) * 100))
    : null;
  // Collaboration: share of users with >0 collaboration edges.
  const users = data.nodes.filter((n) => n.type === 'user');
  const collabEdges = data.links.filter((e) => e.type === 'COLLABORATES_WITH');
  const withCollab = new Set<string>();
  for (const e of collabEdges) {
    withCollab.add(edgeSourceId(e));
    withCollab.add(edgeTargetId(e));
  }
  const colaboracion = users.length > 0 ? Math.round((withCollab.size / users.length) * 100) : null;
  // General health: inverse of critical dependencies and blocked task share.
  const healthPenalty = Math.min(60, kpis.criticalDependencies * 15 + kpis.blockedTasks * 10);
  const salud_general = kpis.totalTasks === 0 ? null : Math.max(0, 100 - healthPenalty);

  const dims = { cumplimiento, puntualidad, colaboracion, salud_general };
  const values = Object.values(dims).filter((v): v is number => typeof v === 'number');
  const score = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

  const narrative = narrativeForScore(score, kpis);

  return { score, narrative, dimensions: dims };
}

function narrativeForScore(score: number | null, k: KPISnapshot): string {
  if (score == null) return 'Todavía no hay suficientes datos para evaluar la operación.';
  if (score >= 85) return `Operación saludable (${score}). ${k.completedTasks} tareas cerradas, ${k.overdueTasks} atrasos.`;
  if (score >= 65) {
    const parts = [];
    if (k.overdueTasks > 0) parts.push(`${k.overdueTasks} atrasos`);
    if (k.criticalDependencies > 0) parts.push(`${k.criticalDependencies} dependencias críticas`);
    return `Operación estable (${score})${parts.length ? ': ' + parts.join(', ') : ''}.`;
  }
  return `Operación en riesgo (${score}) — revisar bloqueos y sobrecarga.`;
}

// ---------- Additional analyses ----------

/**
 * Bottlenecks: nodes (typically users or areas) that accumulate many incoming
 * DEPENDS_ON / BLOCKED_BY / WAITING_FOR edges. They're the "chokepoints" whose
 * unblocking would cascade-release work elsewhere.
 */
export function detectBottlenecks(data: WorkGraphData): Insight[] {
  const byIndex = indexBy(data.nodes);
  const counts = new Map<string, number>();
  for (const e of data.links) {
    if (!['DEPENDS_ON', 'BLOCKED_BY', 'WAITING_FOR'].includes(e.type)) continue;
    const tgt = edgeTargetId(e);
    counts.set(tgt, (counts.get(tgt) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => {
      const n = byIndex.get(id);
      return {
        key: `bottleneck.${id}`,
        severity: count >= 4 ? 'critical' as InsightSeverity : 'warn' as InsightSeverity,
        category: 'blocked' as const,
        nodeId: id,
        text: `${n?.label ?? 'Nodo'} concentra ${count} dependencias entrantes — riesgo de cuello de botella.`,
      };
    });
}

/**
 * Risky projects: projects whose derived metadata flags them as risk (riskLevel
 * 4) or have any overdue/blocked task.
 */
export function detectRiskyProjects(data: WorkGraphData): Insight[] {
  const projects = data.nodes.filter((n) => n.type === 'project');
  const insights: Insight[] = [];
  for (const p of projects) {
    const m = (p.metadata ?? {}) as any;
    const overdue = m.overdueTasks ?? 0;
    const blocked = m.blockedTasks ?? 0;
    const critical = m.criticalTasks ?? 0;
    if (overdue === 0 && blocked === 0 && critical === 0) continue;
    const parts: string[] = [];
    if (overdue > 0) parts.push(`${overdue} vencida${overdue === 1 ? '' : 's'}`);
    if (blocked > 0) parts.push(`${blocked} bloqueada${blocked === 1 ? '' : 's'}`);
    if (critical > 0) parts.push(`${critical} crítica${critical === 1 ? '' : 's'}`);
    insights.push({
      key: `risky_project.${p.id}`,
      severity: (m.riskLevel ?? 0) >= 4 ? 'critical' : 'warn',
      category: 'dependencies',
      nodeId: p.id,
      text: `Proyecto ${p.label} tiene ${parts.join(', ')}.`,
    });
  }
  return insights.slice(0, 4);
}

/**
 * Top collaborators: users with the highest inferred collaboration count
 * (pairwise COLLABORATES_WITH edges). Useful as a quick morale/health read.
 */
export function detectTopCollaborators(data: WorkGraphData): Insight[] {
  const byIndex = indexBy(data.nodes);
  const collabCount = new Map<string, number>();
  for (const e of data.links) {
    if (e.type !== 'COLLABORATES_WITH') continue;
    const a = edgeSourceId(e);
    const b = edgeTargetId(e);
    collabCount.set(a, (collabCount.get(a) ?? 0) + (e.weight ?? 1));
    collabCount.set(b, (collabCount.get(b) ?? 0) + (e.weight ?? 1));
  }
  return [...collabCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => {
      const n = byIndex.get(id);
      return {
        key: `collaborator.${id}`,
        severity: 'ok' as InsightSeverity,
        nodeId: id,
        text: `${n?.label ?? 'Persona'} colabora activamente (${count} interacciones).`,
      };
    });
}

// ---------- Root cause + action recommendation per node ----------

const ROOT_CAUSE_LABELS: Record<string, { text: string; severity: InsightSeverity }> = {
  responsible_delay: {
    text: 'El atraso parece responsabilidad directa del asignado.',
    severity: 'critical',
  },
  internal_dependency_delay: {
    text: 'El atraso no parece responsabilidad directa del asignado — depende de otra parte interna.',
    severity: 'warn',
  },
  external_client_delay: {
    text: 'El atraso depende de un cliente externo — escalar si impacta plazos.',
    severity: 'info',
  },
  blocked_with_reason: {
    text: 'Bloqueo documentado. El atraso está justificado operativamente.',
    severity: 'warn',
  },
  blocked_without_reason: {
    text: 'Bloqueo sin motivo registrado — agregar razón de bloqueo para trazabilidad.',
    severity: 'critical',
  },
  unrealistic_deadline: {
    text: 'La ventana entre inicio y fecha límite era muy corta (< 2 días).',
    severity: 'warn',
  },
  unknown: {
    text: 'Atraso sin causa clara — revisar manualmente.',
    severity: 'info',
  },
};

export function rootCauseInsight(node: WorkGraphNode): { code: string; text: string; severity: InsightSeverity } | null {
  if (node.type !== 'task' || node.status !== 'overdue') return null;
  const code = ((node.metadata as any)?.rootCause as string) ?? 'unknown';
  const entry = ROOT_CAUSE_LABELS[code] ?? ROOT_CAUSE_LABELS.unknown;
  return { code, ...entry };
}

export function recommendAction(node: WorkGraphNode, data: WorkGraphData): string | null {
  const meta = (node.metadata ?? {}) as any;
  if (node.type === 'task') {
    if (node.status === 'overdue') {
      const rc = (meta.rootCause as string) ?? 'unknown';
      if (rc === 'blocked_without_reason') return 'Documentar el motivo del bloqueo y asignar un desbloqueador concreto.';
      if (rc === 'external_client_delay') return 'Escalar al cliente e informar nueva fecha estimada.';
      if (rc === 'internal_dependency_delay') return `Coordinar con ${meta.blameLabel ?? 'la dependencia'} para destrabar esta tarea.`;
      if (rc === 'unrealistic_deadline') return 'Renegociar fecha límite — la ventana original era muy corta.';
      return 'Contactar al responsable hoy. Solicitar plan de recuperación en 24 h.';
    }
    if (node.status === 'blocked') return 'Revisar motivo del bloqueo y definir un dueño para destrabarlo.';
    if ((meta.riskLevel ?? 0) >= 3) return 'Priorizar esta tarea en el próximo standup.';
  }
  if (node.type === 'user') {
    const active = meta.activeTasks ?? 0;
    const overdue = meta.overdueTasks ?? 0;
    if (overdue > 0) return `Revisar en 1-a-1: ${overdue} tarea${overdue === 1 ? '' : 's'} vencida${overdue === 1 ? '' : 's'}.`;
    if (active >= 7) return `Carga alta (${active} activas). Re-balancear o pausar trabajo no crítico.`;
    const rate = meta.onTimeResponseRate;
    if (typeof rate === 'number' && rate < 0.6) return 'Mejorar puntualidad en respuestas — tasa a tiempo bajo 60%.';
  }
  if (node.type === 'area') {
    if (meta.bottleneckRisk === 'high') return 'Cuello de botella detectado — reasignar responsabilidades o reforzar equipo.';
    if ((meta.overdueTasks ?? 0) >= 2) return 'Múltiples atrasos en esta área — reunión de coordinación.';
  }
  if (node.type === 'project') {
    if ((meta.riskLevel ?? 0) >= 4) return 'Proyecto en riesgo alto — revisión ejecutiva esta semana.';
    if ((meta.blockedTasks ?? 0) > 0) return 'Hay tareas bloqueadas que impactan el proyecto. Priorizar desbloqueo.';
  }
  return null;
}

// ---------- Top-level aggregator ----------

export function buildInsights(data: WorkGraphData): Insight[] {
  return [
    ...detectOverdueTasks(data),
    ...detectRiskyProjects(data),
    ...detectBlockedChains(data),
    ...detectBottlenecks(data),
    ...detectOverloadedUsers(data),
    ...detectCriticalDependencies(data),
    ...detectLateResponders(data),
    ...detectTopCollaborators(data),
    ...detectIsolatedAreas(data),
  ];
}
