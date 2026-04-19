import { Search, Sparkles, Layers3, Layers, Globe2, Building2, Clock, Sun, Moon, User2, Briefcase, Contact as ContactIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useGraphStore } from './useGraphStore';
import type { WorkNodeType } from './types';

// Pre-configured "lens" each narrows nodeTypeFilter to the dimensions relevant
// for that executive view. Clicking a preset instantly reshapes the graph
// without the user having to tick checkboxes manually.
const VIEW_PRESETS: Record<string, { label: string; icon: any; nodeTypes: WorkNodeType[] }> = {
  tareas:     { label: 'Tareas',       icon: Layers,        nodeTypes: ['workspace', 'task', 'user', 'area'] },
  personas:   { label: 'Personas',     icon: User2,         nodeTypes: ['workspace', 'user', 'task', 'area'] },
  areas:      { label: 'Áreas',        icon: Building2,     nodeTypes: ['workspace', 'area', 'user', 'task'] },
  proyectos:  { label: 'Proyectos',    icon: Briefcase,     nodeTypes: ['workspace', 'project', 'task', 'client', 'area'] },
  clientes:   { label: 'Clientes',     icon: ContactIcon,   nodeTypes: ['workspace', 'client', 'project', 'task'] },
};

// Simplified top bar: title + stats, search, scope toggle (Global/Workspace),
// view mode (2D/3D), canvas mode (Light/Dark), timeline toggle + view presets.
// Node-type filters and status/user/area/project moved to LeftFilters.
export function GraphFilters({ stats }: { stats: { nodes: number; links: number } }) {
  const viewMode = useGraphStore((s) => s.viewMode);
  const setViewMode = useGraphStore((s) => s.setViewMode);
  const scope = useGraphStore((s) => s.scope);
  const setScope = useGraphStore((s) => s.setScope);
  const canvasMode = useGraphStore((s) => s.canvasMode);
  const setCanvasMode = useGraphStore((s) => s.setCanvasMode);
  const timelineActive = useGraphStore((s) => s.timelineActive);
  const setTimelineActive = useGraphStore((s) => s.setTimelineActive);
  const searchQuery = useGraphStore((s) => s.searchQuery);
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery);
  const nodeTypeFilter = useGraphStore((s) => s.nodeTypeFilter);
  const toggleNodeType = useGraphStore((s) => s.toggleNodeType);

  const applyPreset = (preset: keyof typeof VIEW_PRESETS) => {
    const target = new Set(VIEW_PRESETS[preset].nodeTypes);
    // Diff against current set and toggle the difference so the preset
    // replaces the selection cleanly.
    for (const t of nodeTypeFilter) if (!target.has(t)) toggleNodeType(t);
    for (const t of target) if (!nodeTypeFilter.has(t)) toggleNodeType(t);
  };
  const presetActive = (preset: keyof typeof VIEW_PRESETS): boolean => {
    const target = VIEW_PRESETS[preset].nodeTypes;
    if (nodeTypeFilter.size !== target.length) return false;
    return target.every((t) => nodeTypeFilter.has(t));
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-2 pointer-events-none">
    <div className="flex items-center gap-2">
      {/* Title + stats */}
      <div className="pointer-events-auto rounded-full border bg-white/95 backdrop-blur px-4 py-2 shadow-sm flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <h2 className="text-sm font-semibold text-slate-900">Cerebro Operativo</h2>
        </div>
        <span className="h-4 w-px bg-slate-200" />
        <span className="text-xs text-slate-500 tabular-nums">
          <strong className="text-slate-900">{stats.nodes}</strong> nodos · <strong className="text-slate-900">{stats.links}</strong> enlaces
        </span>
      </div>

      {/* Search */}
      <div className="pointer-events-auto relative flex-1 max-w-sm">
        <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Buscar nodos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-9 bg-white/95 backdrop-blur border-slate-200 rounded-full shadow-sm"
        />
      </div>

      {/* Scope toggle */}
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-white/95 backdrop-blur px-1.5 py-1 shadow-sm">
        <Button
          size="sm"
          variant={scope === 'global' ? 'default' : 'ghost'}
          onClick={() => setScope('global')}
          className="h-7 px-2.5 rounded-full gap-1.5"
          title="Todos los workspaces unidos"
        >
          <Globe2 className="h-3.5 w-3.5" /> Global
        </Button>
        <Button
          size="sm"
          variant={scope === 'workspace' ? 'default' : 'ghost'}
          onClick={() => setScope('workspace')}
          className="h-7 px-2.5 rounded-full gap-1.5"
          title="Solo el workspace activo"
        >
          <Building2 className="h-3.5 w-3.5" /> Actual
        </Button>
      </div>

      {/* View mode + canvas mode + timeline */}
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-white/95 backdrop-blur px-1.5 py-1 shadow-sm">
        <Button
          size="sm"
          variant={viewMode === '2d' ? 'default' : 'ghost'}
          onClick={() => setViewMode('2d')}
          className="h-7 px-2.5 rounded-full gap-1.5"
          title="Vista 2D"
        >
          <Layers className="h-3.5 w-3.5" /> 2D
        </Button>
        <Button
          size="sm"
          variant={viewMode === '3d' ? 'default' : 'ghost'}
          onClick={() => setViewMode('3d')}
          className="h-7 px-2.5 rounded-full gap-1.5"
          title="Vista 3D"
        >
          <Layers3 className="h-3.5 w-3.5" /> 3D
        </Button>
        <span className="h-4 w-px bg-slate-200 mx-1" />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setCanvasMode(canvasMode === 'light' ? 'dark' : 'light')}
          className="h-7 w-7 rounded-full"
          title={canvasMode === 'light' ? 'Cambiar a fondo oscuro' : 'Cambiar a fondo claro'}
        >
          {canvasMode === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </Button>
        <Button
          size="sm"
          variant={timelineActive ? 'default' : 'ghost'}
          onClick={() => setTimelineActive(!timelineActive)}
          className="h-7 px-2.5 rounded-full gap-1.5"
          title="Reproducir evolución histórica"
        >
          <Clock className="h-3.5 w-3.5" /> Timeline
        </Button>
      </div>
    </div>

    {/* View presets — pick a lens to reshape the graph instantly. */}
    <div className="flex items-center gap-1.5 px-1 pointer-events-auto">
      <span className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">Enfoque:</span>
      {(Object.keys(VIEW_PRESETS) as Array<keyof typeof VIEW_PRESETS>).map((key) => {
        const preset = VIEW_PRESETS[key];
        const active = presetActive(key);
        const Icon = preset.icon;
        return (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${active ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white/95 border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            <Icon className="h-3 w-3" />
            {preset.label}
          </button>
        );
      })}
    </div>
    </div>
  );
}
