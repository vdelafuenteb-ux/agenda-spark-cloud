import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import { TrendingUp, Users, Target, CalendarClock, AlertTriangle, Bell, Loader2, ListChecks, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Assignee } from '@/hooks/useAssignees';



import type { TopicWithSubtasks } from '@/hooks/useTopics';
import { isStoredDateOverdue } from '@/lib/date';
import { startOfWeek, subWeeks, isAfter, isBefore, addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AssigneeProfileView } from './AssigneeProfileView';

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

export function DashboardView({ topics, assignees, onUpdateTopic }: DashboardViewProps) {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);

  const handleSendReminder = async (topic: TopicWithSubtasks) => {
    if (!topic.assignee) {
      toast.error('Este tema no tiene responsable asignado');
      return;
    }
    const assignee = assignees.find(a => a.name === topic.assignee);
    if (!assignee?.email) {
      toast.error(`${topic.assignee} no tiene correo configurado`);
      return;
    }

    setSendingId(topic.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No autenticado');

      

      const { error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          to_email: assignee.email,
          to_name: assignee.name,
          topic_title: topic.title,
          subtasks: topic.subtasks.map(s => ({ title: s.title, completed: s.completed, due_date: s.due_date })),
          start_date: topic.start_date,
          due_date: topic.due_date,
          progress_entries: topic.progress_entries || [],
        },
      });

      if (error) throw error;
      toast.success(`Recordatorio enviado a ${assignee.name}`);
    } catch (err: any) {
      toast.error(`Error al enviar: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };
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

    // Closure compliance analysis
    const closedWithDates = byStatus.completado.filter(t => t.due_date && (t as any).closed_at);
    let onTime = 0;
    let late = 0;
    let totalDelayDays = 0;
    let totalEarlyDays = 0;
    
    for (const t of closedWithDates) {
      const closedDate = new Date((t as any).closed_at);
      const dueDate = new Date(t.due_date! + 'T23:59:59');
      const diffDays = Math.round((closedDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) {
        onTime++;
        totalEarlyDays += Math.abs(diffDays);
      } else {
        late++;
        totalDelayDays += diffDays;
      }
    }
    
    const closureCompliance = closedWithDates.length > 0 ? Math.round((onTime / closedWithDates.length) * 100) : null;
    const avgDelayDays = late > 0 ? Math.round(totalDelayDays / late) : 0;
    const avgEarlyDays = onTime > 0 ? Math.round(totalEarlyDays / onTime) : 0;

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
        const closed = (t as any).closed_at ? new Date((t as any).closed_at) : new Date(t.updated_at);
        return isAfter(closed, weekStart) && isBefore(closed, weekEnd);
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
      closureCompliance,
      onTime,
      late,
      closedWithDates: closedWithDates.length,
      avgDelayDays,
      avgEarlyDays,
    };
  }, [topics]);

  const totalOpen = metrics.byStatus.activo.length + metrics.byStatus.seguimiento.length + metrics.byStatus.pausado.length;
  const totalActivos = metrics.byStatus.activo.length + metrics.byStatus.seguimiento.length;
  const totalPausados = metrics.byStatus.pausado.length;

  // On-track: active/seguimiento, not ongoing, has due_date, not overdue
  const activeAndTracking = [...metrics.byStatus.activo, ...metrics.byStatus.seguimiento];
  const nonOngoingActive = activeAndTracking.filter(t => !t.is_ongoing);
  const onTrackCount = nonOngoingActive.filter(t => t.due_date && !isStoredDateOverdue(t.due_date)).length;
  const overdueCount = metrics.overdue.length;


  const trendChartConfig = {
    completados: { label: 'Completados', color: 'hsl(142 71% 45%)' },
    creados: { label: 'Creados', color: 'hsl(217 91% 60%)' },
  };



  // Show assignee profile if selected
  if (selectedAssignee) {
    const assigneeObj = assignees.find(a => a.name === selectedAssignee);
    return (
      <AssigneeProfileView
        assigneeName={selectedAssignee}
        assignee={assigneeObj}
        topics={topics}
        onBack={() => setSelectedAssignee(null)}
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto p-3 md:p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Temas Totales */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Temas Totales</span>
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">{totalOpen}</div>
              <p className="text-[11px] text-muted-foreground mt-1">{totalActivos} activos · {totalPausados} en pausa</p>
            </CardContent>
          </Card>

          {/* 2. Semáforo */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Estado de Plazos</span>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-lg font-bold text-foreground">{onTrackCount}</span>
                  <span className="text-[10px] text-muted-foreground">al día</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <span className="text-lg font-bold text-foreground">{overdueCount}</span>
                  <span className="text-[10px] text-muted-foreground">atrasados</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Subtareas */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Subtareas</span>
                <ListChecks className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">{metrics.completedSubtasks.length}/{metrics.allSubtasks.length}</div>
              <p className="text-[11px] text-muted-foreground mt-1">{metrics.subtaskProgress}% completadas</p>
            </CardContent>
          </Card>

          {/* 4. Cerrados */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Cerrados</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">{metrics.byStatus.completado.length}</div>
              <p className="text-[11px] text-muted-foreground mt-1">temas completados</p>
            </CardContent>
          </Card>
        </div>

        {/* Closure Compliance KPI */}
        {metrics.closedWithDates > 0 && (
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Cumplimiento de Cierre</span>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {metrics.closedWithDates} temas analizados
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Compliance percentage */}
                <div className="space-y-1.5">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold ${metrics.closureCompliance !== null && metrics.closureCompliance >= 70 ? 'text-emerald-600' : metrics.closureCompliance !== null && metrics.closureCompliance >= 40 ? 'text-yellow-600' : 'text-destructive'}`}>
                      {metrics.closureCompliance ?? 0}%
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Tasa de cumplimiento</p>
                  <Progress value={metrics.closureCompliance ?? 0} className="h-2" />
                </div>
                {/* On time */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-muted-foreground">A tiempo / Anticipado</span>
                  </div>
                  <span className="text-2xl font-bold text-foreground">{metrics.onTime}</span>
                  {metrics.avgEarlyDays > 0 && (
                    <p className="text-[10px] text-emerald-600">Promedio {metrics.avgEarlyDays}d antes</p>
                  )}
                </div>
                {/* Late */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
                    <span className="text-xs text-muted-foreground">Con atraso</span>
                  </div>
                  <span className="text-2xl font-bold text-foreground">{metrics.late}</span>
                  {metrics.avgDelayDays > 0 && (
                    <p className="text-[10px] text-destructive">Promedio {metrics.avgDelayDays}d de atraso</p>
                  )}
                </div>
                {/* Visual bar */}
                <div className="flex flex-col justify-center space-y-1.5">
                  <div className="flex h-4 rounded-full overflow-hidden bg-secondary">
                    <div className="bg-emerald-500 transition-all" style={{ width: `${metrics.closureCompliance ?? 0}%` }} />
                    <div className="bg-destructive transition-all" style={{ width: `${100 - (metrics.closureCompliance ?? 0)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{metrics.onTime} a tiempo</span>
                    <span>{metrics.late} atrasados</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                    <div key={t.id} className="flex items-center text-xs gap-2">
                      <span className="text-foreground truncate flex-1 min-w-0">{t.title}</span>
                      {t.assignee && (
                        <span className="text-[10px] text-muted-foreground shrink-0 max-w-[80px] truncate">{t.assignee}</span>
                      )}
                      <Badge variant="destructive" className="text-[9px] shrink-0">
                        {t.due_date}
                      </Badge>
                      <button
                        onClick={() => handleSendReminder(t)}
                        disabled={sendingId === t.id}
                        className="shrink-0 p-1 rounded-full hover:bg-destructive/10 text-destructive transition-colors disabled:opacity-50"
                        title={`Enviar recordatorio a ${t.assignee || 'responsable'}`}
                      >
                        {sendingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                      </button>
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
                    <div key={t.id} className="flex items-center justify-between text-xs gap-1">
                      <span className="text-foreground truncate flex-1">{t.title}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0 border-yellow-500/50 text-yellow-600">
                        {t.due_date}
                      </Badge>
                      <button
                        onClick={() => handleSendReminder(t)}
                        disabled={sendingId === t.id}
                        className="shrink-0 p-1 rounded-full hover:bg-yellow-500/10 text-yellow-600 transition-colors disabled:opacity-50"
                        title={`Enviar recordatorio a ${t.assignee || 'responsable'}`}
                      >
                        {sendingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                      <TableRow key={a.name} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedAssignee(a.name)}>
                        <TableCell className="text-sm font-medium text-primary underline underline-offset-2">{a.name}</TableCell>
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
                  <div key={a.name} className="rounded-md border border-border p-3 space-y-1.5 cursor-pointer hover:bg-muted/50" onClick={() => setSelectedAssignee(a.name)}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-primary underline underline-offset-2">{a.name}</span>
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
