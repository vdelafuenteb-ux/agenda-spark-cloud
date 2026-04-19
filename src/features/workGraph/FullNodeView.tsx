import { useMemo } from 'react';
import { X, User2, Building2, Briefcase, Contact as ContactIcon, Lightbulb, History, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useWorkGraphEvents } from './useWorkGraphEvents';
import { recommendAction } from './graphInsights';
import type { WorkGraphData, WorkGraphNode } from './types';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  node: WorkGraphNode | null;
  data: WorkGraphData;
  onSelect: (id: string) => void;
}

// Executive drill-down sheet invoked from NodeInspector's "Ver página completa".
// Renders richer, page-style context for people / areas / projects / clients:
// full task list with status columns, event timeline, collaborators panel.
//
// Deliberately doesn't duplicate NodeInspector — this is the "zoom out",
// inspector is the "zoom in". Both stay consistent by reading from the same
// `data` + `metadata` produced by buildWorkGraph.
export function FullNodeView({ open, onOpenChange, node, data, onSelect }: Props) {
  const { events } = useWorkGraphEvents(node?.id ?? null);

  const relatedTasks = useMemo(() => {
    if (!node) return [] as WorkGraphNode[];
    const byIndex = new Map(data.nodes.map((n) => [n.id, n]));
    const found: WorkGraphNode[] = [];
    for (const link of data.links) {
      const src = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const tgt = typeof link.target === 'string' ? link.target : (link.target as any).id;
      if (node.type === 'user' && link.type === 'ASSIGNED_TO' && tgt === node.id) {
        const n = byIndex.get(src); if (n?.type === 'task') found.push(n);
      }
      if (node.type === 'area' && link.type === 'BELONGS_TO_AREA' && tgt === node.id) {
        const n = byIndex.get(src); if (n?.type === 'task') found.push(n);
      }
      if (node.type === 'project' && link.type === 'IMPACTS_PROJECT' && tgt === node.id) {
        const n = byIndex.get(src); if (n?.type === 'task') found.push(n);
      }
      if (node.type === 'client' && link.type === 'IMPACTS' && tgt === node.id) {
        const n = byIndex.get(src); if (n?.type === 'task') found.push(n);
      }
    }
    return found;
  }, [data, node]);

  const grouped = useMemo(() => {
    const g = { active: [] as WorkGraphNode[], overdue: [] as WorkGraphNode[], blocked: [] as WorkGraphNode[], completed: [] as WorkGraphNode[] };
    for (const t of relatedTasks) {
      if (t.status === 'overdue') g.overdue.push(t);
      else if (t.status === 'blocked') g.blocked.push(t);
      else if (t.status === 'completed') g.completed.push(t);
      else g.active.push(t);
    }
    return g;
  }, [relatedTasks]);

  const collaborators = useMemo(() => {
    if (!node || node.type !== 'user') return [] as WorkGraphNode[];
    const byIndex = new Map(data.nodes.map((n) => [n.id, n]));
    const ids = new Set<string>();
    for (const l of data.links) {
      if (l.type !== 'COLLABORATES_WITH') continue;
      const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
      if (s === node.id) ids.add(t);
      else if (t === node.id) ids.add(s);
    }
    return [...ids].map((id) => byIndex.get(id)).filter((x): x is WorkGraphNode => !!x);
  }, [node, data]);

  const recommendation = useMemo(() => (node ? recommendAction(node, data) : null), [node, data]);

  if (!node) return null;
  const meta = (node.metadata ?? {}) as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white/95 backdrop-blur px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              {iconForType(node.type)}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{labelForType(node.type)}</p>
              <h2 className="text-lg font-semibold truncate">{node.label}</h2>
              {node.subtitle && <p className="text-xs text-slate-500 truncate">{node.subtitle}</p>}
            </div>
          </div>
          <Button size="icon" variant="ghost" className="shrink-0" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Executive recommendation */}
          {recommendation && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-violet-900 mb-0.5">Recomendación ejecutiva</p>
                <p className="text-sm text-violet-800">{recommendation}</p>
              </div>
            </div>
          )}

          {/* Metric tiles — one per type */}
          <MetricsGrid node={node} meta={meta} />

          {/* Task columns for users/areas/projects/clients */}
          {relatedTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Tareas relacionadas ({relatedTasks.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <TaskColumn title="Vencidas" icon={AlertTriangle} color="#f97316" tasks={grouped.overdue} onClick={onSelect} />
                <TaskColumn title="Activas" icon={Clock} color="#6366f1" tasks={grouped.active} onClick={onSelect} />
                <TaskColumn title="Bloqueadas" icon={AlertTriangle} color="#ef4444" tasks={grouped.blocked} onClick={onSelect} />
                <TaskColumn title="Completadas" icon={CheckCircle2} color="#22c55e" tasks={grouped.completed} onClick={onSelect} />
              </div>
            </div>
          )}

          {/* Collaborators (users only) */}
          {node.type === 'user' && collaborators.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Red de colaboración ({collaborators.length})</h3>
              <div className="flex flex-wrap gap-2">
                {collaborators.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className="flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-xs font-medium hover:border-violet-400 transition"
                  >
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Event timeline */}
          {events.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <History className="h-4 w-4" /> Línea de tiempo ({events.length})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {events.map((ev, idx) => (
                  <div key={ev.id ?? idx} className="flex items-start gap-3 rounded-md border bg-slate-50 p-2.5">
                    <div className="shrink-0 h-6 w-6 rounded-full bg-white border flex items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800">{eventLabel(ev.type)}</p>
                      <p className="text-[10px] text-slate-500 tabular-nums" title={safeFormat(ev.created_at, 'dd MMM yyyy HH:mm')}>
                        {safeRelative(ev.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricsGrid({ node, meta }: { node: WorkGraphNode; meta: any }) {
  if (node.type === 'user') {
    const rate = typeof meta.onTimeResponseRate === 'number' ? Math.round(meta.onTimeResponseRate * 100) : null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <Tile label="Activas" value={meta.activeTasks ?? 0} />
        <Tile label="Vencidas" value={meta.overdueTasks ?? 0} tone={meta.overdueTasks ? 'bad' : 'ok'} />
        <Tile label="Completadas" value={meta.completedTasks ?? 0} tone="ok" />
        <Tile label="Respuestas a tiempo" value={rate != null ? `${rate}%` : '—'} tone={rate != null && rate >= 80 ? 'ok' : 'warn'} />
        <Tile label="Colaboradores" value={meta.collaboratorCount ?? 0} />
      </div>
    );
  }
  if (node.type === 'area') {
    const bn = meta.bottleneckRisk;
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <Tile label="Activas" value={meta.activeTasks ?? 0} />
        <Tile label="Vencidas" value={meta.overdueTasks ?? 0} tone={meta.overdueTasks ? 'bad' : 'ok'} />
        <Tile label="Bloqueadas" value={meta.blockedTasks ?? 0} tone={meta.blockedTasks ? 'bad' : 'ok'} />
        <Tile label="Deps entrantes" value={meta.incomingBlocks ?? 0} />
        <Tile label="Riesgo cuello" value={bn === 'high' ? 'Alto' : bn === 'medium' ? 'Medio' : 'Bajo'} tone={bn === 'high' ? 'bad' : bn === 'medium' ? 'warn' : 'ok'} />
      </div>
    );
  }
  if (node.type === 'project') {
    const progress = typeof meta.progress === 'number' ? Math.round(meta.progress * 100) : null;
    const rl = meta.riskLevel ?? 0;
    return (
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
        <Tile label="Progreso" value={progress != null ? `${progress}%` : '—'} tone={progress != null && progress >= 80 ? 'ok' : 'warn'} />
        <Tile label="Activas" value={meta.activeTasks ?? 0} />
        <Tile label="Vencidas" value={meta.overdueTasks ?? 0} tone={meta.overdueTasks ? 'bad' : 'ok'} />
        <Tile label="Bloqueadas" value={meta.blockedTasks ?? 0} tone={meta.blockedTasks ? 'bad' : 'ok'} />
        <Tile label="Críticas" value={meta.criticalTasks ?? 0} tone={meta.criticalTasks ? 'warn' : 'ok'} />
        <Tile label="Riesgo" value={rl >= 4 ? 'Alto' : rl >= 3 ? 'Medio' : 'Bajo'} tone={rl >= 4 ? 'bad' : rl >= 3 ? 'warn' : 'ok'} />
      </div>
    );
  }
  if (node.type === 'client') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        <Tile label="Tareas asociadas" value={meta.taskCount ?? 0} />
        <Tile label="Activas" value={meta.activeTasks ?? 0} />
        <Tile label="Vencidas" value={meta.overdueTasks ?? 0} tone={meta.overdueTasks ? 'bad' : 'ok'} />
      </div>
    );
  }
  return null;
}

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-green-600' : 'text-slate-900';
  return (
    <div className="rounded-lg border bg-slate-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{label}</p>
      <p className={`text-lg font-semibold tabular-nums mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function TaskColumn({ title, icon: Icon, color, tasks, onClick }: { title: string; icon: any; color: string; tasks: WorkGraphNode[]; onClick: (id: string) => void }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-2">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Icon className="h-3.5 w-3.5" style={{ color }} />
          <span className="text-slate-700">{title}</span>
        </div>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{tasks.length}</Badge>
      </div>
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {tasks.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic px-1 py-2">—</p>
        ) : tasks.map((t) => (
          <button
            key={t.id}
            onClick={() => onClick(t.id)}
            className="w-full text-left rounded-md bg-white border px-2 py-1.5 hover:border-violet-300 transition"
          >
            <p className="text-xs font-medium truncate text-slate-800">{t.label}</p>
            {t.subtitle && <p className="text-[10px] text-slate-500 truncate">{t.subtitle}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Helpers (duplicated from NodeInspector — kept local on purpose) ----------

function iconForType(t: string): any {
  if (t === 'user') return <User2 className="h-5 w-5" />;
  if (t === 'area') return <Building2 className="h-5 w-5" />;
  if (t === 'project') return <Briefcase className="h-5 w-5" />;
  if (t === 'client') return <ContactIcon className="h-5 w-5" />;
  return <span className="text-sm font-bold">T</span>;
}
function labelForType(t: string): string {
  return ({ task: 'Tema', user: 'Responsable', area: 'Área', project: 'Proyecto', client: 'Cliente', workspace: 'Workspace' } as Record<string, string>)[t] ?? t;
}
const EVENT_LABELS: Record<string, string> = {
  'task.created': 'Tarea creada', 'task.assigned': 'Asignada', 'task.started': 'Iniciada',
  'task.updated': 'Actualizada', 'task.blocked': 'Bloqueada', 'task.unblocked': 'Desbloqueada',
  'task.overdue': 'Vencida', 'task.completed': 'Completada', 'task.approved': 'Aprobada',
  'task.rejected': 'Rechazada', 'task.escalated': 'Escalada', 'task.comment_added': 'Comentario agregado',
  'response.on_time': 'Respondió a tiempo', 'response.late': 'Respondió tarde',
  'dependency.added': 'Dependencia agregada', 'evidence.added': 'Evidencia agregada',
};
function eventLabel(type: string): string { return EVENT_LABELS[type] ?? type.replace(/[._]/g, ' '); }
function safeFormat(value: string | null | undefined, pattern: string): string {
  if (!value) return '';
  const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
  try { return format(d, pattern, { locale: es }); } catch { return ''; }
}
function safeRelative(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value); if (Number.isNaN(d.getTime())) return '—';
  try { return formatDistanceToNow(d, { addSuffix: true, locale: es }); } catch { return '—'; }
}
