import { useMemo } from 'react';
import { Sparkles, AlertTriangle, AlertOctagon, Info, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildInsights, type Insight } from './graphInsights';
import { useGraphStore } from './useGraphStore';
import type { WorkGraphData } from './types';

interface Props {
  data: WorkGraphData;
}

const severityStyle: Record<Insight['severity'], { bg: string; icon: typeof Info; color: string }> = {
  ok: { bg: 'bg-emerald-50 border-emerald-200', icon: Info, color: 'text-emerald-600' },
  info: { bg: 'bg-slate-50 border-slate-200', icon: Info, color: 'text-slate-500' },
  warn: { bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle, color: 'text-amber-600' },
  critical: { bg: 'bg-orange-50 border-orange-200', icon: AlertOctagon, color: 'text-orange-600' },
};

// Right-side executive panel with plain-language sentences about the graph
// (overdue, blocked chains, overloaded users, etc.). Click an insight to
// select its corresponding node in the graph.
export function InsightsPanel({ data }: Props) {
  const open = useGraphStore((s) => s.insightsOpen);
  const setOpen = useGraphStore((s) => s.setInsightsOpen);
  const selectNode = useGraphStore((s) => s.selectNode);

  const insights = useMemo(() => buildInsights(data), [data]);

  if (!open) {
    return (
      <div className="absolute right-4 top-[168px] z-10">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="rounded-full bg-white/95 backdrop-blur shadow-sm gap-1.5">
          <PanelLeftOpen className="h-3.5 w-3.5" /> Análisis
        </Button>
      </div>
    );
  }

  return (
    <aside className="absolute right-4 top-[168px] bottom-24 w-80 rounded-2xl border bg-white/95 backdrop-blur shadow-lg p-4 overflow-y-auto z-10 animate-in fade-in slide-in-from-right-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <h3 className="font-semibold text-sm">Análisis operativo</h3>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)} title="Cerrar panel">
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {insights.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <Info className="h-5 w-5 mx-auto mb-2 text-slate-400" />
          <p className="text-xs text-slate-500">Sin alertas. La operación luce estable.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((ins) => {
            const sev = severityStyle[ins.severity] ?? severityStyle.info;
            const Icon = sev.icon;
            const clickable = !!ins.nodeId;
            return (
              <button
                key={ins.key}
                disabled={!clickable}
                onClick={() => ins.nodeId && selectNode(ins.nodeId)}
                className={`w-full text-left rounded-lg border ${sev.bg} p-2.5 flex items-start gap-2 transition ${clickable ? 'hover:shadow-sm cursor-pointer' : 'cursor-default'}`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${sev.color}`} />
                <p className="text-xs leading-snug text-slate-700">{ins.text}</p>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
