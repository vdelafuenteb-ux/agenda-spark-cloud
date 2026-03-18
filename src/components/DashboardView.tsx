import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, ListChecks, Users, Target, CalendarClock } from 'lucide-react';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import { isStoredDateOverdue } from '@/lib/date';
import { startOfWeek, subWeeks, isAfter, isBefore, addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardViewProps {
  topics: TopicWithSubtasks[];
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

export function DashboardView({ topics }: DashboardViewProps) {
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
    const overdue = activeAndTracking.filter(t => isStoredDateOverdue(t.due_date));
    const dueSoon = activeAndTracking.filter(t => {
      if (!t.due_date || isStoredDateOverdue(t.due_date)) return false;
      const due = new Date(t.due_date + 'T23:59:59');
      return isBefore(due, threeDaysFromNow);
    });

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
    const assigneeMap = new Map<string, { total: number; subtasksTotal: number; subtasksDone: number }>();
    for (const t of topics) {
      if (!t.assignee) continue;
      const entry = assigneeMap.get(t.assignee) || { total: 0, subtasksTotal: 0, subtasksDone: 0 };
      entry.total++;
      entry.subtasksTotal += t.subtasks.length;
      entry.subtasksDone += t.subtasks.filter(s => s.completed).length;
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
      subtitle: `${metrics.byStatus.seguimiento.length} en seguimiento`,
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
      title: 'Atrasados',
      value: metrics.overdue.length,
      subtitle: `${metrics.dueSoon.length} por vencer pronto`,
      icon: AlertTriangle,
      color: metrics.overdue.length > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
    {
      title: 'Completados',
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

        {/* Charts Row */}
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
                <ChartContainer config={priorityChartConfig} className="h-[200px] w-full">
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
            <ChartContainer config={trendChartConfig} className="h-[200px] w-full">
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

        {/* Overdue Topics */}
        {metrics.overdue.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                <CalendarClock className="h-4 w-4" />
                Temas Atrasados ({metrics.overdue.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {metrics.overdue.slice(0, 8).map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate flex-1">{t.title}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {t.assignee && (
                        <Badge variant="outline" className="text-[10px]">{t.assignee}</Badge>
                      )}
                      <Badge variant="destructive" className="text-[10px]">
                        Vence: {t.due_date}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Due Soon */}
        {metrics.dueSoon.length > 0 && (
          <Card className="border-yellow-500/30">
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-600">
                <Clock className="h-4 w-4" />
                Por Vencer Pronto ({metrics.dueSoon.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {metrics.dueSoon.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate flex-1">{t.title}</span>
                    <Badge variant="outline" className="text-[10px] border-yellow-500/50 text-yellow-600">
                      Vence: {t.due_date}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Nombre</TableHead>
                    <TableHead className="text-xs text-center">Temas</TableHead>
                    <TableHead className="text-xs text-center">Subtareas</TableHead>
                    <TableHead className="text-xs">Avance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.assigneeRanking.map((a) => (
                    <TableRow key={a.name}>
                      <TableCell className="text-sm font-medium">{a.name}</TableCell>
                      <TableCell className="text-sm text-center">{a.total}</TableCell>
                      <TableCell className="text-sm text-center">{a.subtasksDone}/{a.subtasksTotal}</TableCell>
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
