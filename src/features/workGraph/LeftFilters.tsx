import { useMemo } from 'react';
import { Filter, RotateCcw, PanelLeftClose, PanelLeftOpen, User2, Building2, Briefcase, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useGraphStore } from './useGraphStore';
import { NODE_COLORS, type WorkGraphData, type WorkNodeType, type WorkStatus } from './types';

const NODE_TYPE_LABELS: Record<WorkNodeType, string> = {
  workspace: 'Workspaces',
  task: 'Temas',
  user: 'Responsables',
  area: 'Áreas',
  project: 'Proyectos',
  department: 'Departamentos',
  milestone: 'Hitos',
  deadline: 'Plazos',
  email: 'Correos',
  comment: 'Comentarios',
  dependency: 'Dependencias',
  risk: 'Riesgos',
  blocker: 'Bloqueos',
  client: 'Clientes',
  evidence: 'Evidencias',
  workflow: 'Flujos',
};

const STATUS_OPTS: Array<{ value: WorkStatus; label: string; color: string }> = [
  { value: 'active', label: 'Activas', color: '#6366f1' },
  { value: 'overdue', label: 'Vencidas', color: '#f97316' },
  { value: 'blocked', label: 'Bloqueadas', color: '#ef4444' },
  { value: 'completed', label: 'Completadas', color: '#22c55e' },
  { value: 'risk', label: 'En riesgo', color: '#eab308' },
];

interface Props {
  data: WorkGraphData;
}

// Persistent left panel with filters (user, area, project, status, depth).
// Replaces the old popover-on-topbar so filters are always visible.
export function LeftFilters({ data }: Props) {
  const open = useGraphStore((s) => s.leftPanelOpen);
  const setOpen = useGraphStore((s) => s.setLeftPanelOpen);
  const nodeTypeFilter = useGraphStore((s) => s.nodeTypeFilter);
  const toggleNodeType = useGraphStore((s) => s.toggleNodeType);
  const statusFilter = useGraphStore((s) => s.statusFilter);
  const toggleStatus = useGraphStore((s) => s.toggleStatus);
  const depth = useGraphStore((s) => s.depth);
  const setDepth = useGraphStore((s) => s.setDepth);
  const userFilter = useGraphStore((s) => s.userFilter);
  const setUserFilter = useGraphStore((s) => s.setUserFilter);
  const areaFilter = useGraphStore((s) => s.areaFilter);
  const setAreaFilter = useGraphStore((s) => s.setAreaFilter);
  const projectFilter = useGraphStore((s) => s.projectFilter);
  const setProjectFilter = useGraphStore((s) => s.setProjectFilter);
  const resetFilters = useGraphStore((s) => s.resetFilters);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);

  const users = useMemo(() => data.nodes.filter((n) => n.type === 'user'), [data]);
  const areas = useMemo(() => data.nodes.filter((n) => n.type === 'area'), [data]);
  const projects = useMemo(() => data.nodes.filter((n) => n.type === 'project'), [data]);

  if (!open) {
    return (
      <div className="absolute left-4 top-[168px] z-10">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="rounded-full bg-white/95 backdrop-blur shadow-sm gap-1.5">
          <PanelLeftOpen className="h-3.5 w-3.5" /> Filtros
        </Button>
      </div>
    );
  }

  return (
    <aside className="absolute left-4 top-[168px] bottom-24 w-72 rounded-2xl border bg-white/95 backdrop-blur shadow-lg p-4 overflow-y-auto z-10 animate-in fade-in slide-in-from-left-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-violet-600" />
          <h3 className="font-semibold text-sm">Filtros</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetFilters} title="Restablecer">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} title="Cerrar panel">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Section icon={User2} title="Responsable">
        <Select value={userFilter ?? 'all'} onValueChange={(v) => setUserFilter(v === 'all' ? null : v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Section>

      <Section icon={Building2} title="Área">
        <Select value={areaFilter ?? 'all'} onValueChange={(v) => setAreaFilter(v === 'all' ? null : v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Section>

      <Section icon={Briefcase} title="Proyecto">
        <Select value={projectFilter ?? 'all'} onValueChange={(v) => setProjectFilter(v === 'all' ? null : v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Section>

      <Section icon={Flag} title="Estado">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTS.map((opt) => {
            const active = statusFilter.has(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleStatus(opt.value)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${active ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                style={active ? { backgroundColor: opt.color, borderColor: opt.color } : undefined}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Section>

      {selectedNodeId && (
        <Section icon={Filter} title="Profundidad (vista local)">
          <div className="flex items-center gap-3">
            <Slider value={[depth]} min={1} max={5} step={1} onValueChange={([v]) => setDepth(v)} className="flex-1" />
            <span className="text-xs font-mono w-5 text-right text-slate-600">{depth}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">Nodos a esta distancia del seleccionado.</p>
        </Section>
      )}

      <Section icon={Filter} title="Tipos de nodo" compact>
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(NODE_TYPE_LABELS) as WorkNodeType[]).map((t) => {
            const active = nodeTypeFilter.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleNodeType(t)}
                className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] transition ${active ? 'bg-slate-50' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: NODE_COLORS[t] }} />
                <span className="truncate">{NODE_TYPE_LABELS[t]}</span>
              </button>
            );
          })}
        </div>
      </Section>
    </aside>
  );
}

function Section({ icon: Icon, title, children, compact }: { icon: any; title: string; children: any; compact?: boolean }) {
  return (
    <div className={compact ? 'mb-3' : 'mb-4'}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3 w-3 text-slate-400" />
        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{title}</p>
      </div>
      {children}
    </div>
  );
}
