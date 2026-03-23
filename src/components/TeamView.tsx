import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AssigneeProfileView } from '@/components/AssigneeProfileView';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Assignee } from '@/hooks/useAssignees';

interface TeamViewProps {
  topics: TopicWithSubtasks[];
  assignees: Assignee[];
  onUpdateTopic?: (id: string, data: any) => void;
}

function getWeeklyHours(topic: any): number {
  const hhType = topic.hh_type as string | null;
  const hhValue = topic.hh_value as number | null;
  if (!hhType || !hhValue || hhValue <= 0) return 0;

  if (hhType === 'diaria') return hhValue * 5;
  if (hhType === 'semanal') return hhValue;
  if (hhType === 'total') {
    if (!topic.due_date) return 0;
    const now = new Date();
    const due = new Date(topic.due_date + 'T23:59:59');
    const diffMs = due.getTime() - now.getTime();
    const weeksLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7)));
    return hhValue / weeksLeft;
  }
  return 0;
}

function getLoadColor(pct: number): string {
  if (pct < 70) return 'text-emerald-600 dark:text-emerald-400';
  if (pct < 90) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-destructive';
}

function getBarColor(pct: number): string {
  if (pct < 70) return '[&>div]:bg-emerald-500';
  if (pct < 90) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-destructive';
}

export function TeamView({ topics, assignees, onUpdateTopic }: TeamViewProps) {
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);

  const activeTopics = useMemo(() =>
    topics.filter(t => t.status === 'activo' || t.status === 'seguimiento'),
    [topics]
  );

  const assigneeMetrics = useMemo(() => {
    return assignees.map(a => {
      const myTopics = activeTopics.filter(t => t.assignee === a.name);
      const weeklyHours = myTopics.reduce((sum, t) => sum + getWeeklyHours(t), 0);
      const capacity = a.weekly_capacity || 45;
      const loadPct = capacity > 0 ? Math.round((weeklyHours / capacity) * 100) : 0;
      const activeCount = myTopics.filter(t => t.status === 'activo').length;
      const seguimientoCount = myTopics.filter(t => t.status === 'seguimiento').length;
      const totalSubtasks = myTopics.reduce((acc, t) => acc + t.subtasks.length, 0);
      const completedSubtasks = myTopics.reduce((acc, t) => acc + t.subtasks.filter(s => s.completed).length, 0);

      return {
        assignee: a,
        weeklyHours: Math.round(weeklyHours * 10) / 10,
        capacity,
        loadPct,
        activeCount,
        seguimientoCount,
        totalTopics: myTopics.length,
        totalSubtasks,
        completedSubtasks,
      };
    }).sort((a, b) => b.loadPct - a.loadPct);
  }, [assignees, activeTopics]);

  const overloadedCount = assigneeMetrics.filter(m => m.loadPct >= 90).length;
  const totalWeeklyHours = assigneeMetrics.reduce((s, m) => s + m.weeklyHours, 0);
  const totalCapacity = assigneeMetrics.reduce((s, m) => s + m.capacity, 0);
  const globalLoadPct = totalCapacity > 0 ? Math.round((totalWeeklyHours / totalCapacity) * 100) : 0;

  if (selectedAssignee) {
    const assignee = assignees.find(a => a.name === selectedAssignee);
    return (
      <AssigneeProfileView
        assigneeName={selectedAssignee}
        assignee={assignee}
        topics={topics.filter(t => t.assignee === selectedAssignee)}
        onBack={() => setSelectedAssignee(null)}
      />
    );
  }

  return (
    <main className="flex-1 overflow-auto p-3 md:p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Equipo</span>
              </div>
              <p className="text-2xl font-bold">{assignees.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">HH Semanal</span>
              </div>
              <p className="text-2xl font-bold">{Math.round(totalWeeklyHours)}h</p>
              <p className="text-[10px] text-muted-foreground">de {totalCapacity}h capacidad</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">Carga Global</span>
              </div>
              <p className={cn('text-2xl font-bold', getLoadColor(globalLoadPct))}>{globalLoadPct}%</p>
              <Progress value={Math.min(globalLoadPct, 100)} className={cn('h-1.5 mt-1', getBarColor(globalLoadPct))} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Sobrecargados</span>
              </div>
              <p className={cn('text-2xl font-bold', overloadedCount > 0 ? 'text-destructive' : 'text-emerald-600')}>{overloadedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Assignee cards */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Carga por Responsable</h2>
          {assigneeMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay responsables creados. Agrega responsables en Configuración.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {assigneeMetrics.map(m => (
                <Card
                  key={m.assignee.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedAssignee(m.assignee.name)}
                >
                  <CardContent className="pt-4 pb-3 px-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{m.assignee.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {m.activeCount} activos · {m.seguimientoCount} seguimiento
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-lg font-bold', getLoadColor(m.loadPct))}>{m.loadPct}%</p>
                        <p className="text-[10px] text-muted-foreground">{m.weeklyHours}h / {m.capacity}h</p>
                      </div>
                    </div>
                    <Progress value={Math.min(m.loadPct, 100)} className={cn('h-2', getBarColor(m.loadPct))} />
                    <div className="flex items-center gap-2">
                      {m.loadPct >= 90 && (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Sobrecargado</Badge>
                      )}
                      {m.loadPct >= 70 && m.loadPct < 90 && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-yellow-500/50 text-yellow-600">Carga alta</Badge>
                      )}
                      {m.totalSubtasks > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          Subtareas: {m.completedSubtasks}/{m.totalSubtasks}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Topics without assignee that have HH */}
        {(() => {
          const unassigned = activeTopics.filter(t => !t.assignee && (t as any).hh_value);
          if (unassigned.length === 0) return null;
          return (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Temas con HH sin asignar</h2>
              <div className="space-y-1">
                {unassigned.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-muted/50 text-sm">
                    <span className="truncate">{t.title}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {(t as any).hh_value}h {(t as any).hh_type === 'diaria' ? '/día' : (t as any).hh_type === 'semanal' ? '/sem' : 'total'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </main>
  );
}
