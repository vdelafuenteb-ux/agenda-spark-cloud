import { memo, useMemo, useState } from 'react';
import {
  X, Zap, AlertTriangle, CheckCircle2, Clock, Users, Layers, Plus, Trash2, ShieldAlert,
  Briefcase, Building2, Link as LinkIcon, Lightbulb, History, TrendingUp,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/useWorkspace';
import { EDGE_LABELS, NODE_COLORS, type WorkGraphData, type WorkGraphNode } from './types';
import { useGraphStore } from './useGraphStore';
import { useWorkGraphRelationships } from './useWorkGraphRelationships';
import { useWorkGraphEvents } from './useWorkGraphEvents';
import { RelationshipEditor } from './RelationshipEditor';
import { FullNodeView } from './FullNodeView';
import { recommendAction, rootCauseInsight } from './graphInsights';
import { Maximize2 } from 'lucide-react';

function nodeId(n: any): string { return typeof n === 'string' ? n : n?.id; }

export const NodeInspector = memo(function NodeInspector({ data }: { data: WorkGraphData }) {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectNode = useGraphStore((s) => s.selectNode);
  const { activeWorkspaceId } = useWorkspace();
  const { deleteRelationship } = useWorkGraphRelationships();
  const [editorOpen, setEditorOpen] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const { events } = useWorkGraphEvents(selectedNodeId);

  const node = useMemo(
    () => (selectedNodeId ? data.nodes.find((n) => n.id === selectedNodeId) : null),
    [data.nodes, selectedNodeId],
  );

  const recommendation = useMemo(() => (node ? recommendAction(node, data) : null), [node, data]);
  const rootCause = useMemo(() => (node ? rootCauseInsight(node) : null), [node]);

  const connections = useMemo(() => {
    if (!selectedNodeId) return { incoming: [] as any[], outgoing: [] as any[] };
    const incoming: any[] = [];
    const outgoing: any[] = [];
    for (const l of data.links) {
      const s = nodeId(l.source);
      const t = nodeId(l.target);
      if (s === selectedNodeId) outgoing.push({ edge: l, other: data.nodes.find((n) => n.id === t) });
      else if (t === selectedNodeId) incoming.push({ edge: l, other: data.nodes.find((n) => n.id === s) });
    }
    return { incoming, outgoing };
  }, [data, selectedNodeId]);

  if (!node) return null;

  const meta = (node.metadata ?? {}) as any;
  const noFault = !!meta.noFaultOfAssignee;
  const projectId = meta.project_id as string | undefined;
  const clientId = meta.client_id as string | undefined;
  const projectNode = projectId ? data.nodes.find((n) => n.id === `project:${projectId}`) : null;
  const clientNode = clientId ? data.nodes.find((n) => n.id === `client:${clientId}`) : null;

  const handleDeleteEdge = async (edgeId: string) => {
    // Manual relationships are stored with id `e:manual:<relationshipId>`.
    const match = /^e:manual:(.+)$/.exec(edgeId);
    if (!match) { toast.error('Esta relación es automática y no puede eliminarse desde aquí.'); return; }
    try {
      await deleteRelationship.mutateAsync(match[1]);
      toast.success('Relación eliminada');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar');
    }
  };

  return (
    <aside className="absolute right-4 top-[168px] bottom-24 w-80 rounded-2xl border bg-white/95 backdrop-blur shadow-lg p-5 overflow-y-auto z-10 animate-in fade-in slide-in-from-right-2">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: NODE_COLORS[node.type] }}
          >
            {iconForType(node.type)}
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{labelForType(node.type)}</p>
            <h3 className="font-semibold leading-tight truncate">{node.label}</h3>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => selectNode(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {node.subtitle && <p className="text-sm text-slate-600 mb-3">{node.subtitle}</p>}

      {/* Dependency-blame banner: the headline insight for FASE 4. */}
      {noFault && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-900">Atraso con dependencia externa</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              El atraso no parece ser responsabilidad directa del asignado — depende de <strong>{meta.blameLabel}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Root cause classification for overdue tasks */}
      {rootCause && !noFault && (
        <div className="mb-3 rounded-lg border bg-slate-50 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-800">Causa probable del atraso</p>
            <p className="text-[11px] text-slate-600 mt-0.5">{rootCause.text}</p>
          </div>
        </div>
      )}

      {/* Executive recommendation */}
      {recommendation && (
        <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 p-3 flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-violet-900">Recomendación</p>
            <p className="text-[11px] text-violet-800 mt-0.5">{recommendation}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricChip icon={Zap} label="Importancia" value={formatNumber(node.importance)} />
        <MetricChip icon={AlertTriangle} label="Riesgo" value={formatNumber(node.riskLevel)} />
        {node.status && <MetricChip icon={statusIcon(node.status)} label="Estado" value={statusLabel(node.status)} />}
        {node.score != null && <MetricChip icon={CheckCircle2} label="Avance" value={`${Math.round((node.score || 0) * 100)}%`} />}
      </div>

      {node.type === 'task' && (
        <div className="mb-4 rounded-lg border bg-slate-50 p-3 space-y-1 text-xs">
          {meta.priority && <Row label="Prioridad" value={meta.priority} />}
          {meta.start_date && <Row label="Inicio" value={meta.start_date} />}
          {meta.due_date && <Row label="Vence" value={meta.due_date} />}
          {meta.execution_order != null && <Row label="Orden" value={String(meta.execution_order)} />}
          {meta.assigneeName && <Row label="Responsable" value={meta.assigneeName} />}
          {projectNode && (
            <button
              onClick={() => selectNode(projectNode.id)}
              className="flex items-center justify-between text-xs w-full text-left hover:bg-white rounded px-1 py-0.5 -mx-1"
            >
              <span className="text-slate-500 flex items-center gap-1"><Briefcase className="h-3 w-3" /> Proyecto</span>
              <span className="font-medium truncate text-violet-700">{projectNode.label}</span>
            </button>
          )}
          {clientNode && (
            <button
              onClick={() => selectNode(clientNode.id)}
              className="flex items-center justify-between text-xs w-full text-left hover:bg-white rounded px-1 py-0.5 -mx-1"
            >
              <span className="text-slate-500 flex items-center gap-1"><Building2 className="h-3 w-3" /> Cliente</span>
              <span className="font-medium truncate text-sky-700">{clientNode.label}</span>
            </button>
          )}
        </div>
      )}

      {/* Per-type aggregated metrics */}
      {node.type === 'user' && <UserMetrics meta={meta} />}
      {node.type === 'area' && <AreaMetrics meta={meta} />}
      {node.type === 'project' && <ProjectMetrics meta={meta} />}
      {node.type === 'client' && <ClientMetrics meta={meta} />}

      {/* Event history (lifecycle) */}
      {events.length > 0 && (
        <Section title="Historial de eventos" icon={History} count={events.length}>
          <div className="space-y-1">
            {events.slice(0, 8).map((ev) => (
              <div key={ev.id || ev.created_at} className="flex items-start gap-2 px-2 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0 mt-1.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium truncate text-slate-800">{eventLabel(ev.type)}</p>
                  <p className="text-[10px] text-slate-500 truncate" title={safeFormat(ev.created_at, 'dd MMM yyyy HH:mm')}>
                    {safeRelative(ev.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Full node view is only valuable for aggregate types where we have
          lists of tasks + collaborators to show. Hide for plain tasks/workspaces
          where the inspector already covers everything. */}
      {['user', 'area', 'project', 'client'].includes(node.type) && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mb-2 gap-1.5"
          onClick={() => setFullViewOpen(true)}
        >
          <Maximize2 className="h-3.5 w-3.5" /> Ver página completa
        </Button>
      )}

      {/* Add relationship */}
      <Button
        size="sm"
        variant="outline"
        className="w-full mb-4 gap-1.5 border-dashed"
        onClick={() => setEditorOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" /> Añadir relación
      </Button>

      {connections.outgoing.length > 0 && (
        <Section title="Conexiones salientes" icon={Layers} count={connections.outgoing.length}>
          {connections.outgoing.map(({ edge, other }) => (
            <ConnectionRow
              key={edge.id}
              edge={edge}
              other={other}
              onClick={selectNode}
              onDelete={handleDeleteEdge}
            />
          ))}
        </Section>
      )}

      {connections.incoming.length > 0 && (
        <Section title="Conexiones entrantes" icon={Users} count={connections.incoming.length}>
          {connections.incoming.map(({ edge, other }) => (
            <ConnectionRow
              key={edge.id}
              edge={edge}
              other={other}
              onClick={selectNode}
              onDelete={handleDeleteEdge}
            />
          ))}
        </Section>
      )}

      <RelationshipEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        sourceNode={node}
        data={data}
        workspaceId={activeWorkspaceId}
      />
      <FullNodeView
        open={fullViewOpen}
        onOpenChange={setFullViewOpen}
        node={node}
        data={data}
        onSelect={(id) => { selectNode(id); setFullViewOpen(false); }}
      />
    </aside>
  );
});

function Section({ title, icon: Icon, count, children }: { title: string; icon: any; count: number; children: any }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </div>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{count}</Badge>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ConnectionRow({ edge, other, onClick, onDelete }: { edge: any; other?: WorkGraphNode; onClick: (id: string | null) => void; onDelete: (edgeId: string) => void }) {
  if (!other) return null;
  const isManual = String(edge.id).startsWith('e:manual:');
  return (
    <div className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 transition-colors">
      <button
        onClick={() => onClick(other.id)}
        className="flex items-center gap-2 flex-1 min-w-0 text-left"
      >
        <span
          className="shrink-0 h-2 w-2 rounded-full mt-1"
          style={{ backgroundColor: NODE_COLORS[other.type] }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate text-slate-800">{other.label}</p>
          <p className="text-[10px] text-slate-500 truncate">
            {EDGE_LABELS[edge.type as keyof typeof EDGE_LABELS] || String(edge.type).replace(/_/g, ' ').toLowerCase()}
            {isManual ? ' · manual' : ''}
          </p>
          {edge.reason && (
            <p className="text-[10px] text-slate-600 italic truncate flex items-center gap-1 mt-0.5">
              <LinkIcon className="h-2.5 w-2.5 shrink-0" /> {edge.reason}
            </p>
          )}
        </div>
      </button>
      {isManual && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(edge.id); }}
          className="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition"
          title="Eliminar relación"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function MetricChip({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase tracking-wide">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-sm font-semibold mt-0.5 truncate text-slate-900">{value ?? '—'}</p>
    </div>
  );
}

function iconForType(t: string): string {
  return ({
    workspace: 'W',
    task: 'T', user: 'U', area: 'A', project: 'P', department: 'D',
    milestone: 'M', deadline: '!', email: '@', comment: '“', dependency: '→',
    risk: 'R', blocker: '✕', client: 'C', evidence: 'E', workflow: 'F',
  } as Record<string, string>)[t] ?? '·';
}

function labelForType(t: string): string {
  return ({
    workspace: 'Workspace',
    task: 'Tema', user: 'Responsable', area: 'Área', project: 'Proyecto',
    department: 'Departamento', milestone: 'Hito', deadline: 'Fecha límite',
    email: 'Correo', comment: 'Comentario', dependency: 'Dependencia',
    risk: 'Riesgo', blocker: 'Bloqueo', client: 'Cliente', evidence: 'Evidencia',
    workflow: 'Flujo',
  } as Record<string, string>)[t] ?? t;
}

function statusLabel(status: string): string {
  return ({
    pending: 'Pendiente',
    active: 'Activo',
    completed: 'Completado',
    overdue: 'Vencido',
    blocked: 'Bloqueado',
    risk: 'En riesgo',
    healthy: 'Saludable',
  } as Record<string, string>)[status] ?? status;
}

function statusIcon(status: string) {
  if (status === 'completed' || status === 'healthy') return CheckCircle2;
  if (status === 'overdue' || status === 'blocked' || status === 'risk') return AlertTriangle;
  return Clock;
}

function formatNumber(n?: number): string | undefined {
  if (n == null) return undefined;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// ---------- Per-type metric blocks ----------

function UserMetrics({ meta }: { meta: any }) {
  const rate = typeof meta.onTimeResponseRate === 'number' ? Math.round(meta.onTimeResponseRate * 100) : null;
  const workload = meta.workloadRisk as 'low' | 'medium' | 'high' | undefined;
  const workloadLabel = workload === 'high' ? 'Alta' : workload === 'medium' ? 'Media' : workload ? 'Baja' : '—';
  const workloadColor = workload === 'high' ? 'text-orange-600' : workload === 'medium' ? 'text-amber-600' : 'text-green-600';
  return (
    <div className="mb-4 rounded-lg border bg-slate-50 p-3 grid grid-cols-2 gap-2 text-xs">
      <MiniStat label="Activas" value={meta.activeTasks} icon={TrendingUp} />
      <MiniStat label="Vencidas" value={meta.overdueTasks} tone={meta.overdueTasks > 0 ? 'critical' : 'ok'} />
      <MiniStat label="Completadas" value={meta.completedTasks} tone="ok" />
      <MiniStat label="Tasa a tiempo" value={rate != null ? `${rate}%` : '—'} tone={rate != null && rate >= 80 ? 'ok' : 'warn'} />
      <div className="col-span-2 flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Carga</span>
        <span className={`text-xs font-semibold ${workloadColor}`}>{workloadLabel}</span>
      </div>
      <div className="col-span-2 flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Colaboradores</span>
        <span className="text-xs font-semibold">{meta.collaboratorCount ?? 0}</span>
      </div>
    </div>
  );
}

function AreaMetrics({ meta }: { meta: any }) {
  const bottleneck = meta.bottleneckRisk as 'low' | 'medium' | 'high' | undefined;
  const bottleneckLabel = bottleneck === 'high' ? 'Alto' : bottleneck === 'medium' ? 'Medio' : 'Bajo';
  const bottleneckColor = bottleneck === 'high' ? 'text-red-600' : bottleneck === 'medium' ? 'text-amber-600' : 'text-green-600';
  return (
    <div className="mb-4 rounded-lg border bg-slate-50 p-3 grid grid-cols-2 gap-2 text-xs">
      <MiniStat label="Activas" value={meta.activeTasks} icon={TrendingUp} />
      <MiniStat label="Vencidas" value={meta.overdueTasks} tone={meta.overdueTasks > 0 ? 'critical' : 'ok'} />
      <MiniStat label="Bloqueadas" value={meta.blockedTasks} tone={meta.blockedTasks > 0 ? 'critical' : 'ok'} />
      <MiniStat label="Deps entrantes" value={meta.incomingBlocks ?? 0} />
      <div className="col-span-2 flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Riesgo cuello de botella</span>
        <span className={`text-xs font-semibold ${bottleneckColor}`}>{bottleneckLabel}</span>
      </div>
    </div>
  );
}

function ProjectMetrics({ meta }: { meta: any }) {
  const progress = typeof meta.progress === 'number' ? Math.round(meta.progress * 100) : null;
  const riskLevel = meta.riskLevel ?? 0;
  const riskLabel = riskLevel >= 4 ? 'Alto' : riskLevel >= 3 ? 'Medio' : 'Bajo';
  const riskColor = riskLevel >= 4 ? 'text-red-600' : riskLevel >= 3 ? 'text-orange-600' : 'text-green-600';
  return (
    <div className="mb-4 rounded-lg border bg-slate-50 p-3 grid grid-cols-2 gap-2 text-xs">
      <MiniStat label="Activas" value={meta.activeTasks ?? 0} />
      <MiniStat label="Vencidas" value={meta.overdueTasks ?? 0} tone={(meta.overdueTasks ?? 0) > 0 ? 'critical' : 'ok'} />
      <MiniStat label="Bloqueadas" value={meta.blockedTasks ?? 0} tone={(meta.blockedTasks ?? 0) > 0 ? 'critical' : 'ok'} />
      <MiniStat label="Completadas" value={meta.completedTasks ?? 0} tone="ok" />
      <MiniStat label="Críticas" value={meta.criticalTasks ?? 0} tone={(meta.criticalTasks ?? 0) > 0 ? 'warn' : 'ok'} />
      <MiniStat label="Avance" value={progress != null ? `${progress}%` : '—'} tone={progress != null && progress >= 80 ? 'ok' : 'warn'} />
      <div className="col-span-2 flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Riesgo</span>
        <span className={`text-xs font-semibold ${riskColor}`}>{riskLabel}</span>
      </div>
    </div>
  );
}

function ClientMetrics({ meta }: { meta: any }) {
  return (
    <div className="mb-4 rounded-lg border bg-slate-50 p-3 grid grid-cols-2 gap-2 text-xs">
      <MiniStat label="Tareas asociadas" value={meta.taskCount ?? 0} />
      <MiniStat label="Activas" value={meta.activeTasks ?? 0} />
      <MiniStat label="Vencidas" value={meta.overdueTasks ?? 0} tone={(meta.overdueTasks ?? 0) > 0 ? 'critical' : 'ok'} />
    </div>
  );
}

function MiniStat({ label, value, tone, icon: Icon }: { label: string; value?: string | number; tone?: 'ok' | 'warn' | 'critical'; icon?: any }) {
  const toneColor = tone === 'critical' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-green-600' : 'text-slate-700';
  return (
    <div className="rounded-md border bg-white px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="h-2.5 w-2.5" />}
        {label}
      </div>
      <p className={`text-sm font-semibold mt-0.5 ${toneColor}`}>{value ?? '—'}</p>
    </div>
  );
}

// ---------- Event label + date helpers ----------

const EVENT_LABELS: Record<string, string> = {
  'task.created': 'Tarea creada',
  'task.assigned': 'Asignada',
  'task.started': 'Iniciada',
  'task.updated': 'Actualizada',
  'task.comment_added': 'Comentario agregado',
  'task.blocked': 'Bloqueada',
  'task.unblocked': 'Desbloqueada',
  'task.overdue': 'Vencida',
  'task.completed': 'Completada',
  'task.approved': 'Aprobada',
  'task.rejected': 'Rechazada',
  'task.escalated': 'Escalada',
  'task.email_sent': 'Correo enviado',
  'task.email_replied': 'Respuesta recibida',
  'response.on_time': 'Respondió a tiempo',
  'response.late': 'Respondió tarde',
  'dependency.added': 'Dependencia agregada',
  'evidence.added': 'Evidencia agregada',
  'workspace.created': 'Workspace creado',
  'assignee.created': 'Responsable creado',
};

function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type.replace(/[._]/g, ' ');
}

function safeFormat(value: string | null | undefined, pattern: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  try { return format(d, pattern, { locale: es }); } catch { return ''; }
}
function safeRelative(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  try { return formatDistanceToNow(d, { addSuffix: true, locale: es }); } catch { return '—'; }
}
