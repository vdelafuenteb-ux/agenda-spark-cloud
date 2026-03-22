import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Mail, CheckCircle2, AlertTriangle, Target, ListChecks, TrendingUp, CalendarClock, Bell, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatStoredDate, isStoredDateOverdue } from '@/lib/date';
import { isBefore, addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Assignee } from '@/hooks/useAssignees';

interface AssigneeProfileViewProps {
  assigneeName: string;
  assignee?: Assignee;
  topics: TopicWithSubtasks[];
  onBack: () => void;
}

function CollapsibleSection({ title, icon: Icon, count, defaultOpen = false, children, badge }: {
  title: string; icon: any; count?: number; defaultOpen?: boolean; children: React.ReactNode; badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{title}</span>
            {count !== undefined && <Badge variant="secondary" className="text-[10px] h-5">{count}</Badge>}
            {badge}
          </div>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AssigneeProfileView({ assigneeName, assignee, topics, onBack }: AssigneeProfileViewProps) {
  const [sendingId, setSendingId] = useState<string | null>(null);

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
    // Use confirmed as the response metric (confirmed = the admin marked the person responded)
    const emailsConfirmed = emailHistory.filter((e: any) => e.confirmed).length;
    const responseRate = emailsSent > 0 ? Math.round((emailsConfirmed / emailsSent) * 100) : 0;

    return {
      assigneeTopics, active, seguimiento, completed,
      overdue, dueSoon, allSubtasks, completedSubtasks, subtaskProgress,
      alta, media, baja, emailsSent, emailsConfirmed, responseRate,
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

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-48px)] overflow-hidden">
      {/* Fixed header */}
      <div className="shrink-0 p-3 md:p-4 border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{assigneeName}</h2>
            {assignee?.email && <p className="text-xs text-muted-foreground">{assignee.email}</p>}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="max-w-6xl mx-auto p-3 md:p-4 space-y-4">
          {/* KPIs row - includes subtask progress */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { title: 'Temas', value: metrics.assigneeTopics.length, icon: Target, color: 'text-blue-500' },
              { title: 'Subtareas', value: `${metrics.completedSubtasks.length}/${metrics.allSubtasks.length}`, icon: ListChecks, color: 'text-primary' },
              { title: 'Atrasados', value: metrics.overdue.length, icon: AlertTriangle, color: metrics.overdue.length > 0 ? 'text-destructive' : 'text-muted-foreground' },
              { title: 'Completados', value: metrics.completed.length, icon: CheckCircle2, color: 'text-green-500' },
              { title: 'Correos', value: metrics.emailsSent, icon: Mail, color: 'text-primary' },
              { title: 'Confirmados', value: `${metrics.responseRate}%`, icon: TrendingUp, color: metrics.responseRate >= 80 ? 'text-green-500' : metrics.responseRate >= 50 ? 'text-yellow-500' : 'text-destructive' },
            ].map((kpi) => (
              <Card key={kpi.title}>
                <CardContent className="p-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.title}</span>
                    <kpi.icon className={`h-3 w-3 ${kpi.color}`} />
                  </div>
                  <div className="text-lg font-bold text-foreground">{kpi.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Subtask progress bar - compact */}
          {metrics.allSubtasks.length > 0 && (
            <div className="flex items-center gap-3 px-1">
              <span className="text-xs text-muted-foreground shrink-0">Avance</span>
              <Progress value={metrics.subtaskProgress} className="h-2 flex-1" />
              <span className="text-xs font-medium shrink-0">{metrics.subtaskProgress}%</span>
            </div>
          )}

          {/* Overdue + Due Soon - side by side, always */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className={metrics.overdue.length > 0 ? 'border-destructive/30' : ''}>
              <CardHeader className="pb-1 p-3">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Atrasados ({metrics.overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {metrics.overdue.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-1">Sin atrasos 🎉</p>
                ) : (
                  <div className="space-y-1.5">
                    {metrics.overdue.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs gap-1">
                        <span className="truncate flex-1">{t.title}</span>
                        <Badge variant="destructive" className="text-[9px] shrink-0">{t.due_date}</Badge>
                        <button onClick={() => handleSendReminder(t)} disabled={sendingId === t.id || !assignee?.email}
                          className="shrink-0 p-1 rounded-full hover:bg-destructive/10 text-destructive transition-colors disabled:opacity-30">
                          {sendingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className={metrics.dueSoon.length > 0 ? 'border-yellow-500/30' : ''}>
              <CardHeader className="pb-1 p-3">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-yellow-600">
                  <CalendarClock className="h-3.5 w-3.5" /> Por Vencer ({metrics.dueSoon.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {metrics.dueSoon.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-1">Nada próximo a vencer</p>
                ) : (
                  <div className="space-y-1.5">
                    {metrics.dueSoon.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs gap-1">
                        <span className="truncate flex-1">{t.title}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0 border-yellow-500/50 text-yellow-600">{t.due_date}</Badge>
                        <button onClick={() => handleSendReminder(t)} disabled={sendingId === t.id || !assignee?.email}
                          className="shrink-0 p-1 rounded-full hover:bg-yellow-500/10 text-yellow-600 transition-colors disabled:opacity-30">
                          {sendingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Collapsible: Priority breakdown */}
          <CollapsibleSection title="Prioridades" icon={Target} defaultOpen={true}
            badge={
              <div className="flex gap-1 ml-1">
                {metrics.alta.length > 0 && <Badge variant="destructive" className="text-[9px] h-4">{metrics.alta.length} alta</Badge>}
                {metrics.media.length > 0 && <Badge variant="outline" className="text-[9px] h-4 border-yellow-500/50 text-yellow-600">{metrics.media.length} media</Badge>}
                {metrics.baja.length > 0 && <Badge variant="outline" className="text-[9px] h-4 border-green-500/50 text-green-600">{metrics.baja.length} baja</Badge>}
              </div>
            }>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {[
                { label: 'Alta', items: metrics.alta, color: 'text-destructive', border: 'border-destructive/30' },
                { label: 'Media', items: metrics.media, color: 'text-yellow-600', border: 'border-yellow-500/30' },
                { label: 'Baja', items: metrics.baja, color: 'text-green-600', border: 'border-green-500/30' },
              ].map(group => (
                <Card key={group.label} className={group.border}>
                  <CardContent className="p-3">
                    <p className={`text-xs font-medium mb-2 ${group.color}`}>{group.label} ({group.items.length})</p>
                    {group.items.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">Sin temas</p>
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
          </CollapsibleSection>

          {/* Collapsible: All topics table */}
          <CollapsibleSection title="Todos los temas" icon={ListChecks} count={metrics.assigneeTopics.length} defaultOpen={false}>
            <Card>
              <CardContent className="p-3">
                <div className="hidden sm:block max-h-[300px] overflow-auto">
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
                      {metrics.assigneeTopics.map(t => {
                        const pending = t.subtasks.filter(s => !s.completed).length;
                        const isOverdue = isStoredDateOverdue(t.due_date);
                        return (
                          <TableRow key={t.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                            <TableCell className="text-sm font-medium max-w-[200px] truncate">{t.title}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={t.priority === 'alta' ? 'destructive' : t.priority === 'media' ? 'outline' : 'secondary'} className="text-[9px]">{t.priority}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={`text-[9px] ${
                                t.status === 'activo' ? 'border-blue-500/50 text-blue-600' :
                                t.status === 'seguimiento' ? 'border-cyan-500/50 text-cyan-600' :
                                t.status === 'completado' ? 'border-green-500/50 text-green-600' :
                                'border-yellow-500/50 text-yellow-600'
                              }`}>{t.status}</Badge>
                            </TableCell>
                            <TableCell className={`text-xs text-center ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                              {t.due_date ? formatStoredDate(t.due_date, 'dd MMM yyyy', { locale: es }) : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-center">
                              <span className={pending > 0 ? 'text-destructive' : 'text-muted-foreground'}>
                                {pending > 0 ? `${pending} pend.` : t.subtasks.length > 0 ? '✓' : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <button onClick={() => handleSendReminder(t)} disabled={sendingId === t.id || !assignee?.email}
                                className="p-1 rounded-full hover:bg-muted transition-colors disabled:opacity-30">
                                {sendingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />}
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile */}
                <div className="sm:hidden space-y-2 max-h-[300px] overflow-auto">
                  {metrics.assigneeTopics.map(t => {
                    const pending = t.subtasks.filter(s => !s.completed).length;
                    const isOverdue = isStoredDateOverdue(t.due_date);
                    return (
                      <div key={t.id} className={`rounded-md border p-2.5 space-y-1 ${isOverdue ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium truncate flex-1">{t.title}</span>
                          <button onClick={() => handleSendReminder(t)} disabled={sendingId === t.id || !assignee?.email}
                            className="p-1 rounded-full hover:bg-muted transition-colors disabled:opacity-30">
                            {sendingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3 text-muted-foreground" />}
                          </button>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant={t.priority === 'alta' ? 'destructive' : 'outline'} className="text-[9px]">{t.priority}</Badge>
                          <Badge variant="outline" className="text-[9px]">{t.status}</Badge>
                          {t.due_date && <Badge variant={isOverdue ? 'destructive' : 'outline'} className="text-[9px]">{t.due_date}</Badge>}
                          {pending > 0 && <Badge variant="outline" className="text-[9px] text-destructive">{pending} pend.</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </CollapsibleSection>

          {/* Collapsible: Email History */}
          <CollapsibleSection title="Historial de correos" icon={Mail} count={emailHistory.length} defaultOpen={false}>
            <Card>
              <CardContent className="p-3">
                {emailHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No se han enviado correos a {assigneeName}</p>
                ) : (
                  <>
                    <div className="flex items-center gap-4 mb-3 text-xs">
                      <span className="text-muted-foreground">Enviados: <strong className="text-foreground">{metrics.emailsSent}</strong></span>
                      <span className="text-muted-foreground">Confirmados: <strong className="text-green-600">{metrics.emailsConfirmed}</strong></span>
                      <span className="text-muted-foreground">
                        Tasa: <strong className={metrics.responseRate >= 80 ? 'text-green-600' : metrics.responseRate >= 50 ? 'text-yellow-600' : 'text-destructive'}>{metrics.responseRate}%</strong>
                      </span>
                    </div>
                    <div className="hidden sm:block max-h-[250px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Tema</TableHead>
                            <TableHead className="text-xs text-center">Enviado</TableHead>
                            <TableHead className="text-xs text-center">Confirmado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {emailHistory.map((e: any) => (
                            <TableRow key={e.id}>
                              <TableCell className="text-xs">{e.topics?.title || e.topic_id}</TableCell>
                              <TableCell className="text-xs text-center text-muted-foreground">
                                {format(new Date(e.sent_at), 'dd MMM HH:mm', { locale: es })}
                              </TableCell>
                              <TableCell className="text-center">
                                {e.confirmed ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mx-auto" />
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="sm:hidden space-y-1.5 max-h-[250px] overflow-auto">
                      {emailHistory.map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{e.topics?.title || e.topic_id}</p>
                            <p className="text-[10px] text-muted-foreground">{format(new Date(e.sent_at), 'dd MMM HH:mm', { locale: es })}</p>
                          </div>
                          {e.confirmed ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" /> : <span className="text-[10px] text-muted-foreground">—</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </CollapsibleSection>
        </div>
      </ScrollArea>
    </div>
  );
}
