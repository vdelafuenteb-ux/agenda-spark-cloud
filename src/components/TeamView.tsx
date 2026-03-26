import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Trophy, Target, Zap, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useDepartments } from '@/hooks/useDepartments';
import { supabase } from '@/integrations/supabase/client';
import { isStoredDateOverdue } from '@/lib/date';
import { AssigneeProfileView } from '@/components/AssigneeProfileView';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Assignee } from '@/hooks/useAssignees';

interface TeamViewProps {
  topics: TopicWithSubtasks[];
  assignees: Assignee[];
  onUpdateTopic?: (id: string, data: any) => void;
}

const DEADLINE_HOURS = 48;

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

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-destructive';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'stroke-emerald-500';
  if (score >= 60) return 'stroke-yellow-500';
  return 'stroke-destructive';
}

function getLoadColor(pct: number): string {
  if (pct < 70) return 'text-emerald-600 dark:text-emerald-400';
  if (pct < 90) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-destructive';
}

function MiniScoreCircle({ score }: { score: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(score, 100) / 100) * circumference;
  return (
    <svg width="44" height="44" className="shrink-0">
      <circle cx="22" cy="22" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
      <circle
        cx="22" cy="22" r={radius} fill="none"
        className={getScoreBg(score)}
        strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="24" textAnchor="middle" className={cn('text-xs font-bold fill-current', getScoreColor(score))}>{score}</text>
    </svg>
  );
}

interface AssigneeScore {
  assignee: Assignee;
  score: number | null;
  closureRate: number | null;
  subtaskRate: number | null;
  emailRate: number | null;
  velocityScore: number | null;
  avgPctUsed: number | null;
  deadlineCompliance: number | null;
  activeCount: number;
  totalTopics: number;
  weeklyHours: number;
  capacity: number;
  loadPct: number;
}

function calculateAssigneeScore(
  assigneeName: string,
  allTopics: TopicWithSubtasks[],
  emailHistory: any[]
): Omit<AssigneeScore, 'assignee' | 'weeklyHours' | 'capacity' | 'loadPct'> {
  const assigneeTopics = allTopics.filter(t => t.assignee === assigneeName);
  const active = assigneeTopics.filter(t => t.status === 'activo');
  const seguimiento = assigneeTopics.filter(t => t.status === 'seguimiento');
  const completed = assigneeTopics.filter(t => t.status === 'completado');
  const activeAndTracking = [...active, ...seguimiento];

  // Closure compliance
  const closedWithDates = completed.filter(t => t.due_date && t.closed_at);
  let closureOnTime = 0;
  for (const t of closedWithDates) {
    const closedDate = new Date(t.closed_at!);
    const dueDate = new Date(t.due_date! + 'T23:59:59');
    if (closedDate.getTime() <= dueDate.getTime()) closureOnTime++;
  }
  const closureRate = closedWithDates.length > 0 ? Math.round((closureOnTime / closedWithDates.length) * 100) : null;

  // Subtask timeliness
  const allSubtasks = assigneeTopics.flatMap(t => t.subtasks);
  const completedWithDue = allSubtasks.filter(s => s.completed && s.due_date && s.completed_at);
  const subtasksOnTime = completedWithDue.filter(s => {
    const dueDate = new Date(s.due_date! + 'T23:59:59');
    const completedDate = new Date(s.completed_at!);
    return completedDate.getTime() <= dueDate.getTime();
  });
  const subtaskRate = completedWithDue.length > 0 ? Math.round((subtasksOnTime.length / completedWithDue.length) * 100) : null;

  // Email compliance
  const assigneeEmails = emailHistory.filter((e: any) => e.assignee_name === assigneeName);
  const confirmedEmails = assigneeEmails.filter((e: any) => e.confirmed && e.confirmed_at);
  const onTimeEmails = confirmedEmails.filter((e: any) => {
    const deadlineTime = new Date(e.sent_at).getTime() + DEADLINE_HOURS * 60 * 60 * 1000;
    return new Date(e.confirmed_at).getTime() <= deadlineTime;
  });
  const emailRate = confirmedEmails.length > 0 ? Math.round((onTimeEmails.length / confirmedEmails.length) * 100) : null;

  // Velocity
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
      return Math.min(Math.round(((closed - start) / totalTime) * 100), 150);
    });
    avgPctUsed = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    velocityScore = Math.max(0, Math.min(100, Math.round(100 - (avgPctUsed - 50) * (100 / 100))));
  }

  // Deadline compliance
  const activeWithDue = activeAndTracking.filter(t => t.due_date && !t.is_ongoing);
  const activeOnTime = activeWithDue.filter(t => !isStoredDateOverdue(t.due_date));
  const deadlineCompliance = activeWithDue.length > 0 ? Math.round((activeOnTime.length / activeWithDue.length) * 100) : null;

  // Weighted score
  const dimensions: { value: number; weight: number }[] = [];
  if (closedWithDates.length > 0) dimensions.push({ value: closureRate ?? 0, weight: 0.50 });
  if (completedWithDue.length > 0) dimensions.push({ value: subtaskRate ?? 0, weight: 0.20 });
  if (confirmedEmails.length > 0) dimensions.push({ value: emailRate ?? 0, weight: 0.10 });
  if (deadlineCompliance !== null) dimensions.push({ value: deadlineCompliance, weight: 0.10 });
  if (velocityScore !== null) dimensions.push({ value: velocityScore, weight: 0.10 });

  let score: number | null = null;
  if (dimensions.length > 0) {
    const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
    score = Math.round(dimensions.reduce((s, d) => s + d.value * (d.weight / totalWeight), 0));
  }

  return {
    score,
    closureRate,
    subtaskRate,
    emailRate,
    velocityScore,
    avgPctUsed,
    deadlineCompliance,
    activeCount: activeAndTracking.length,
    totalTopics: assigneeTopics.filter(t => t.status !== 'completado').length,
  };
}

