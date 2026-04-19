import { isStoredDateOverdue } from '@/lib/date';
import type {
  ClientEntity,
  ProjectEntity,
  WorkGraphData,
  WorkGraphEdge,
  WorkGraphNode,
  WorkRelationship,
  WorkStatus,
} from './types';

export interface BuildGraphInput {
  workspaces: any[];
  topics: any[];
  assignees: any[];
  departments: any[];
  subtasks: any[];
  emails: any[];
  projects: ProjectEntity[];
  clients: ClientEntity[];
  relationships: WorkRelationship[];
  /** ISO cutoff for historical rewind. Records created after this are excluded. */
  asOf?: string | null;
}

/**
 * Pure builder: takes raw collections and produces the graph. No React, no
 * Firestore, no hooks — easy to test in isolation and cheap to re-run when
 * inputs change. Kept intentionally flat: every rule from the spec is one
 * clearly-named block so future edits stay surgical.
 */
export function buildWorkGraph(input: BuildGraphInput): WorkGraphData {
  const asOfTime = input.asOf ? new Date(input.asOf).getTime() : null;
  const createdBefore = (row: any): boolean => {
    if (!asOfTime) return true;
    if (!row?.created_at) return true;
    const t = new Date(row.created_at).getTime();
    return Number.isFinite(t) ? t <= asOfTime : true;
  };

  const workspaces = input.workspaces.filter(createdBefore);
  const topics = input.topics.filter(createdBefore);
  const assignees = input.assignees.filter(createdBefore);
  const departments = input.departments.filter(createdBefore);
  const emails = input.emails.filter(createdBefore);
  const subtasks = input.subtasks.filter(createdBefore);
  const projects = input.projects.filter(createdBefore);
  const clients = input.clients.filter(createdBefore);
  const relationships = input.relationships.filter(createdBefore);

  const nodes: WorkGraphNode[] = [];
  const links: WorkGraphEdge[] = [];
  const nodeIndex = new Map<string, WorkGraphNode>();

  const addNode = (n: WorkGraphNode): WorkGraphNode => {
    const existing = nodeIndex.get(n.id);
    if (existing) {
      existing.importance = Math.max(existing.importance ?? 1, n.importance ?? 1);
      if (n.metadata) existing.metadata = { ...(existing.metadata ?? {}), ...n.metadata };
      return existing;
    }
    nodeIndex.set(n.id, n);
    nodes.push(n);
    return n;
  };
  const addEdge = (e: WorkGraphEdge) => {
    if (!nodeIndex.has(e.source) || !nodeIndex.has(e.target)) return;
    links.push(e);
  };

  // ---------- Workspace nodes (only those with content) ----------
  const referencedWsIds = new Set<string>();
  for (const r of [...topics, ...assignees, ...departments, ...emails]) {
    if (r.workspace_id) referencedWsIds.add(r.workspace_id);
  }
  for (const w of workspaces) {
    if (!referencedWsIds.has(w.id)) continue;
    addNode({
      id: `workspace:${w.id}`,
      type: 'workspace',
      label: w.name || 'Workspace',
      subtitle: 'Workspace',
      importance: 8,
      status: 'active',
      createdAt: w.created_at,
    });
  }
  const linkToWorkspace = (childId: string, wsId?: string | null) => {
    if (!wsId) return;
    const target = `workspace:${wsId}`;
    if (!nodeIndex.has(target)) return;
    addEdge({
      id: `e:inws:${childId}->${target}`,
      source: childId,
      target,
      type: 'BELONGS_TO_WORKSPACE',
      direction: 'directed',
      strength: 0.25,
    });
  };

  // ---------- Areas (departments) ----------
  for (const d of departments) {
    const id = `area:${d.id}`;
    addNode({
      id,
      type: 'area',
      label: d.name || 'Área',
      subtitle: 'Departamento',
      importance: 3,
      createdAt: d.created_at,
      metadata: { workspace_id: d.workspace_id },
    });
    linkToWorkspace(id, d.workspace_id);
  }

  // ---------- Clients (global) ----------
  for (const c of clients) {
    addNode({
      id: `client:${c.id}`,
      type: 'client',
      label: c.name || 'Cliente',
      subtitle: c.contact_email || undefined,
      importance: 5,
      status: 'active',
      createdAt: c.created_at,
      metadata: { color: c.color },
    });
  }

  // ---------- Projects (global) + client linkage ----------
  for (const p of projects) {
    const id = `project:${p.id}`;
    addNode({
      id,
      type: 'project',
      label: p.name || 'Proyecto',
      subtitle: p.description || 'Proyecto',
      importance: 5,
      status: p.archived ? 'pending' : 'active',
      createdAt: p.created_at,
      metadata: { color: p.color, client_id: p.client_id },
    });
    if (p.client_id) {
      addEdge({
        id: `e:proj-client:${p.id}`,
        source: id,
        target: `client:${p.client_id}`,
        type: 'BELONGS_TO_CLIENT',
        direction: 'directed',
        strength: 0.5,
      });
    }
  }

  // ---------- Users (cross-workspace merged by email or name) ----------
  const userIdByKey = new Map<string, string>();
  const keyForAssignee = (a: any): string => {
    const email = (a.email || '').trim().toLowerCase();
    return email ? `email:${email}` : `name:${(a.name || '').trim().toLowerCase()}`;
  };
  for (const a of assignees) {
    const key = keyForAssignee(a);
    let id = userIdByKey.get(key);
    if (!id) {
      id = `user:${key}`;
      userIdByKey.set(key, id);
      addNode({
        id,
        type: 'user',
        label: a.name || a.email || 'Responsable',
        subtitle: a.email || undefined,
        importance: 4,
        status: 'active',
        areaId: a.department_id ? `area:${a.department_id}` : undefined,
        metadata: { email: a.email, weeklyCapacity: a.weekly_capacity, workspaceIds: [a.workspace_id] },
        createdAt: a.created_at,
      });
    } else {
      const n = nodeIndex.get(id)!;
      n.importance = (n.importance ?? 4) + 0.8;
      const meta = (n.metadata ?? {}) as any;
      const ids = new Set<string>(meta.workspaceIds ?? []);
      ids.add(a.workspace_id);
      n.metadata = { ...meta, workspaceIds: [...ids] };
    }
    if (a.department_id) {
      addEdge({
        id: `e:user-area:${id}->${a.department_id}`,
        source: id!,
        target: `area:${a.department_id}`,
        type: 'BELONGS_TO_AREA',
        direction: 'directed',
        strength: 0.4,
      });
    }
    linkToWorkspace(id!, a.workspace_id);
  }
  const userIdFor = (name?: string | null, email?: string | null): string | null => {
    const em = (email || '').trim().toLowerCase();
    if (em && userIdByKey.has(`email:${em}`)) return userIdByKey.get(`email:${em}`)!;
    const nm = (name || '').trim().toLowerCase();
    if (nm && userIdByKey.has(`name:${nm}`)) return userIdByKey.get(`name:${nm}`)!;
    return null;
  };

  // Owner user (the authenticated creator) — index by topic.user_id so we can
  // emit CREATED_BY edges even if the creator isn't a registered assignee.
  const ownerUserIds = new Set<string>();
  for (const t of topics) if (t.user_id) ownerUserIds.add(t.user_id);
  // We don't have a users collection mapping user_id → display; skip rendering
  // CREATED_BY to external uid nodes unless user_id matches an assignee we know.

  // ---------- Subtask grouping (for completion score on tasks) ----------
  const subtasksByTopic = new Map<string, any[]>();
  for (const s of subtasks) {
    const arr = subtasksByTopic.get(s.topic_id) ?? [];
    arr.push(s);
    subtasksByTopic.set(s.topic_id, arr);
  }

  // ---------- Tasks ----------
  for (const t of topics) {
    const tSubs = subtasksByTopic.get(t.id) ?? [];
    const done = tSubs.filter((s: any) => s.completed).length;
    const total = tSubs.length;
    const overdue = t.due_date && !t.is_ongoing && t.status !== 'completado' && isStoredDateOverdue(t.due_date);

    let status: WorkStatus = 'pending';
    if (t.status === 'completado') status = 'completed';
    else if (overdue) status = 'overdue';
    else if (t.status === 'seguimiento' || t.status === 'activo') status = 'active';
    else if (t.status === 'pausado') status = 'blocked';

    const riskLevel = overdue ? 4 : t.priority === 'alta' ? 3 : t.priority === 'media' ? 2 : 1;
    const importance = 3 + Math.min(tSubs.length, 6) * 0.5 + (t.priority === 'alta' ? 2 : 0);
    const taskId = `task:${t.id}`;

    addNode({
      id: taskId,
      type: 'task',
      label: t.title || 'Tema',
      subtitle: total > 0 ? `${done}/${total} subtareas` : (t.assignee || '—'),
      status,
      score: total ? done / total : undefined,
      importance,
      riskLevel,
      ownerId: t.user_id,
      areaId: t.department_id ? `area:${t.department_id}` : undefined,
      projectId: t.project_id ? `project:${t.project_id}` : undefined,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      metadata: {
        workspace_id: t.workspace_id,
        priority: t.priority,
        due_date: t.due_date,
        start_date: t.start_date,
        execution_order: t.execution_order,
        is_ongoing: t.is_ongoing,
        rawStatus: t.status,
        assigneeName: t.assignee,
        pause_reason: t.pause_reason,
        project_id: t.project_id,
        client_id: t.client_id,
      },
    });
    linkToWorkspace(taskId, t.workspace_id);

    if (t.assignee) {
      let userId = userIdFor(t.assignee);
      if (!userId) {
        const key = `name:${t.assignee.trim().toLowerCase()}`;
        userId = `user:${key}`;
        userIdByKey.set(key, userId);
        addNode({
          id: userId,
          type: 'user',
          label: t.assignee,
          subtitle: 'Sin registro en Responsables',
          importance: 2,
          status: 'pending',
        });
      }
      addEdge({
        id: `e:assigned:${t.id}->${userId}`,
        source: taskId,
        target: userId,
        type: 'ASSIGNED_TO',
        direction: 'directed',
        strength: 1,
      });
      if (overdue) {
        addEdge({
          id: `e:overdue:${t.id}`,
          source: taskId,
          target: userId,
          type: 'OVERDUE',
          direction: 'directed',
          strength: 0.6,
          status: 'overdue',
        });
      }
      if (t.status === 'completado') {
        addEdge({
          id: `e:completed:${t.id}`,
          source: userId,
          target: taskId,
          type: 'COMPLETED_BY',
          direction: 'directed',
          strength: 0.5,
          status: 'completed',
        });
      }
    }
    if (t.department_id) {
      addEdge({
        id: `e:task-area:${t.id}`,
        source: taskId,
        target: `area:${t.department_id}`,
        type: 'BELONGS_TO_AREA',
        direction: 'directed',
        strength: 0.4,
      });
    }
    if (t.project_id) {
      const pid = `project:${t.project_id}`;
      if (nodeIndex.has(pid)) {
        addEdge({
          id: `e:task-project:${t.id}`,
          source: taskId,
          target: pid,
          type: 'IMPACTS_PROJECT',
          direction: 'directed',
          strength: 0.55,
        });
      }
    }
    if (t.client_id) {
      const cid = `client:${t.client_id}`;
      if (nodeIndex.has(cid)) {
        addEdge({
          id: `e:task-client:${t.id}`,
          source: taskId,
          target: cid,
          type: 'IMPACTS',
          direction: 'directed',
          strength: 0.45,
        });
      }
    }
  }

  // ---------- Notification emails: EMAIL_SENT + RESPONDED_* ----------
  for (const em of emails) {
    if (!em.assignee_name || !em.topic_id) continue;
    const userId = userIdFor(em.assignee_name, em.assignee_email);
    const taskId = `task:${em.topic_id}`;
    if (!userId || !nodeIndex.has(taskId)) continue;

    addEdge({
      id: `e:email:${em.id}`,
      source: taskId,
      target: userId,
      type: 'EMAIL_SENT',
      direction: 'directed',
      strength: 0.3,
    });
    if (em.confirmed && em.confirmed_at && em.sent_at) {
      const deadline = new Date(em.sent_at).getTime() + 48 * 60 * 60 * 1000;
      const onTime = new Date(em.confirmed_at).getTime() <= deadline;
      addEdge({
        id: `e:resp:${em.id}`,
        source: userId,
        target: taskId,
        type: onTime ? 'RESPONDED_ON_TIME' : 'RESPONDED_LATE',
        direction: 'directed',
        strength: onTime ? 0.5 : 0.6,
        status: onTime ? 'healthy' : 'overdue',
      });
    }
  }

  // ---------- Inferred collaboration (pairwise co-workers) ----------
  const usersByTask = new Map<string, Set<string>>();
  for (const l of links) {
    if (l.type === 'ASSIGNED_TO' || l.type === 'EMAIL_SENT') {
      const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
      if (s.startsWith('task:') && t.startsWith('user:')) {
        const set = usersByTask.get(s) ?? new Set<string>();
        set.add(t);
        usersByTask.set(s, set);
      }
    }
  }
  const collabCounts = new Map<string, number>();
  for (const [, userSet] of usersByTask) {
    const arr = [...userSet];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = [arr[i], arr[j]].sort().join('|');
        collabCounts.set(key, (collabCounts.get(key) ?? 0) + 1);
      }
    }
  }
  for (const [pair, count] of collabCounts) {
    const [a, b] = pair.split('|');
    addEdge({
      id: `e:collab:${pair}`,
      source: a,
      target: b,
      type: 'COLLABORATES_WITH',
      direction: 'bidirectional',
      strength: Math.min(1, 0.3 + count * 0.1),
      weight: count,
      label: `${count} colaboración${count === 1 ? '' : 'es'}`,
    });
  }

  // ---------- Manual relationships (user-declared edges) ----------
  //
  // Accept any (source_type, target_type) combination since the user chose
  // "todo con todo". We skip edges whose endpoints aren't in the graph
  // (e.g. targeting a deleted project). These edges get rendered with their
  // `reason` exposed in the inspector.
  for (const r of relationships) {
    const source = nodeIdFromRef(r.source_type, r.source_id);
    const target = nodeIdFromRef(r.target_type, r.target_id);
    if (!source || !target) continue;
    if (!nodeIndex.has(source) || !nodeIndex.has(target)) continue;
    addEdge({
      id: `e:manual:${r.id}`,
      source,
      target,
      type: r.edge_type,
      direction: 'directed',
      strength: Math.min(1, 0.5 + (r.weight ?? 1) * 0.1),
      weight: r.weight ?? 1,
      reason: r.reason ?? undefined,
      createdAt: r.created_at,
      metadata: { relationshipId: r.id, manual: true },
    });
  }

  // ---------- Dependency-aware overdue attribution ----------
  //
  // If a task is overdue AND has an outgoing DEPENDS_ON / BLOCKED_BY /
  // WAITING_FOR edge whose target is still open, mark the task's metadata
  // as `noFaultOfAssignee`. NodeInspector uses this to show a banner.
  const blockingEdgeTypes = new Set(['DEPENDS_ON', 'BLOCKED_BY', 'WAITING_FOR']);
  for (const taskNode of nodes) {
    if (taskNode.type !== 'task' || taskNode.status !== 'overdue') continue;
    const blockers: Array<{ id: string; label: string; status?: WorkStatus; type?: string; reason?: string }> = [];
    for (const l of links) {
      const source = typeof l.source === 'string' ? l.source : (l.source as any).id;
      if (source !== taskNode.id) continue;
      if (!blockingEdgeTypes.has(l.type)) continue;
      const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      const targetNode = nodeIndex.get(targetId);
      if (!targetNode) continue;
      if (targetNode.type === 'task' && targetNode.status === 'completed') continue;
      blockers.push({
        id: targetNode.id,
        label: targetNode.label,
        status: targetNode.status,
        type: targetNode.type,
        reason: l.reason,
      });
    }
    if (blockers.length > 0) {
      taskNode.metadata = {
        ...(taskNode.metadata ?? {}),
        noFaultOfAssignee: true,
        blameSourceId: blockers[0].id,
        blameLabel: blockers[0].label,
        blameBlockers: blockers,
      };
    }
  }

  // ---------- Per-entity aggregated metrics ----------
  //
  // These numbers power the NodeInspector's per-type panels and the KPIStrip.
  // Computing here once, client-side, keeps the Firestore read-path simple
  // (no aggregation queries) and guarantees metric consistency across views.
  const tasksByUser = new Map<string, WorkGraphNode[]>();
  const tasksByArea = new Map<string, WorkGraphNode[]>();
  const tasksByProject = new Map<string, WorkGraphNode[]>();
  const tasksByClient = new Map<string, WorkGraphNode[]>();
  const userOnTime = new Map<string, number>();
  const userLate = new Map<string, number>();
  const userCollaborators = new Map<string, Set<string>>();
  const incomingBlockerCount = new Map<string, number>(); // count of blocker edges pointing at node

  for (const l of links) {
    const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
    const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
    const src = nodeIndex.get(srcId);
    const tgt = nodeIndex.get(tgtId);
    if (!src || !tgt) continue;

    if (l.type === 'ASSIGNED_TO' && src.type === 'task' && tgt.type === 'user') {
      (tasksByUser.get(tgt.id) ?? tasksByUser.set(tgt.id, []).get(tgt.id)!).push(src);
    }
    if (l.type === 'BELONGS_TO_AREA' && src.type === 'task' && tgt.type === 'area') {
      (tasksByArea.get(tgt.id) ?? tasksByArea.set(tgt.id, []).get(tgt.id)!).push(src);
    }
    if (l.type === 'IMPACTS_PROJECT' && src.type === 'task' && tgt.type === 'project') {
      (tasksByProject.get(tgt.id) ?? tasksByProject.set(tgt.id, []).get(tgt.id)!).push(src);
    }
    if (l.type === 'IMPACTS' && src.type === 'task' && tgt.type === 'client') {
      (tasksByClient.get(tgt.id) ?? tasksByClient.set(tgt.id, []).get(tgt.id)!).push(src);
    }
    if (l.type === 'RESPONDED_ON_TIME' && src.type === 'user') {
      userOnTime.set(src.id, (userOnTime.get(src.id) ?? 0) + 1);
    }
    if (l.type === 'RESPONDED_LATE' && src.type === 'user') {
      userLate.set(src.id, (userLate.get(src.id) ?? 0) + 1);
    }
    if (l.type === 'COLLABORATES_WITH') {
      (userCollaborators.get(src.id) ?? userCollaborators.set(src.id, new Set()).get(src.id)!).add(tgt.id);
      (userCollaborators.get(tgt.id) ?? userCollaborators.set(tgt.id, new Set()).get(tgt.id)!).add(src.id);
    }
    if (blockingEdgeTypes.has(l.type)) {
      incomingBlockerCount.set(tgt.id, (incomingBlockerCount.get(tgt.id) ?? 0) + 1);
    }
  }

  // User metrics
  for (const user of nodes) {
    if (user.type !== 'user') continue;
    const tasks = tasksByUser.get(user.id) ?? [];
    const activeTasks = tasks.filter((t) => t.status === 'active' || t.status === 'overdue').length;
    const overdueTasks = tasks.filter((t) => t.status === 'overdue').length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const onTime = userOnTime.get(user.id) ?? 0;
    const late = userLate.get(user.id) ?? 0;
    const total = onTime + late;
    const onTimeResponseRate = total > 0 ? onTime / total : null;
    const collaboratorCount = userCollaborators.get(user.id)?.size ?? 0;
    const workloadRisk: 'low' | 'medium' | 'high' = activeTasks >= 7 ? 'high' : activeTasks >= 5 ? 'medium' : 'low';
    user.metadata = {
      ...(user.metadata ?? {}),
      activeTasks,
      overdueTasks,
      completedTasks,
      onTimeResponseRate,
      lateResponses: late,
      onTimeResponses: onTime,
      collaboratorCount,
      workloadRisk,
    };
    user.importance = Math.max(user.importance ?? 4, 3 + Math.min(6, activeTasks * 0.5) + (overdueTasks > 0 ? 2 : 0));
    if (overdueTasks > 0) user.riskLevel = Math.max(user.riskLevel ?? 0, 3);
    if (workloadRisk === 'high') user.status = 'risk';
  }

  // Area metrics — including bottleneck risk
  for (const area of nodes) {
    if (area.type !== 'area') continue;
    const tasks = tasksByArea.get(area.id) ?? [];
    const activeTasks = tasks.filter((t) => t.status === 'active' || t.status === 'overdue').length;
    const overdueTasks = tasks.filter((t) => t.status === 'overdue').length;
    const blockedTasks = tasks.filter((t) => t.status === 'blocked').length;
    const incomingBlocks = incomingBlockerCount.get(area.id) ?? 0;
    const bottleneckRisk: 'low' | 'medium' | 'high' = incomingBlocks >= 3 ? 'high' : incomingBlocks >= 1 ? 'medium' : 'low';
    area.metadata = {
      ...(area.metadata ?? {}),
      activeTasks,
      overdueTasks,
      blockedTasks,
      incomingBlocks,
      bottleneckRisk,
    };
    if (bottleneckRisk === 'high') area.status = 'risk';
  }

  // Project metrics — progress + riskLevel
  for (const project of nodes) {
    if (project.type !== 'project') continue;
    const tasks = tasksByProject.get(project.id) ?? [];
    const activeTasks = tasks.filter((t) => t.status === 'active' || t.status === 'overdue').length;
    const overdueTasks = tasks.filter((t) => t.status === 'overdue').length;
    const blockedTasks = tasks.filter((t) => t.status === 'blocked').length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const criticalTasks = tasks.filter((t) => (t.riskLevel ?? 0) >= 3).length;
    const totalCount = tasks.length;
    const progress = totalCount > 0 ? completedTasks / totalCount : null;
    let riskLevel: number;
    if (overdueTasks > 0 || blockedTasks >= 2) riskLevel = 4;
    else if (criticalTasks >= 3) riskLevel = 3;
    else if (activeTasks > 0) riskLevel = 2;
    else riskLevel = 1;
    project.metadata = {
      ...(project.metadata ?? {}),
      activeTasks,
      overdueTasks,
      blockedTasks,
      completedTasks,
      criticalTasks,
      progress,
      riskLevel,
    };
    project.score = progress ?? undefined;
    project.riskLevel = riskLevel;
    if (riskLevel >= 4) project.status = 'risk';
    else if (progress !== null && progress >= 0.95) project.status = 'completed';
  }

  // Client metrics — simple task count tally
  for (const client of nodes) {
    if (client.type !== 'client') continue;
    const tasks = tasksByClient.get(client.id) ?? [];
    const activeTasks = tasks.filter((t) => t.status === 'active' || t.status === 'overdue').length;
    const overdueTasks = tasks.filter((t) => t.status === 'overdue').length;
    client.metadata = { ...(client.metadata ?? {}), activeTasks, overdueTasks, taskCount: tasks.length };
  }

  // ---------- Root-cause classification (per overdue task) ----------
  //
  // Buckets: responsible_delay, internal_dependency_delay, external_client_delay,
  // blocked_with_reason, blocked_without_reason, unrealistic_deadline, unknown.
  for (const task of nodes) {
    if (task.type !== 'task' || task.status !== 'overdue') continue;
    const meta = (task.metadata ?? {}) as any;
    const blockers: any[] = meta.blameBlockers ?? [];
    let rootCause: string;
    if (blockers.length > 0) {
      const first = blockers[0];
      const hasReason = !!first?.reason;
      if (first?.type === 'client') rootCause = 'external_client_delay';
      else if (first?.type === 'area' || first?.type === 'user' || first?.type === 'task') {
        rootCause = hasReason ? 'blocked_with_reason' : 'internal_dependency_delay';
      } else {
        rootCause = hasReason ? 'blocked_with_reason' : 'blocked_without_reason';
      }
    } else {
      const start = meta.start_date ? new Date(meta.start_date).getTime() : null;
      const due = meta.due_date ? new Date(meta.due_date).getTime() : null;
      if (start && due && Number.isFinite(start) && Number.isFinite(due) && due - start < 2 * 24 * 60 * 60 * 1000) {
        rootCause = 'unrealistic_deadline';
      } else {
        rootCause = 'responsible_delay';
      }
    }
    task.metadata = { ...(task.metadata ?? {}), rootCause };
  }

  return { nodes, links };
}

function nodeIdFromRef(type: string, id: string): string | null {
  if (!type || !id) return null;
  // Our node ids follow `<type>:<uuid-or-key>`. Users stored by merged key
  // (email/name) can't be targeted directly via their record id — manual
  // relationships targeting "user" must use the stable `user:<key>` form.
  // To keep the UI simple we accept raw id for non-user types and assume
  // `user:` ids are already composed in the source.
  if (type === 'user') return id.startsWith('user:') ? id : `user:${id}`;
  return `${type}:${id}`;
}
