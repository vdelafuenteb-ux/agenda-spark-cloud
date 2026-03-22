import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, CheckCircle2, AlertTriangle, Clock, Target, ListChecks, TrendingUp, CalendarClock, Bell, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatStoredDate, isStoredDateOverdue } from '@/lib/date';
import { isBefore, addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useState } from 'react';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Assignee } from '@/hooks/useAssignees';

interface AssigneeProfileViewProps {
  assigneeName: string;
  assignee?: Assignee;
  topics: TopicWithSubtasks[];
  onBack: () => void;
}

export function AssigneeProfileView({ assigneeName, assignee, topics, onBack }: AssigneeProfileViewProps) {
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Fetch email history for this assignee
  const { data: emailHistory = [] } = useQuery({
    queryKey: ['notification_emails_assignee', assigneeName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_emails')
        .select('*, topics(title)')
        .eq('assignee_name', assigneeName)
        .order('sent_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const metrics = useMemo(() => {
    const now = new Date();
    const threeDaysFromNow = addDays(now, 3);

    const assigneeTopics = topics.filter(t => t.assignee === assigneeName);
    const active = assigneeTopics.filter(t => t.status === 'activo');
    const seguimiento = assigneeTopics.filter(t => t.status === 'seguimiento');
    const completed = assigneeTopics.filter(t => t.status === 'completado');
    const paused = assigneeTopics.filter(t => t.status === 'pausado');

    const activeAndTracking = [...active, ...seguimiento];
    const nonOngoing = activeAndTracking.filter(t => !t.is_ongoing);
    const overdue = nonOngoing.filter(t => isStoredDateOverdue(t.due_date));
    const dueSoon = nonOngoing.filter(t => {
      if (!t.due_date || isStoredDateOverdue(t.due_date)) return false;
      const due = new Date(t.due_date + 'T23:59:59');
      return isBefore(due, threeDaysFromNow);
    });

    const allSubtasks = assigneeTopics.flatMap(t => t.subtasks);
    const completedSubtasks = allSubtasks.filter(s => s.completed);
    const subtaskProgress = allSubtasks.length > 0
      ? Math.round((completedSubtasks.length / allSubtasks.length) * 100)
      : 0;

    const alta = assigneeTopics.filter(t => t.priority === 'alta' && t.status !== 'completado');
    const media = assigneeTopics.filter(t => t.priority === 'media' && t.status !== 'completado');
    const baja = assigneeTopics.filter(t => t.priority === 'baja' && t.status !== 'completado');

    const emailsSent = emailHistory.length;
    const emailsResponded = emailHistory.filter((e: any) => e.responded).length;
    const emailsConfirmed = emailHistory.filter((e: any) => e.confirmed).length;
    const responseRate = emailsSent > 0 ? Math.round((emailsResponded / emailsSent) * 100) : 0;

    return {
      assigneeTopics,
      active,
      seguimiento,
      completed,
      paused,
      overdue,
      dueSoon,
      allSubtasks,
      completedSubtasks,
      subtaskProgress,
      alta,
      media,
      baja,
      emailsSent,
      emailsResponded,
      emailsConfirmed,
      responseRate,
    };
  }, [topics, assigneeName, emailHistory]);

  const handleSendReminder = async (topic: TopicWithSubtasks) => {
    if (!assignee?.email) {
      toast.error(`${assigneeName} no tiene correo configurado`);
      return;
    }
    setSendingId(topic.id);
    try {
      const { error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          to_email: assignee.email,
          to_name: assigneeName,
          topic_title: topic.title,
          subtasks: topic.subtasks.map(s => ({ title: s.title, completed: s.completed, due_date: s.due_date })),
          start_date: topic.start_date,
          due_date: topic.due_date,
          progress_entries: topic.progress_entries || [],
        },
      });
      if (error) throw error;
      toast.success(`Recordatorio enviado a ${assigneeName}`);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };

  const kpis = [
    { title: 'Temas totales', value: metrics.assigneeTopics.length, icon: Target, color: 'text-blue-500' },
    { title: 'Subtareas', value: `${metrics.completedSubtasks.length}/${metrics.allSubtasks.length}`, icon: ListChecks, color: 'text-primary', subtitle: `${metrics.subtaskProgress}% completado` },
    { title: 'Atrasados', value: metrics.overdue.length, icon: AlertTriangle, color: metrics.overdue.length > 0 ? 'text-destructive' : 'text-muted-foreground' },
    { title: 'Completados', value: metrics.completed.length, icon: CheckCircle2, color: 'text-green-500' },
    { title: 'Correos enviados', value: metrics.emailsSent, icon: Mail, color: 'text-primary' },
    { title: 'Tasa respuesta', value: `${metrics.responseRate}%`, icon: TrendingUp, color: metrics.responseRate >= 80 ? 'text-green-500' : metrics.responseRate >= 50 ? 'text-yellow-500' : 'text-destructive' },
  ];

  const renderTopicRow = (t: TopicWithSubtasks, showBell = false) => {
    const pendingSubtasks = t.subtasks.filter(s => !s.completed).length;
    const totalSubtasks = t.subtasks.length;
    const isOverdue = isStoredDateOverdue(t.due_date);

    return (
      <TableRow key={t.id} className={isOverdue ? 'bg-destructive/5' : ''}>
        <TableCell className="text-sm font-medium max-w-[200px] truncate">{t.title}</TableCell>
        <TableCell className="text-center">
          <Badge
            variant={t.priority === 'alta' ? 'destructive' : t.priority === 'media' ? 'outline' : 'secondary'}
            className="text-[9px]"
          >
            {t.priority}
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          <Badge
            variant="outline"
            className={`text-[9px] ${
              t.status === 'activo' ? 'border-blue-500/50 text-blue-600' :
              t.status === 'seguimiento' ? 'border-cyan-500/50 text-cyan-600' :
              t.status === 'completado' ? 'border-green-500/50 text-green-600' :
              'border-yellow-500/50 text-yellow-600'
            }`}
          >
            {t.status}
          </Badge>
        </TableCell>
        <TableCell className={`text-xs text-center ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
          {t.due_date ? formatStoredDate(t.due_date, 'dd MMM yyyy', { locale: es }) : '—'}
        </TableCell>
        <TableCell className="text-xs text-center">
          <span className={pendingSubtasks > 0 ? 'text-destructive' : 'text-muted-foreground'}>
            {pendingSubtasks > 0 ? `${pendingSubtasks} pendiente${pendingSubtasks > 1 ? 's' : ''}` : `${totalSubtasks > 0 ? '✓' : '—'}`}
          </span>
        </TableCell>
        {showBell && (
          <TableCell className="text-center">
            <button
              onClick={() => handleSendReminder(t)}
              disabled={sendingId === t.id || !assignee?.email}
              className="p-1 rounded-full hover:bg-muted transition-colors disabled:opacity-30"
              title="Enviar recordatorio"
            >
              {sendingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />}
            </button>
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <div className="flex-1 overflow-auto p-3 md:p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground">{assigneeName}</h2>
            {assignee?.email && (
              <p className="text-sm text-muted-foreground">{assignee.email}</p>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpis.map((kpi) => (
            <Card key={kpi.title}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.title}</span>
                  <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                </div>
                <div className="text-xl font-bold text-foreground">{kpi.value}</div>
                {kpi.subtitle && <p className="text-[10px] text-muted-foreground">{kpi.subtitle}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Overdue + Due Soon */}
        {(metrics.overdue.length > 0 || metrics.dueSoon.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {metrics.overdue.length > 0 && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-1 p-3">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Atrasados ({metrics.overdue.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="space-y-1.5">
                    {metrics.overdue.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs gap-1">
                        <span className="text-foreground truncate flex-1">{t.title}</span>
                        <Badge variant="destructive" className="text-[9px] shrink-0">{t.due_date}</Badge>
                        <button
                          onClick={() => handleSendReminder(t)}
                          disabled={sendingId === t.id || !assignee?.email}
                          className="shrink-0 p-1 rounded-full hover:bg-destructive/10 text-destructive transition-colors disabled:opacity-30"
                        >
                          {sendingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {metrics.dueSoon.length > 0 && (
              <Card className="border-yellow-500/30">
                <CardHeader className="pb-1 p-3">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-yellow-600">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Por Vencer ({metrics.dueSoon.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="space-y-1.5">
                    {metrics.dueSoon.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs gap-1">
                        <span className="text-foreground truncate flex-1">{t.title}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0 border-yellow-500/50 text-yellow-600">{t.due_date}</Badge>
                        <button
                          onClick={() => handleSendReminder(t)}
                          disabled={sendingId === t.id || !assignee?.email}
                          className="shrink-0 p-1 rounded-full hover:bg-yellow-500/10 text-yellow-600 transition-colors disabled:opacity-30"
                        >
                          {sendingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Priority breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {[
            { label: 'Prioridad Alta', items: metrics.alta, color: 'text-destructive', border: 'border-destructive/30' },
            { label: 'Prioridad Media', items: metrics.media, color: 'text-yellow-600', border: 'border-yellow-500/30' },
            { label: 'Prioridad Baja', items: metrics.baja, color: 'text-green-600', border: 'border-green-500/30' },
          ].map(group => (
            <Card key={group.label} className={group.border}>
              <CardHeader className="pb-1 p-3">
                <CardTitle className={`text-xs font-medium ${group.color}`}>
                  {group.label} ({group.items.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {group.items.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-1">Sin temas</p>
                ) : (
                  <div className="space-y-1">
                    {group.items.map(t => (
                      <div key={t.id} className="text-xs flex items-center justify-between">
                        <span className="truncate flex-1">{t.title}</span>
                        <Badge variant="outline" className={`text-[9px] ml-1 shrink-0 ${
                          t.status === 'activo' ? 'border-blue-500/50 text-blue-600' : 'border-cyan-500/50 text-cyan-600'
                        }`}>{t.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* All topics table */}
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              Todos los temas ({metrics.assigneeTopics.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tema</TableHead>
                    <TableHead className="text-xs text-center">Prioridad</TableHead>
                    <TableHead className="text-xs text-center">Estado</TableHead>
                    <TableHead className="text-xs text-center">Vencimiento</TableHead>
                    <TableHead className="text-xs text-center">Subtareas</TableHead>
                    <TableHead className="text-xs text-center w-10">📧</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.assigneeTopics.map(t => renderTopicRow(t, true))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile */}
            <div className="sm:hidden space-y-2">
              {metrics.assigneeTopics.map(t => {
                const pendingSubs = t.subtasks.filter(s => !s.completed).length;
                const isOverdueT = isStoredDateOverdue(t.due_date);
                return (
                  <div key={t.id} className={`rounded-md border p-3 space-y-1.5 ${isOverdueT ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate flex-1">{t.title}</span>
                      <button
                        onClick={() => handleSendReminder(t)}
                        disabled={sendingId === t.id || !assignee?.email}
                        className="p-1 rounded-full hover:bg-muted transition-colors disabled:opacity-30"
                      >
                        {sendingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant={t.priority === 'alta' ? 'destructive' : 'outline'} className="text-[9px]">{t.priority}</Badge>
                      <Badge variant="outline" className="text-[9px]">{t.status}</Badge>
                      {t.due_date && <Badge variant={isOverdueT ? 'destructive' : 'outline'} className="text-[9px]">{t.due_date}</Badge>}
                      {pendingSubs > 0 && <Badge variant="outline" className="text-[9px] text-destructive">{pendingSubs} pendientes</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Email History */}
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Historial de correos ({emailHistory.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {emailHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No se han enviado correos a {assigneeName}</p>
            ) : (
              <>
                {/* Summary bar */}
                <div className="flex items-center gap-4 mb-3 text-xs">
                  <span className="text-muted-foreground">
                    Enviados: <strong className="text-foreground">{metrics.emailsSent}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Respondidos: <strong className="text-green-600">{metrics.emailsResponded}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Confirmados: <strong className="text-blue-600">{metrics.emailsConfirmed}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Tasa: <strong className={metrics.responseRate >= 80 ? 'text-green-600' : metrics.responseRate >= 50 ? 'text-yellow-600' : 'text-destructive'}>{metrics.responseRate}%</strong>
                  </span>
                </div>
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Tema</TableHead>
                        <TableHead className="text-xs text-center">Enviado</TableHead>
                        <TableHead className="text-xs text-center">Respondido</TableHead>
                        <TableHead className="text-xs text-center">Confirmado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailHistory.slice(0, 20).map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm">{e.topics?.title || e.topic_id}</TableCell>
                          <TableCell className="text-xs text-center text-muted-foreground">
                            {format(new Date(e.sent_at), 'dd MMM HH:mm', { locale: es })}
                          </TableCell>
                          <TableCell className="text-center">
                            {e.responded ? (
                              <Badge variant="outline" className="text-[9px] border-green-500/50 text-green-600">Sí</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Pendiente</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {e.confirmed ? (
                              <Badge variant="outline" className="text-[9px] border-blue-500/50 text-blue-600">Sí</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile */}
                <div className="sm:hidden space-y-2">
                  {emailHistory.slice(0, 20).map((e: any) => (
                    <div key={e.id} className="rounded-md border border-border p-2.5 space-y-1">
                      <div className="text-sm font-medium truncate">{e.topics?.title || e.topic_id}</div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{format(new Date(e.sent_at), 'dd MMM HH:mm', { locale: es })}</span>
                        {e.responded && <Badge variant="outline" className="text-[8px] border-green-500/50 text-green-600">Respondido</Badge>}
                        {e.confirmed && <Badge variant="outline" className="text-[8px] border-blue-500/50 text-blue-600">Confirmado</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Subtask progress */}
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium">Avance de subtareas</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center gap-3 mb-3">
              <Progress value={metrics.subtaskProgress} className="h-3 flex-1" />
              <span className="text-sm font-semibold text-foreground">{metrics.subtaskProgress}%</span>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Completadas: <strong className="text-green-600">{metrics.completedSubtasks.length}</strong></span>
              <span>Pendientes: <strong className="text-foreground">{metrics.allSubtasks.length - metrics.completedSubtasks.length}</strong></span>
              <span>Total: <strong>{metrics.allSubtasks.length}</strong></span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
