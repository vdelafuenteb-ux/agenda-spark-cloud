import { useMemo } from 'react';
import { Activity, AlertTriangle, Ban, Users, Network, Gauge, ListChecks, CheckCircle2 } from 'lucide-react';
import { computeKPIs, computeWorkspaceScore } from './graphInsights';
import type { WorkGraphData } from './types';

interface Props {
  data: WorkGraphData;
}

// Executive KPI strip: 8 compact cards rendered on white.
// Colors follow FASE 9 palette (verde cumplimiento, amarillo riesgo, naranjo atraso, rojo crítico).
export function KPIStrip({ data }: Props) {
  const kpis = useMemo(() => computeKPIs(data), [data]);
  const wsScore = useMemo(() => computeWorkspaceScore(data), [data]);

  const scoreColor = kpis.avgScore == null ? '#cbd5e1' : kpis.avgScore >= 0.85 ? '#22c55e' : kpis.avgScore >= 0.6 ? '#eab308' : '#f97316';

  const cards = [
    { key: 'active', label: 'Activas', value: kpis.activeTasks, icon: Activity, accent: '#6366f1' },
    {
      key: 'overdue',
      label: 'Vencidas',
      value: kpis.overdueTasks,
      hint: kpis.overdueWithBlame > 0 ? `${kpis.overdueWithBlame} con bloqueo externo` : undefined,
      icon: AlertTriangle,
      accent: kpis.overdueTasks === 0 ? '#22c55e' : '#f97316',
    },
    { key: 'blocked', label: 'Bloqueadas', value: kpis.blockedTasks, icon: Ban, accent: kpis.blockedTasks > 0 ? '#ef4444' : '#cbd5e1' },
    { key: 'overload', label: 'Sobrecargados', value: kpis.overloadedUsers, icon: Users, accent: kpis.overloadedUsers > 0 ? '#eab308' : '#cbd5e1' },
    { key: 'areas', label: 'Áreas conectadas', value: kpis.connectedAreas, icon: Network, accent: '#8b5cf6' },
    {
      key: 'avg',
      label: 'Avance promedio',
      value: kpis.avgScore == null ? '—' : `${Math.round(kpis.avgScore * 100)}%`,
      icon: Gauge,
      accent: scoreColor,
    },
    { key: 'critdep', label: 'Deps. críticas', value: kpis.criticalDependencies, icon: ListChecks, accent: kpis.criticalDependencies > 0 ? '#f97316' : '#cbd5e1' },
    {
      key: 'ws',
      label: 'Score operativo',
      value: wsScore.score == null ? '—' : `${wsScore.score}`,
      hint: wsScore.narrative,
      icon: CheckCircle2,
      accent: wsScore.score == null ? '#cbd5e1' : wsScore.score >= 85 ? '#22c55e' : wsScore.score >= 65 ? '#eab308' : '#f97316',
    },
  ];

  return (
    <div className="pointer-events-auto flex items-stretch gap-2 px-4 pt-3 overflow-x-auto">
      {cards.map((c) => (
        <div
          key={c.key}
          className="min-w-[130px] flex-1 rounded-xl border bg-white/95 backdrop-blur px-3 py-2.5 shadow-sm flex items-center gap-2.5"
          title={c.hint}
        >
          <div
            className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center text-white"
            style={{ backgroundColor: c.accent }}
          >
            <c.icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium truncate">{c.label}</p>
            <p className="text-lg font-semibold text-slate-900 tabular-nums leading-tight">{c.value}</p>
            {c.hint && c.key !== 'ws' && (
              <p className="text-[9px] text-slate-500 truncate">{c.hint}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