export function TeamView({ topics, assignees, onUpdateTopic }: TeamViewProps) {
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const { departments } = useDepartments();

  // Fetch all notification emails for score calculation
  const { data: allEmails = [] } = useQuery({
    queryKey: ['notification_emails_team'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_emails')
        .select('assignee_name, sent_at, confirmed, confirmed_at')
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const activeTopics = useMemo(() =>
    topics.filter(t => t.status === 'activo' || t.status === 'seguimiento'),
    [topics]
  );

  // Department KPIs
  const deptMetrics = useMemo(() => {
    return departments.map(dept => {
      const deptTopics = activeTopics.filter(t => t.department_id === dept.id);
      const deptAssignees = new Set(deptTopics.map(t => t.assignee).filter(Boolean));
      // Avg score of assignees in this dept
      const scores: number[] = [];
      deptAssignees.forEach(name => {
        if (!name) return;
        const s = calculateAssigneeScore(name, topics, allEmails);
        if (s.score !== null) scores.push(s.score);
      });
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      return { dept, activeCount: deptTopics.length, avgScore, assigneeCount: deptAssignees.size };
    }).filter(d => d.activeCount > 0 || d.assigneeCount > 0);
  }, [departments, activeTopics, topics, allEmails]);

  const rankedAssignees = useMemo(() => {
    const results: AssigneeScore[] = assignees.map(a => {
      const myActiveTopics = activeTopics.filter(t => t.assignee === a.name);
      const weeklyHours = myActiveTopics.reduce((sum, t) => sum + getWeeklyHours(t), 0);
      const capacity = a.weekly_capacity || 45;
      const loadPct = capacity > 0 ? Math.round((weeklyHours / capacity) * 100) : 0;
      const scoreData = calculateAssigneeScore(a.name, topics, allEmails);
      return {
        assignee: a,
        ...scoreData,
        weeklyHours: Math.round(weeklyHours * 10) / 10,
        capacity,
        loadPct,
      };
    });

    // Sort by score desc (null scores last), then by name
    return results.sort((a, b) => {
      if (a.score === null && b.score === null) return a.assignee.name.localeCompare(b.assignee.name);
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });
  }, [assignees, activeTopics, topics, allEmails]);

  // Determine KPI distinctions (only for assignees with scores)
  const distinctions = useMemo(() => {
    const withScores = rankedAssignees.filter(r => r.score !== null);
    if (withScores.length === 0) return {};

    const best: Record<string, string> = {};

    // Mejor cerrador
    const withClosure = withScores.filter(r => r.closureRate !== null);
    if (withClosure.length > 0) {
      const top = withClosure.reduce((a, b) => (a.closureRate! >= b.closureRate! ? a : b));
      if (top.closureRate! > 0) best[top.assignee.name] = (best[top.assignee.name] || '') + '|cerrador';
    }

    // Más rápido (velocity)
    const withVelocity = withScores.filter(r => r.velocityScore !== null);
    if (withVelocity.length > 0) {
      const top = withVelocity.reduce((a, b) => (a.velocityScore! >= b.velocityScore! ? a : b));
      if (top.velocityScore! > 0) best[top.assignee.name] = (best[top.assignee.name] || '') + '|rapido';
    }

    // Mejor respuesta
    const withEmail = withScores.filter(r => r.emailRate !== null);
    if (withEmail.length > 0) {
      const top = withEmail.reduce((a, b) => (a.emailRate! >= b.emailRate! ? a : b));
      if (top.emailRate! > 0) best[top.assignee.name] = (best[top.assignee.name] || '') + '|respuesta';
    }

    // Más productivo
    if (withScores.length > 0) {
      const top = withScores[0]; // already sorted by score desc
      best[top.assignee.name] = (best[top.assignee.name] || '') + '|productivo';
    }

    return best;
  }, [rankedAssignees]);

  // Global KPIs
  const totalWeeklyHours = rankedAssignees.reduce((s, m) => s + m.weeklyHours, 0);

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

  const badgeMap: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    productivo: { label: 'Más productivo', icon: <Trophy className="h-3 w-3" />, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300/50' },
    cerrador: { label: 'Mejor cerrador', icon: <Target className="h-3 w-3" />, className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300/50' },
    rapido: { label: 'Más rápido', icon: <Zap className="h-3 w-3" />, className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300/50' },
    respuesta: { label: 'Mejor respuesta', icon: <Mail className="h-3 w-3" />, className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300/50' },
  };

  return (
    <main className="flex-1 overflow-auto p-3 md:p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* KPIs por departamento */}
        {deptMetrics.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {deptMetrics.map(d => (
              <Card key={d.dept.id}>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground truncate">{d.dept.name}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">{d.activeCount}</p>
                    <span className="text-[10px] text-muted-foreground">temas</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{d.assigneeCount} persona{d.assigneeCount !== 1 ? 's' : ''}</span>
                    {d.avgScore !== null ? (
                      <span className={cn('text-xs font-semibold', getScoreColor(d.avgScore))}>
                        Score: {d.avgScore}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">Score: n/a</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Equipo</span>
                </div>
                <p className="text-2xl font-bold">{assignees.length}</p>
                <p className="text-[10px] text-muted-foreground">Sin departamentos configurados</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ranking */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Ranking de Equipo</h2>
          {rankedAssignees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay responsables creados. Agrega responsables en Configuración.</p>
          ) : (
            <div className="space-y-2">
              {rankedAssignees.map((m, idx) => {
                const rank = idx + 1;
                const assigneeDistinctions = (distinctions[m.assignee.name] || '').split('|').filter(Boolean);

                return (
                  <Card
                    key={m.assignee.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedAssignee(m.assignee.name)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {/* Rank */}
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                          rank === 1 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400' :
                          rank === 2 ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' :
                          rank === 3 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {rank}
                        </div>

                        {/* Score circle */}
                        {m.score !== null ? (
                          <MiniScoreCircle score={m.score} />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <span className="text-[10px] text-muted-foreground">S/D</span>
                          </div>
                        )}

                        {/* Name + stats */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{m.assignee.name}</p>
                            {assigneeDistinctions.map(d => {
                              const badge = badgeMap[d];
                              if (!badge) return null;
                              return (
                                <span key={d} className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border', badge.className)}>
                                  {badge.icon}
                                  {badge.label}
                                </span>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                            <span>{m.activeCount} activos</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span>{m.weeklyHours}h / {m.capacity}h</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className={getLoadColor(m.loadPct)}>Carga {m.loadPct}%</span>
                          </div>
                          {/* Metrics row - always show all 5 */}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">
                              Cierre: {m.closureRate !== null
                                ? <span className={cn('font-medium', m.closureRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : m.closureRate >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive')}>{m.closureRate}%</span>
                                : <span className="font-medium text-muted-foreground/50">n/a</span>}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Subtareas: {m.subtaskRate !== null
                                ? <span className={cn('font-medium', m.subtaskRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : m.subtaskRate >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive')}>{m.subtaskRate}%</span>
                                : <span className="font-medium text-muted-foreground/50">n/a</span>}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Velocidad: {m.velocityScore !== null
                                ? <span className={cn('font-medium', m.velocityScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : m.velocityScore >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive')}>{m.avgPctUsed}%</span>
                                : <span className="font-medium text-muted-foreground/50">n/a</span>}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Correos: {m.emailRate !== null
                                ? <span className={cn('font-medium', m.emailRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : m.emailRate >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive')}>{m.emailRate}%</span>
                                : <span className="font-medium text-muted-foreground/50">n/a</span>}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Plazos: {m.deadlineCompliance !== null
                                ? <span className={cn('font-medium', m.deadlineCompliance >= 80 ? 'text-emerald-600 dark:text-emerald-400' : m.deadlineCompliance >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive')}>{m.deadlineCompliance}%</span>
                                : <span className="font-medium text-muted-foreground/50">n/a</span>}
                            </span>
                          </div>
                        </div>

                        {/* Overload badge */}
                        <div className="shrink-0">
                          {m.loadPct >= 90 && (
                            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Sobrecargado</Badge>
                          )}
                          {m.loadPct >= 70 && m.loadPct < 90 && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-yellow-500/50 text-yellow-600">Carga alta</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Temas sin asignar con HH */}
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
