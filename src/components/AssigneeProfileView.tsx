import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Mail, CheckCircle2, AlertTriangle, Target, ListChecks, TrendingUp, CalendarClock, Bell, Loader2, BarChart3, Plus, Send, Trash2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatStoredDate, isStoredDateOverdue } from '@/lib/date';
import { cn } from '@/lib/utils';
import { isBefore, addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Reschedule } from '@/hooks/useReschedules';
import type { Assignee } from '@/hooks/useAssignees';
import { useIncidents } from '@/hooks/useIncidents';
import { computeGlobalRescheduleStats } from '@/lib/rescheduleMetrics';
import { computeProductivityScore } from '@/lib/productivityScore';
import { useDepartments } from '@/hooks/useDepartments';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface AssigneeProfileViewProps {
  assigneeName: string;
  assignee?: Assignee;
  topics: TopicWithSubtasks[];
  reschedules: Reschedule[];
  onBack: () => void;
  onNavigateToTopic?: (topicId: string, status: string) => void;
}

export function AssigneeProfileView({ assigneeName, assignee, topics, reschedules: assigneeReschedules, onBack, onNavigateToTopic }: AssigneeProfileViewProps) {
  const queryClient = useQueryClient();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [showTrend, setShowTrend] = useState(false);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ title: '', description: '', category: 'leve' as 'leve' | 'moderada' | 'grave', incident_date: new Date().toISOString().split('T')[0] });
  const [sendingIncidentEmail, setSendingIncidentEmail] = useState<string | null>(null);

  const { incidents, createIncident, deleteIncident, markEmailSent } = useIncidents(assigneeName);
  const { departments } = useDepartments();
  const assigneeDeptName = useMemo(() => {
    if (!assignee?.department_id) return null;
    return departments.find(d => d.id === assignee.department_id)?.name || null;
  }, [assignee, departments]);

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

  const { data: scoreSnapshots = [] } = useQuery({
    queryKey: ['score_snapshots', assigneeName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('score_snapshots')
        .select('*')
        .eq('assignee_name', assigneeName)
        .order('snapshot_date', { ascending: true })
        .limit(52);
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        label: format(new Date(s.snapshot_date + 'T12:00:00'), 'dd MMM', { locale: es }),
      }));
    },
  });

  const DEADLINE_HOURS = 48;

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

    const completedWithDue = completedSubtasks.filter(s => s.due_date && s.completed_at);
    const subtasksOnTime = completedWithDue.filter(s => {
      const dueDate = new Date(s.due_date! + 'T23:59:59');
      const completedDate = new Date(s.completed_at!);
      return completedDate.getTime() <= dueDate.getTime();
    });
    const subtasksLate = completedWithDue.length - subtasksOnTime.length;
    const subtaskTimelinessRate = completedWithDue.length > 0
      ? Math.round((subtasksOnTime.length / completedWithDue.length) * 100)
      : null;
    const pendingOverdueSubtasks = allSubtasks.filter(s => !s.completed && s.due_date && isStoredDateOverdue(s.due_date));

    const alta = assigneeTopics.filter(t => t.priority === 'alta' && t.status !== 'completado');
    const media = assigneeTopics.filter(t => t.priority === 'media' && t.status !== 'completado');
    const baja = assigneeTopics.filter(t => t.priority === 'baja' && t.status !== 'completado');

    const emailsSent = emailHistory.length;
    const emailsConfirmed = emailHistory.filter((e: any) => e.confirmed).length;
    const responseRate = emailsSent > 0 ? Math.round((emailsConfirmed / emailsSent) * 100) : 0;

    const confirmedEmails = emailHistory.filter((e: any) => e.confirmed && e.confirmed_at);
    const onTimeEmails = confirmedEmails.filter((e: any) => {
      const deadlineTime = new Date(e.sent_at).getTime() + DEADLINE_HOURS * 60 * 60 * 1000;
      return new Date(e.confirmed_at).getTime() <= deadlineTime;
    });
    const lateEmails = confirmedEmails.length - onTimeEmails.length;
    const complianceRate = confirmedEmails.length > 0 ? Math.round((onTimeEmails.length / confirmedEmails.length) * 100) : 0;

    const closedWithDates = completed.filter(t => t.due_date && t.closed_at);
    let closureOnTime = 0;
    let closureLate = 0;
    let totalDelayDays = 0;
    let totalEarlyDays = 0;
    for (const t of closedWithDates) {
      const closedDate = new Date(t.closed_at!);
      const dueDate = new Date(t.due_date! + 'T23:59:59');
      const diffDays = Math.round((closedDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) {
        closureOnTime++;
        totalEarlyDays += Math.abs(diffDays);
      } else {
        closureLate++;
        totalDelayDays += diffDays;
      }
    }
    const closureComplianceRate = closedWithDates.length > 0 ? Math.round((closureOnTime / closedWithDates.length) * 100) : null;
    const avgDelayDays = closureLate > 0 ? Math.round(totalDelayDays / closureLate) : 0;
    const avgEarlyDays = closureOnTime > 0 ? Math.round(totalEarlyDays / closureOnTime) : 0;

    const closedWithStartAndDue = completed.filter(t => t.start_date && t.due_date && t.closed_at);
    let velocityScore: number | null = null;
    let avgPctUsed: number | null = null;
    if (closedWithStartAndDue.length > 0) {
      const pcts = closedWithStartAndDue.map(t => {
        const start = new Date(t.start_date!).getTime();
        const due = new Date(t.due_date! + 'T23:59:59').getTime();
        const closed = new Date(t.closed_at!).getTime();
        const totalTime = due - start;
        if (totalTime <= 0) return 100;
        const usedTime = closed - start;
        return Math.min(Math.round((usedTime / totalTime) * 100), 150);
      });
      avgPctUsed = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
      velocityScore = Math.max(0, Math.min(100, Math.round(100 - (avgPctUsed - 50) * (100 / 100))));
    }

    const activeWithDue = activeAndTracking.filter(t => t.due_date && !t.is_ongoing);
    const activeOnTime = activeWithDue.filter(t => !isStoredDateOverdue(t.due_date));
    const deadlineCompliance = activeWithDue.length > 0 ? Math.round((activeOnTime.length / activeWithDue.length) * 100) : null;

    // Use shared utility for the main score
    const scoreResult = computeProductivityScore(assigneeName, topics, emailHistory);
    const productivityScore = scoreResult.score;
    const redistributedWeights = scoreResult.redistributedWeights;

    return {
      assigneeTopics, active, seguimiento, completed,
      overdue, dueSoon, allSubtasks, completedSubtasks, subtaskProgress,
      alta, media, baja, emailsSent, emailsConfirmed, responseRate,
      onTimeEmails: onTimeEmails.length, lateEmails, complianceRate, confirmedTotal: confirmedEmails.length,
      closureOnTime, closureLate, closureComplianceRate, avgDelayDays, avgEarlyDays, closedWithDatesTotal: closedWithDates.length,
      productivityScore, subtasksOnTime: subtasksOnTime.length, subtasksLate, subtaskTimelinessRate,
      completedWithDueTotal: completedWithDue.length, pendingOverdueSubtasks: pendingOverdueSubtasks.length,
      velocityScore, avgPctUsed, redistributedWeights,
      deadlineCompliance, activeWithDueTotal: activeWithDue.length, activeOnTimeTotal: activeOnTime.length,
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
      queryClient.invalidateQueries({ queryKey: ['notification_emails'] });
      queryClient.invalidateQueries({ queryKey: ['notification_emails_all'] });
      queryClient.invalidateQueries({ queryKey: ['notification_emails_all_dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['notification_emails_team'] });
      queryClient.invalidateQueries({ queryKey: ['notification_emails_assignee'] });
      toast.success(`Recordatorio enviado a ${assigneeName}`);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };

  // Render metric items for performance card
  const renderMetricItems = () => {
    const metricItems: { key: string; weight: number; node: React.ReactNode }[] = [];

    if (metrics.closureComplianceRate !== null) {
      metricItems.push({ key: 'closure', weight: metrics.redistributedWeights.closure ?? 0, node: (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Cierre de temas a tiempo
              <Badge variant="outline" className="text-[8px] h-4 px-1 border-muted-foreground/30">{metrics.redistributedWeights.closure ?? 0}%</Badge>
            </span>
            <span className={cn("text-xs font-bold", metrics.closureComplianceRate >= 80 ? "text-green-600" : metrics.closureComplianceRate >= 50 ? "text-yellow-600" : "text-destructive")}>{metrics.closureComplianceRate}%</span>
          </div>
          <Progress value={metrics.closureComplianceRate} className="h-1.5" />
          <div className="flex gap-3 text-[10px] text-muted-foreground flex-wrap">
            <span>A tiempo: <strong className="text-green-600">{metrics.closureOnTime}</strong></span>
            <span>Con atraso: <strong className="text-destructive">{metrics.closureLate}</strong></span>
            <span>Total: <strong className="text-foreground">{metrics.closedWithDatesTotal}</strong></span>
            {metrics.avgDelayDays > 0 && <span>Prom. atraso: <strong className="text-destructive">{metrics.avgDelayDays}d</strong></span>}
            {metrics.avgEarlyDays > 0 && <span>Prom. anticipación: <strong className="text-green-600">{metrics.avgEarlyDays}d</strong></span>}
          </div>
        </div>
      )});
    }

    if (metrics.subtaskTimelinessRate !== null) {
      metricItems.push({ key: 'subtask', weight: metrics.redistributedWeights.subtask ?? 0, node: (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ListChecks className="h-3 w-3" /> Puntualidad de subtareas
              <Badge variant="outline" className="text-[8px] h-4 px-1 border-muted-foreground/30">{metrics.redistributedWeights.subtask ?? 0}%</Badge>
            </span>
            <span className={cn("text-xs font-bold", metrics.subtaskTimelinessRate >= 80 ? "text-green-600" : metrics.subtaskTimelinessRate >= 50 ? "text-yellow-600" : "text-destructive")}>{metrics.subtaskTimelinessRate}%</span>
          </div>
          <Progress value={metrics.subtaskTimelinessRate} className="h-1.5" />
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span>A tiempo: <strong className="text-green-600">{metrics.subtasksOnTime}</strong></span>
            <span>Con atraso: <strong className="text-destructive">{metrics.subtasksLate}</strong></span>
            <span>Total: <strong className="text-foreground">{metrics.completedWithDueTotal}</strong></span>
          </div>
        </div>
      )});
    }

    if (metrics.confirmedTotal > 0) {
      metricItems.push({ key: 'email', weight: metrics.redistributedWeights.email ?? 0, node: (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> Respuesta de correos
              <Badge variant="outline" className="text-[8px] h-4 px-1 border-muted-foreground/30">{metrics.redistributedWeights.email ?? 0}%</Badge>
            </span>
            <span className={cn("text-xs font-bold", metrics.complianceRate >= 80 ? "text-green-600" : metrics.complianceRate >= 50 ? "text-yellow-600" : "text-destructive")}>{metrics.complianceRate}%</span>
          </div>
          <Progress value={metrics.complianceRate} className="h-1.5" />
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span>A tiempo: <strong className="text-green-600">{metrics.onTimeEmails}</strong></span>
            <span>Fuera de plazo: <strong className="text-destructive">{metrics.lateEmails}</strong></span>
            <span>Total: <strong className="text-foreground">{metrics.confirmedTotal}</strong></span>
          </div>
        </div>
      )});
    }

    if (metrics.velocityScore !== null && metrics.avgPctUsed !== null) {
      metricItems.push({ key: 'velocity', weight: metrics.redistributedWeights.velocity ?? 0, node: (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" /> Velocidad de ejecución
              <Badge variant="outline" className="text-[8px] h-4 px-1 border-muted-foreground/30">{metrics.redistributedWeights.velocity ?? 0}%</Badge>
            </span>
            <span className={cn("text-xs font-bold", metrics.avgPctUsed <= 70 ? "text-green-600" : metrics.avgPctUsed <= 100 ? "text-yellow-600" : "text-destructive")}>{metrics.avgPctUsed}%</span>
          </div>
          <Progress value={Math.max(0, 100 - metrics.avgPctUsed + 50)} className="h-1.5" />
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span>Usa en promedio el <strong className={metrics.avgPctUsed <= 70 ? "text-green-600" : metrics.avgPctUsed <= 100 ? "text-yellow-600" : "text-destructive"}>{metrics.avgPctUsed}%</strong> del plazo asignado</span>
          </div>
        </div>
      )});
    }

    if (metrics.deadlineCompliance !== null) {
      metricItems.push({ key: 'deadline', weight: metrics.redistributedWeights.deadline ?? 0, node: (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarClock className="h-3 w-3" /> Plazos activos al día
              <Badge variant="outline" className="text-[8px] h-4 px-1 border-muted-foreground/30">{metrics.redistributedWeights.deadline ?? 0}%</Badge>
            </span>
            <span className={cn("text-xs font-bold", metrics.deadlineCompliance >= 80 ? "text-green-600" : metrics.deadlineCompliance >= 50 ? "text-yellow-600" : "text-destructive")}>{metrics.deadlineCompliance}%</span>
          </div>
          <Progress value={metrics.deadlineCompliance} className="h-1.5" />
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span>Al día: <strong className="text-green-600">{metrics.activeOnTimeTotal}</strong></span>
            <span>Atrasados: <strong className="text-destructive">{metrics.activeWithDueTotal - metrics.activeOnTimeTotal}</strong></span>
            <span>Total: <strong className="text-foreground">{metrics.activeWithDueTotal}</strong></span>
          </div>
        </div>
      )});
    }

    return metricItems.sort((a, b) => b.weight - a.weight).map(m => <div key={m.key}>{m.node}</div>);
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
            <div className="flex items-center gap-2">
              {assignee?.email && <span className="text-xs text-muted-foreground">{assignee.email}</span>}
              {assignee?.email && assigneeDeptName && <span className="text-xs text-muted-foreground">·</span>}
              <span className="text-xs text-muted-foreground">{assigneeDeptName || 'Sin departamento'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="max-w-6xl mx-auto p-3 md:p-4 space-y-4">
          {/* KPIs row */}
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

          {/* Tabs */}
          <Tabs defaultValue="resumen" className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-10">
              <TabsTrigger value="resumen" className="text-xs gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Resumen</span>
              </TabsTrigger>
              <TabsTrigger value="temas" className="text-xs gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Temas</span>
                <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">{metrics.assigneeTopics.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="correos" className="text-xs gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Correos</span>
                <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">{emailHistory.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="incidencias" className="text-xs gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Incidencias</span>
                <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">{incidents.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* ===== TAB: RESUMEN ===== */}
            <TabsContent value="resumen" className="space-y-4 mt-4">
              {/* Rendimiento consolidado */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-5">
                    {/* Circular Score */}
                    {metrics.productivityScore !== null && (() => {
                      const score = metrics.productivityScore;
                      const label = score >= 90 ? 'Excelente' : score >= 70 ? 'Bueno' : score >= 50 ? 'Regular' : score >= 30 ? 'Bajo' : 'Crítico';
                      const color = score >= 90 ? '#22c55e' : score >= 70 ? '#84cc16' : score >= 50 ? '#eab308' : score >= 30 ? '#f97316' : '#ef4444';
                      const radius = 40;
                      const circumference = 2 * Math.PI * radius;
                      const offset = circumference - (score / 100) * circumference;
                      const prevSnapshot = scoreSnapshots.length >= 2 ? scoreSnapshots[scoreSnapshots.length - 2] : null;
                      const previousScore = prevSnapshot ? prevSnapshot.score : null;
                      const trendDiff = previousScore !== null ? score - previousScore : null;
                      return (
                        <div className="flex flex-col items-center shrink-0 w-[130px]">
                          <svg width="120" height="120" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
                            <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="7"
                              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                              transform="rotate(-90 60 60)" className="transition-all duration-700" />
                            <text x="60" y="55" textAnchor="middle" dominantBaseline="central" className="fill-foreground font-bold" fontSize="32">{score}</text>
                            <text x="60" y="76" textAnchor="middle" className="fill-muted-foreground" fontSize="10">puntos</text>
                            {trendDiff !== null && (
                              <>
                                {trendDiff > 0 && <text x="60" y="90" textAnchor="middle" fill="#22c55e" fontSize="11">▲ +{trendDiff}</text>}
                                {trendDiff < 0 && <text x="60" y="90" textAnchor="middle" fill="#ef4444" fontSize="11">▼ {trendDiff}</text>}
                                {trendDiff === 0 && <text x="60" y="90" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10">= igual</text>}
                              </>
                            )}
                          </svg>
                          <span className="text-xs font-semibold mt-1" style={{ color }}>{label}</span>
                          {scoreSnapshots.length >= 1 && (
                            <button
                              onClick={() => setShowTrend(true)}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-1.5"
                            >
                              <BarChart3 className="h-3 w-3" /> Ver tendencia
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Progress bars */}
                    <div className="flex-1 space-y-3 min-w-0">
                      <span className="text-sm font-semibold text-foreground">Rendimiento</span>
                      {renderMetricItems()}

                      {metrics.allSubtasks.length > 0 && (
                        <div className="border-t border-border pt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Subtareas completadas</span>
                            <span className={cn(
                              "text-xs font-bold",
                              metrics.subtaskProgress >= 80 ? "text-green-600" : metrics.subtaskProgress >= 50 ? "text-yellow-600" : "text-destructive"
                            )}>{metrics.subtaskProgress}%</span>
                          </div>
                          <Progress value={metrics.subtaskProgress} className="h-1.5 mt-1" />
                          <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                            <span>{metrics.completedSubtasks.length}/{metrics.allSubtasks.length} completadas</span>
                            {metrics.pendingOverdueSubtasks > 0 && <span>Atrasadas: <strong className="text-destructive">{metrics.pendingOverdueSubtasks}</strong></span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trend Dialog */}
              <Dialog open={showTrend} onOpenChange={setShowTrend}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Tendencia de productividad — {assigneeName}</DialogTitle>
                  </DialogHeader>
                  {scoreSnapshots.length >= 2 ? (
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={scoreSnapshots}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip
                            contentStyle={{ fontSize: 12, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                            formatter={(value: number) => [`${value} pts`, 'Score']}
                          />
                          <ReferenceLine y={70} stroke="#84cc16" strokeDasharray="3 3" label={{ value: 'Bueno', fontSize: 9, fill: '#84cc16' }} />
                          <Line type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">Se necesitan al menos 2 semanas de datos para mostrar la tendencia.</p>
                  )}
                </DialogContent>
              </Dialog>

              {/* Overdue / Due soon cards */}
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

              {/* Priorities */}
              <Card>
                <CardHeader className="pb-1 p-3">
                  <CardTitle className="text-xs font-medium flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" /> Prioridades
                    <div className="flex gap-1 ml-1">
                      {metrics.alta.length > 0 && <Badge variant="destructive" className="text-[9px] h-4">{metrics.alta.length} alta</Badge>}
                      {metrics.media.length > 0 && <Badge variant="outline" className="text-[9px] h-4 border-yellow-500/50 text-yellow-600">{metrics.media.length} media</Badge>}
                      {metrics.baja.length > 0 && <Badge variant="outline" className="text-[9px] h-4 border-green-500/50 text-green-600">{metrics.baja.length} baja</Badge>}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
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
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== TAB: TEMAS ===== */}
            <TabsContent value="temas" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-1 p-3">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                    <ListChecks className="h-3.5 w-3.5 text-muted-foreground" /> Todos los temas ({metrics.assigneeTopics.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="hidden sm:block max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Tema</TableHead>
                          <TableHead className="text-xs text-center">Prioridad</TableHead>
                          <TableHead className="text-xs text-center">Estado</TableHead>
                          <TableHead className="text-xs text-center">Vencimiento</TableHead>
                          <TableHead className="text-xs text-center">Subtareas</TableHead>
                          <TableHead className="text-xs text-center">🔄</TableHead>
                          <TableHead className="text-xs text-center w-10">📧</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics.assigneeTopics.map(t => {
                          const pending = t.subtasks.filter(s => !s.completed).length;
                          const isOverdue = isStoredDateOverdue(t.due_date);
                          const topicReschedules = assigneeReschedules.filter(r => r.topic_id === t.id);
                          return (
                            <TableRow key={t.id} className={`${isOverdue ? 'bg-destructive/5' : ''} ${onNavigateToTopic ? 'cursor-pointer hover:bg-muted/50' : ''}`} onClick={() => onNavigateToTopic?.(t.id, t.status)}>
                              <TableCell className="text-sm font-medium max-w-[200px] truncate text-primary">{t.title}</TableCell>
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
                              <TableCell className="text-xs text-center">
                                {topicReschedules.length > 0 ? (
                                  <Badge variant="outline" className="text-[9px] border-amber-500/50 text-amber-600">
                                    {topicReschedules.length}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <button onClick={(e) => { e.stopPropagation(); handleSendReminder(t); }} disabled={sendingId === t.id || !assignee?.email}
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
                  <div className="sm:hidden space-y-2 max-h-[400px] overflow-auto">
                    {metrics.assigneeTopics.map(t => {
                      const pending = t.subtasks.filter(s => !s.completed).length;
                      const isOverdue = isStoredDateOverdue(t.due_date);
                      const topicReschedules = assigneeReschedules.filter(r => r.topic_id === t.id);
                      return (
                        <div key={t.id} className={`rounded-md border p-2.5 space-y-1 ${isOverdue ? 'border-destructive/30 bg-destructive/5' : 'border-border'} ${onNavigateToTopic ? 'cursor-pointer hover:bg-muted/50' : ''}`} onClick={() => onNavigateToTopic?.(t.id, t.status)}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium truncate flex-1 text-primary">{t.title}</span>
                            <button onClick={(e) => { e.stopPropagation(); handleSendReminder(t); }} disabled={sendingId === t.id || !assignee?.email}
                              className="p-1 rounded-full hover:bg-muted transition-colors disabled:opacity-30">
                              {sendingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3 text-muted-foreground" />}
                            </button>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant={t.priority === 'alta' ? 'destructive' : 'outline'} className="text-[9px]">{t.priority}</Badge>
                            <Badge variant="outline" className="text-[9px]">{t.status}</Badge>
                            {t.due_date && <Badge variant={isOverdue ? 'destructive' : 'outline'} className="text-[9px]">{t.due_date}</Badge>}
                            {pending > 0 && <Badge variant="outline" className="text-[9px] text-destructive">{pending} pend.</Badge>}
                            {topicReschedules.length > 0 && <Badge variant="outline" className="text-[9px] border-amber-500/50 text-amber-600">🔄 {topicReschedules.length}</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Reprogramaciones stats + history */}
              {assigneeReschedules.length > 0 && (() => {
                const assigneeRescheduleStats = computeGlobalRescheduleStats(
                  topics.filter(t => t.assignee === assigneeName),
                  assigneeReschedules,
                );
                return (
                <Card>
                  <CardHeader className="pb-1 p-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" /> Reprogramaciones ({assigneeReschedules.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {/* Stats row */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3 p-2 bg-muted/30 rounded-lg">
                      <div className="text-center">
                        <div className="text-lg font-bold text-foreground">{assigneeReschedules.length}</div>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-600">{assigneeReschedules.filter(r => !r.is_external).length}</div>
                        <p className="text-[10px] text-muted-foreground">Internas</p>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{assigneeReschedules.filter(r => r.is_external).length}</div>
                        <p className="text-[10px] text-muted-foreground">Externas</p>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-foreground">{assigneeRescheduleStats.avgReschedulesPerTopic}x</div>
                        <p className="text-[10px] text-muted-foreground">Prom/tema</p>
                      </div>
                      <div className="text-center">
                        <div className={cn("text-lg font-bold", assigneeRescheduleStats.avgOvertimePct > 30 ? "text-destructive" : assigneeRescheduleStats.avgOvertimePct > 0 ? "text-amber-600" : "text-foreground")}>+{assigneeRescheduleStats.avgOvertimePct}%</div>
                        <p className="text-[10px] text-muted-foreground">Sobretiempo</p>
                      </div>
                    </div>
                    {/* History list */}
                    <div className="space-y-1.5 max-h-[250px] overflow-auto">
                      {assigneeReschedules.map((r) => {
                        const t = topics.find(t2 => t2.id === r.topic_id);
                        return (
                          <div key={r.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-border last:border-0">
                            <span className="truncate flex-1 font-medium">{t?.title || '—'}</span>
                            <span className="text-muted-foreground font-mono shrink-0">
                              {r.previous_date || '—'} → {r.new_date || '—'}
                            </span>
                            {r.is_external && <Badge variant="outline" className="text-[8px] border-blue-500/50 text-blue-600 shrink-0">Ext.</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                );
              })()}
            </TabsContent>

            {/* ===== TAB: CORREOS ===== */}
            <TabsContent value="correos" className="space-y-4 mt-4">
              <Card>
                <CardContent className="p-3">
                  {emailHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No se han enviado correos a {assigneeName}</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 mb-3 text-xs">
                        <span className="text-muted-foreground">Enviados: <strong className="text-foreground">{metrics.emailsSent}</strong></span>
                        <span className="text-muted-foreground">Confirmados: <strong className="text-green-600">{metrics.emailsConfirmed}</strong></span>
                        <span className="text-muted-foreground">
                          Tasa: <strong className={metrics.responseRate >= 80 ? 'text-green-600' : metrics.responseRate >= 50 ? 'text-yellow-600' : 'text-destructive'}>{metrics.responseRate}%</strong>
                        </span>
                      </div>
                      <div className="hidden sm:block max-h-[500px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Tema</TableHead>
                              <TableHead className="text-xs text-center">Enviado</TableHead>
                              <TableHead className="text-xs text-center">Confirmado</TableHead>
                              <TableHead className="text-xs text-center">Plazo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {emailHistory.map((e: any) => {
                              const onTime = e.confirmed && e.confirmed_at
                                ? new Date(e.confirmed_at).getTime() <= new Date(e.sent_at).getTime() + DEADLINE_HOURS * 60 * 60 * 1000
                                : null;
                              return (
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
                                  <TableCell className="text-center">
                                    {onTime !== null ? (
                                      <Badge variant={onTime ? 'secondary' : 'destructive'} className="text-[9px]">
                                        {onTime ? 'A tiempo' : 'Fuera de plazo'}
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="sm:hidden space-y-1.5 max-h-[500px] overflow-auto">
                        {emailHistory.map((e: any) => {
                          const onTime = e.confirmed && e.confirmed_at
                            ? new Date(e.confirmed_at).getTime() <= new Date(e.sent_at).getTime() + DEADLINE_HOURS * 60 * 60 * 1000
                            : null;
                          return (
                            <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{e.topics?.title || e.topic_id}</p>
                                <p className="text-[10px] text-muted-foreground">{format(new Date(e.sent_at), 'dd MMM HH:mm', { locale: es })}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {e.confirmed ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <span className="text-[10px] text-muted-foreground">—</span>}
                                {onTime !== null && (
                                  <Badge variant={onTime ? 'secondary' : 'destructive'} className="text-[8px]">
                                    {onTime ? 'A tiempo' : 'Tarde'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== TAB: INCIDENCIAS ===== */}
            <TabsContent value="incidencias" className="space-y-4 mt-4">
              <Card>
                <CardContent className="p-3 space-y-3">
                  <Button size="sm" onClick={() => setShowIncidentForm(true)} className="w-full">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Registrar incidencia
                  </Button>

                  {/* Form Dialog */}
                  <Dialog open={showIncidentForm} onOpenChange={setShowIncidentForm}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Registrar Incidencia — {assigneeName}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!incidentForm.title.trim()) return;
                        try {
                          await createIncident.mutateAsync({
                            assignee_name: assigneeName,
                            assignee_email: assignee?.email || '',
                            category: incidentForm.category,
                            title: incidentForm.title,
                            description: incidentForm.description,
                            incident_date: incidentForm.incident_date,
                          });
                          toast.success('Incidencia registrada');
                          setIncidentForm({ title: '', description: '', category: 'leve', incident_date: new Date().toISOString().split('T')[0] });
                          setShowIncidentForm(false);
                        } catch { toast.error('Error al registrar'); }
                      }} className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                          <Input type="date" value={incidentForm.incident_date} onChange={e => setIncidentForm(f => ({ ...f, incident_date: e.target.value }))} className="mt-1" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Severidad</label>
                          <Select value={incidentForm.category} onValueChange={(v: 'leve' | 'moderada' | 'grave') => setIncidentForm(f => ({ ...f, category: v }))}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="leve">🟡 Leve — Observación menor</SelectItem>
                              <SelectItem value="moderada">🟠 Moderada — Requiere atención</SelectItem>
                              <SelectItem value="grave">🔴 Grave — Incumplimiento serio</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Título</label>
                          <Input value={incidentForm.title} onChange={e => setIncidentForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Atraso reiterado" className="mt-1" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Descripción</label>
                          <Textarea value={incidentForm.description} onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalle de lo ocurrido..." rows={3} className="mt-1" />
                        </div>
                        <Button type="submit" className="w-full" disabled={createIncident.isPending}>
                          {createIncident.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {/* Incidents list */}
                  {incidents.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Sin incidencias registradas</p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-auto">
                      {incidents.map((inc) => {
                        const categoryConfig = {
                          leve: { color: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20', label: 'Leve', emoji: '🟡' },
                          moderada: { color: 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20', label: 'Moderada', emoji: '🟠' },
                          grave: { color: 'border-l-red-500 bg-red-50 dark:bg-red-950/20', label: 'Grave', emoji: '🔴' },
                        };
                        const cfg = categoryConfig[inc.category] || categoryConfig.leve;
                        return (
                          <div key={inc.id} className={cn("border-l-4 rounded-md p-3 space-y-1.5", cfg.color)}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs">{cfg.emoji}</span>
                                  <span className="text-xs font-semibold">{inc.title}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {format(new Date(inc.incident_date + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {inc.category === 'grave' && !inc.email_sent && assignee?.email && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-6 text-[10px] px-2"
                                    disabled={sendingIncidentEmail === inc.id}
                                    onClick={async () => {
                                      setSendingIncidentEmail(inc.id);
                                      try {
                                        const { error } = await supabase.functions.invoke('send-incident-notification', {
                                          body: {
                                            to_email: assignee.email,
                                            to_name: assigneeName,
                                            incident_title: inc.title,
                                            incident_description: inc.description,
                                            incident_date: inc.incident_date,
                                            category: inc.category,
                                          },
                                        });
                                        if (error) throw error;
                                        await markEmailSent.mutateAsync(inc.id);
                                        toast.success('Notificación formal enviada');
                                      } catch { toast.error('Error al enviar correo'); }
                                      setSendingIncidentEmail(null);
                                    }}
                                  >
                                    {sendingIncidentEmail === inc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Send className="h-3 w-3 mr-0.5" /> Notificar</>}
                                  </Button>
                                )}
                                {inc.email_sent && (
                                  <Badge variant="secondary" className="text-[9px] h-5">
                                    <Mail className="h-3 w-3 mr-0.5" /> Notificado
                                  </Badge>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Eliminar incidencia?</AlertDialogTitle>
                                      <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteIncident.mutate(inc.id)}>Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                            {inc.description && (
                              <p className="text-xs text-muted-foreground">{inc.description}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
