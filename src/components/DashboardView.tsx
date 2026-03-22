import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, TrendingUp, ListChecks, Users, Target, CalendarClock, AlertTriangle, Infinity as InfinityIcon, CalendarIcon, Bell, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Assignee } from '@/hooks/useAssignees';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toStoredDate } from '@/lib/date';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import { isStoredDateOverdue } from '@/lib/date';
import { startOfWeek, subWeeks, isAfter, isBefore, addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardViewProps {
  topics: TopicWithSubtasks[];
  assignees: Assignee[];
  onUpdateTopic?: (id: string, data: any) => void;
}

const PRIORITY_COLORS = {
  alta: 'hsl(0 84% 60%)',
  media: 'hsl(38 92% 50%)',
  baja: 'hsl(142 71% 45%)',
};

const STATUS_COLORS = {
  activo: 'hsl(217 91% 60%)',
  seguimiento: 'hsl(186 78% 42%)',
  pausado: 'hsl(38 92% 50%)',
  completado: 'hsl(142 71% 45%)',
};

export function DashboardView({ topics, onUpdateTopic }: DashboardViewProps) {
  const metrics = useMemo(() => {
    const now = new Date();
    const threeDaysFromNow = addDays(now, 3);

    const byStatus = {
      activo: topics.filter(t => t.status === 'activo'),
      seguimiento: topics.filter(t => t.status === 'seguimiento'),
      pausado: topics.filter(t => t.status === 'pausado'),
      completado: topics.filter(t => t.status === 'completado'),
    };

    const allSubtasks = topics.flatMap(t => t.subtasks);
    const completedSubtasks = allSubtasks.filter(s => s.completed);
    const subtaskProgress = allSubtasks.length > 0
      ? Math.round((completedSubtasks.length / allSubtasks.length) * 100)
      : 0;

    const activeAndTracking = [...byStatus.activo, ...byStatus.seguimiento];
    const nonOngoing = activeAndTracking.filter(t => !(t as any).is_ongoing);
    const overdue = nonOngoing.filter(t => isStoredDateOverdue(t.due_date));
    const dueSoon = nonOngoing.filter(t => {
      if (!t.due_date || isStoredDateOverdue(t.due_date)) return false;
      const due = new Date(t.due_date + 'T23:59:59');
      return isBefore(due, threeDaysFromNow);
    });

    const ongoing = activeAndTracking.filter(t => (t as any).is_ongoing);
    const missingDates = nonOngoing.filter(t => !t.due_date);

    // Status chart data
    const statusData = [
      { name: 'Activos', value: byStatus.activo.length, fill: STATUS_COLORS.activo },
      { name: 'Seguimiento', value: byStatus.seguimiento.length, fill: STATUS_COLORS.seguimiento },
      { name: 'Pausados', value: byStatus.pausado.length, fill: STATUS_COLORS.pausado },
      { name: 'Completados', value: byStatus.completado.length, fill: STATUS_COLORS.completado },
    ];

    // Priority chart data
    const priorityData = [
      { name: 'Alta', value: topics.filter(t => t.priority === 'alta').length, fill: PRIORITY_COLORS.alta },
      { name: 'Media', value: topics.filter(t => t.priority === 'media').length, fill: PRIORITY_COLORS.media },
      { name: 'Baja', value: topics.filter(t => t.priority === 'baja').length, fill: PRIORITY_COLORS.baja },
    ].filter(d => d.value > 0);

    // Weekly trend (last 8 weeks)
    const weeklyTrend: { week: string; completados: number; creados: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 7);
      const label = format(weekStart, 'd MMM', { locale: es });

      const completedInWeek = byStatus.completado.filter(t => {
        const updated = new Date(t.updated_at);
        return isAfter(updated, weekStart) && isBefore(updated, weekEnd);
      }).length;

      const createdInWeek = topics.filter(t => {
        const created = new Date(t.created_at);
        return isAfter(created, weekStart) && isBefore(created, weekEnd);
      }).length;

      weeklyTrend.push({ week: label, completados: completedInWeek, creados: createdInWeek });
    }

    // Assignee ranking
    const assigneeMap = new Map<string, { total: number; subtasksTotal: number; subtasksDone: number; overdueCount: number; dueSoonCount: number; closedCount: number }>();
    for (const t of topics) {
      if (!t.assignee) continue;
      const entry = assigneeMap.get(t.assignee) || { total: 0, subtasksTotal: 0, subtasksDone: 0, overdueCount: 0, dueSoonCount: 0, closedCount: 0 };
      entry.total++;
      entry.subtasksTotal += t.subtasks.length;
      entry.subtasksDone += t.subtasks.filter(s => s.completed).length;
      if (t.status === 'completado') {
        entry.closedCount++;
      } else if (t.status === 'activo' || t.status === 'seguimiento') {
        if (isStoredDateOverdue(t.due_date)) entry.overdueCount++;
        else if (t.due_date && !isStoredDateOverdue(t.due_date)) {
          const due = new Date(t.due_date + 'T23:59:59');
          if (isBefore(due, threeDaysFromNow)) entry.dueSoonCount++;
        }
      }
      assigneeMap.set(t.assignee, entry);
    }
    const assigneeRanking = [...assigneeMap.entries()]
      .map(([name, data]) => ({
        name,
        ...data,
        progress: data.subtasksTotal > 0 ? Math.round((data.subtasksDone / data.subtasksTotal) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      byStatus,
      allSubtasks,
      completedSubtasks,
      subtaskProgress,
      overdue,
      dueSoon,
      ongoing,
      missingDates,
      statusData,
      priorityData,
      weeklyTrend,
      assigneeRanking,
    };
  }, [topics]);

  const kpis = [
    {
      title: 'Temas Activos',
      value: metrics.byStatus.activo.length,
      subtitle: `de ${topics.length} totales`,
      icon: Target,
      color: 'text-blue-500',
    },
    {
      title: 'Subtareas',
      value: `${metrics.completedSubtasks.length}/${metrics.allSubtasks.length}`,
      subtitle: `${metrics.subtaskProgress}% completadas`,
      icon: ListChecks,
      color: 'text-emerald-500',
    },
    {
      title: 'Seguimiento',
      value: metrics.byStatus.seguimiento.length,
      subtitle: `${metrics.byStatus.pausado.length} pausados`,
      icon: Clock,
      color: 'text-cyan-500',
    },
    {
      title: 'Cerrados',
      value: metrics.byStatus.completado.length,
      subtitle: `${metrics.byStatus.pausado.length} pausados`,
      icon: CheckCircle2,
      color: 'text-emerald-500',
    },
  ];

  const statusChartConfig = {
    value: { label: 'Temas' },
    Activos: { label: 'Activos', color: STATUS_COLORS.activo },
    Seguimiento: { label: 'Seguimiento', color: STATUS_COLORS.seguimiento },
    Pausados: { label: 'Pausados', color: STATUS_COLORS.pausado },
    Completados: { label: 'Completados', color: STATUS_COLORS.completado },
  };

  const trendChartConfig = {
    completados: { label: 'Completados', color: 'hsl(142 71% 45%)' },
    creados: { label: 'Creados', color: 'hsl(217 91% 60%)' },
  };

  const priorityChartConfig = {
    value: { label: 'Temas' },
    Alta: { label: 'Alta', color: PRIORITY_COLORS.alta },
    Media: { label: 'Media', color: PRIORITY_COLORS.media },
    Baja: { label: 'Baja', color: PRIORITY_COLORS.baja },
  };

  return (
    <div className="flex-1 overflow-auto p-3 md:p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <Card key={kpi.title}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{kpi.title}</span>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
                <p className="text-[11px] text-muted-foreground mt-1">{kpi.subtitle}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Overdue + Due Soon - always visible side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Overdue */}
          <Card className="border-destructive/30">
            <CardHeader className="pb-1 p-3">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Atrasados ({metrics.overdue.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {metrics.overdue.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">Sin temas atrasados ✓</p>
              ) : (
                <div className="space-y-1.5">
                  {metrics.overdue.slice(0, 6).map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate flex-1">{t.title}</span>
                      <Badge variant="destructive" className="text-[9px] ml-2 shrink-0">
                        {t.due_date}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Due Soon */}
          <Card className="border-yellow-500/30">
            <CardHeader className="pb-1 p-3">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-yellow-600">
                <CalendarClock className="h-3.5 w-3.5" />
                Por Vencer Pronto ({metrics.dueSoon.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {metrics.dueSoon.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">Sin temas próximos a vencer ✓</p>
              ) : (
                <div className="space-y-1.5">
                  {metrics.dueSoon.slice(0, 6).map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate flex-1">{t.title}</span>
                      <Badge variant="outline" className="text-[9px] ml-2 shrink-0 border-yellow-500/50 text-yellow-600">
                        {t.due_date}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Missing dates alert + Ongoing topics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Missing dates */}
          <Card className="border-orange-500/30">
            <CardHeader className="pb-1 p-3">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-orange-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Sin Fecha Asignada ({metrics.missingDates.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {metrics.missingDates.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">Todos los temas tienen fecha ✓</p>
              ) : (
                <div className="space-y-1.5">
                  {metrics.missingDates.slice(0, 6).map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate flex-1">{t.title}</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="inline-flex items-center gap-1 rounded-full border border-orange-500/50 text-orange-600 px-2 py-0.5 text-[9px] font-medium hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors shrink-0 ml-2">
                            <CalendarIcon className="h-2.5 w-2.5" />
                            Agregar fecha
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            onSelect={(date) => {
                              if (date && onUpdateTopic) {
                                onUpdateTopic(t.id, { due_date: toStoredDate(date) });
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  ))}
                  {metrics.missingDates.length > 6 && (
                    <p className="text-[10px] text-muted-foreground">+{metrics.missingDates.length - 6} más</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ongoing topics */}
          <Card className="border-primary/30">
            <CardHeader className="pb-1 p-3">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-primary">
                <InfinityIcon className="h-3.5 w-3.5" />
                Temas Continuos ({metrics.ongoing.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {metrics.ongoing.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">Sin temas continuos</p>
              ) : (
                <div className="space-y-1.5">
                  {metrics.ongoing.slice(0, 6).map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate flex-1">{t.title}</span>
                      <Badge variant="outline" className="text-[9px] ml-2 shrink-0">
                        {t.subtasks.filter(s => s.completed).length}/{t.subtasks.length} subtareas
                      </Badge>
                    </div>
                  ))}
                  {metrics.ongoing.length > 6 && (
                    <p className="text-[10px] text-muted-foreground">+{metrics.ongoing.length - 6} más</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Status Bar Chart */}
          <Card>
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-sm font-medium">Temas por Estado</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
               <ChartContainer config={statusChartConfig} className="aspect-auto h-[200px] w-full">
                <BarChart data={metrics.statusData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {metrics.statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Priority Pie Chart */}
          <Card>
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-sm font-medium">Distribución por Prioridad</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {metrics.priorityData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">Sin datos</p>
              ) : (
                <ChartContainer config={priorityChartConfig} className="aspect-auto h-[200px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={metrics.priorityData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                      isAnimationActive={false}
                    >
                      {metrics.priorityData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
              <div className="flex justify-center gap-4 mt-1">
                {metrics.priorityData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Trend */}
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Tendencia Semanal (últimas 8 semanas)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ChartContainer config={trendChartConfig} className="aspect-auto h-[200px] w-full">
              <AreaChart data={metrics.weeklyTrend} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="creados" stackId="1" stroke="hsl(217 91% 60%)" fill="hsl(217 91% 60% / 0.2)" strokeWidth={2} />
                <Area type="monotone" dataKey="completados" stackId="2" stroke="hsl(142 71% 45%)" fill="hsl(142 71% 45% / 0.2)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Assignee Ranking */}
        {metrics.assigneeRanking.length > 0 && (
          <Card>
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Responsables
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nombre</TableHead>
                      <TableHead className="text-xs text-center">Temas</TableHead>
                      <TableHead className="text-xs text-center">Subtareas</TableHead>
                      <TableHead className="text-xs text-center">Cerrados</TableHead>
                      <TableHead className="text-xs text-center">Atrasados</TableHead>
                      <TableHead className="text-xs text-center">Por vencer</TableHead>
                      <TableHead className="text-xs">Avance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.assigneeRanking.map((a) => (
                      <TableRow key={a.name}>
                        <TableCell className="text-sm font-medium">{a.name}</TableCell>
                        <TableCell className="text-sm text-center">{a.total}</TableCell>
                        <TableCell className="text-sm text-center">{a.subtasksDone}/{a.subtasksTotal}</TableCell>
                        <TableCell className="text-sm text-center">
                          <Badge variant="outline" className="text-[10px]">{a.closedCount}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-center">
                          {a.overdueCount > 0 ? (
                            <Badge variant="destructive" className="text-[10px]">{a.overdueCount}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-center">
                          {a.dueSoonCount > 0 ? (
                            <Badge variant="outline" className="text-[10px] border-yellow-500/50 text-yellow-600">{a.dueSoonCount}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={a.progress} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-8">{a.progress}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {metrics.assigneeRanking.map((a) => (
                  <div key={a.name} className="rounded-md border border-border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{a.total} temas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={a.progress} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground">{a.subtasksDone}/{a.subtasksTotal} ({a.progress}%)</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[9px]">{a.closedCount} cerrados</Badge>
                      {a.overdueCount > 0 && <Badge variant="destructive" className="text-[9px]">{a.overdueCount} atrasados</Badge>}
                      {a.dueSoonCount > 0 && <Badge variant="outline" className="text-[9px] border-yellow-500/50 text-yellow-600">{a.dueSoonCount} por vencer</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
