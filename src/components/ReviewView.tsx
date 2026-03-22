import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, User, ArrowRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import { useReminders } from '@/hooks/useReminders';
import { useReminderCompletions } from '@/hooks/useReminderCompletions';
import { useChecklist } from '@/hooks/useChecklist';
import { getRemindersForDate, getUpcomingReminders } from '@/lib/reminderMatch';
import { isStoredDateToday, isStoredDateOverdue, isStoredDateUpcoming, formatStoredDate } from '@/lib/date';

type ReviewTab = 'hoy' | 'atrasados' | 'proximos';
type StatusFilter = 'todos' | 'activo' | 'seguimiento';

interface ReviewItem {
  type: 'subtask' | 'topic' | 'reminder' | 'checklist';
  id: string;
  title: string;
  parentTopicTitle?: string;
  assignee?: string;
  priority?: string;
  dueDate?: string | null;
  completed: boolean;
  onToggle: () => void;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  alta: { label: 'Alta', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  media: { label: 'Media', className: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30' },
  baja: { label: 'Baja', className: 'bg-muted text-muted-foreground border-border' },
};

interface ReviewViewProps {
  topics: TopicWithSubtasks[];
  onToggleSubtask: (id: string, completed: boolean) => void;
}

export function ReviewView({ topics, onToggleSubtask }: ReviewViewProps) {
  const [tab, setTab] = useState<ReviewTab>('hoy');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const { reminders } = useReminders();
  const { isCompleted, toggleCompletion } = useReminderCompletions();
  const { items: checklistItems, toggleItem } = useChecklist();

  const handleTabChange = (v: string) => {
    setTab(v as ReviewTab);
    setSelectedAssignee('');
    setStatusFilter('todos');
  };

  const activeTopics = useMemo(() => {
    let filtered = topics.filter(t => t.status === 'activo' || t.status === 'seguimiento');
    if (statusFilter !== 'todos') filtered = filtered.filter(t => t.status === statusFilter);
    if (selectedAssignee) filtered = filtered.filter(t => t.assignee === selectedAssignee);
    return filtered;
  }, [topics, statusFilter, selectedAssignee]);

  const assigneeNames = useMemo(() => {
    const names = new Set<string>();
    topics.filter(t => t.status === 'activo' || t.status === 'seguimiento').forEach(t => {
      if (t.assignee) names.add(t.assignee);
    });
    return Array.from(names).sort();
  }, [topics]);

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const todayReminders = useMemo(() => getRemindersForDate(reminders, new Date()), [reminders]);
  const upcomingReminders = useMemo(() => getUpcomingReminders(reminders, 3), [reminders]);

  const todayChecklist = checklistItems.filter(i => !i.completed && isStoredDateToday(i.due_date));
  const upcomingChecklist = checklistItems.filter(i => !i.completed && isStoredDateUpcoming(i.due_date, 3));
  const overdueChecklist = checklistItems.filter(i => !i.completed && isStoredDateOverdue(i.due_date));

  // Build flat review items per tab
  const buildItems = (
    matchFn: (date: string | null) => boolean,
    includeCompleted: boolean
  ): ReviewItem[] => {
    const items: ReviewItem[] = [];
    activeTopics.forEach(topic => {
      // Check subtasks first
      const matchingSubs = topic.subtasks.filter(s =>
        (includeCompleted || !s.completed) && matchFn(s.due_date)
      );
      matchingSubs.forEach(sub => {
        items.push({
          type: 'subtask',
          id: sub.id,
          title: sub.title,
          parentTopicTitle: topic.title,
          assignee: sub.responsible || topic.assignee || undefined,
          priority: topic.priority,
          dueDate: sub.due_date,
          completed: sub.completed,
          onToggle: () => onToggleSubtask(sub.id, !sub.completed),
        });
      });
      // If no subtasks match but topic itself matches
      if (matchingSubs.length === 0 && matchFn(topic.due_date)) {
        items.push({
          type: 'topic',
          id: topic.id,
          title: topic.title,
          assignee: topic.assignee || undefined,
          priority: topic.priority,
          dueDate: topic.due_date,
          completed: false,
          onToggle: () => {},
        });
      }
    });
    return items;
  };

  const todayItems = buildItems(isStoredDateToday, true);
  const overdueItems = buildItems(d => isStoredDateOverdue(d), false);
  const upcomingItems = buildItems(d => isStoredDateUpcoming(d, 3), false);

  // Reminder items
  const todayReminderItems: ReviewItem[] = todayReminders.map(r => ({
    type: 'reminder' as const,
    id: r.id,
    title: r.title,
    dueDate: todayDateStr,
    completed: isCompleted(r.id, todayDateStr),
    onToggle: () => toggleCompletion.mutate({ reminder_id: r.id, completed_date: todayDateStr }),
  }));

  const upcomingReminderItems: ReviewItem[] = upcomingReminders.map(({ reminder: r, date }) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return {
      type: 'reminder' as const,
      id: `${r.id}-${dateStr}`,
      title: r.title,
      dueDate: dateStr,
      completed: isCompleted(r.id, dateStr),
      onToggle: () => toggleCompletion.mutate({ reminder_id: r.id, completed_date: dateStr }),
    };
  });

  // Checklist items
  const toChecklistItem = (item: typeof checklistItems[0]): ReviewItem => ({
    type: 'checklist',
    id: item.id,
    title: item.title,
    dueDate: item.due_date,
    completed: false,
    onToggle: () => toggleItem.mutate({ id: item.id, completed: true }),
  });

  const allItems: Record<ReviewTab, ReviewItem[]> = {
    hoy: [...todayItems, ...todayReminderItems, ...todayChecklist.map(toChecklistItem)],
    atrasados: [...overdueItems, ...overdueChecklist.map(toChecklistItem)],
    proximos: [...upcomingItems, ...upcomingReminderItems, ...upcomingChecklist.map(toChecklistItem)],
  };

  const currentItems = allItems[tab];
  const counts = {
    hoy: allItems.hoy.length,
    atrasados: allItems.atrasados.length,
    proximos: allItems.proximos.length,
  };

  const emptyMessages: Record<ReviewTab, string> = {
    hoy: 'No hay pendientes para hoy. 🎉',
    atrasados: '¡Todo al día! No hay nada atrasado. ✅',
    proximos: 'No hay pendientes próximos.',
  };

  const typeBadge: Record<string, { label: string; className: string }> = {
    subtask: { label: 'Hito', className: 'bg-primary/10 text-primary border-primary/20' },
    topic: { label: 'Tema', className: 'bg-secondary text-secondary-foreground border-border' },
    reminder: { label: 'Recordatorio', className: 'bg-accent text-accent-foreground border-border' },
    checklist: { label: 'Checklist', className: 'bg-muted text-muted-foreground border-border' },
  };

  return (
    <div className="max-w-5xl mx-auto space-y-3">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="w-full">
          <TabsTrigger value="hoy" className="flex-1 text-xs gap-1.5">
            Mi día
            {counts.hoy > 0 && <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">{counts.hoy}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="atrasados" className="flex-1 text-xs gap-1.5">
            Atrasados
            {counts.atrasados > 0 && <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">{counts.atrasados}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="proximos" className="flex-1 text-xs gap-1.5">
            Próximos
            {counts.proximos > 0 && <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-yellow-500 text-white border-0 hover:bg-yellow-500/80">{counts.proximos}</Badge>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {assigneeNames.length > 0 && (
          <Select value={selectedAssignee || '_all'} onValueChange={(v) => setSelectedAssignee(v === '_all' ? '' : v)}>
            <SelectTrigger className="w-44 h-8 text-xs gap-1">
              <User className="h-3 w-3 shrink-0" />
              <SelectValue placeholder="Responsable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos los responsables</SelectItem>
              {assigneeNames.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-40 h-8 text-xs gap-1">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="activo">Solo Activos</SelectItem>
            <SelectItem value="seguimiento">Solo Seguimiento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Items list */}
      {currentItems.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{emptyMessages[tab]}</p>
      ) : (
        <div className="space-y-1">
          {currentItems.map((item) => {
            const tb = typeBadge[item.type];
            const pc = item.priority ? priorityConfig[item.priority] : null;
            return (
              <div
                key={`${item.type}-${item.id}`}
                className={`flex items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors ${
                  item.completed ? 'bg-muted/50' : tab === 'atrasados' ? 'bg-destructive/5' : tab === 'proximos' ? 'bg-yellow-500/5' : 'bg-background'
                }`}
              >
                <button
                  onClick={item.onToggle}
                  className="shrink-0 hover:scale-110 transition-transform"
                  disabled={item.type === 'topic'}
                >
                  {item.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {item.title}
                  </span>
                  {item.parentTopicTitle && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                      <ArrowRight className="h-2.5 w-2.5" />
                      {item.parentTopicTitle}
                    </span>
                  )}
                </div>

                {item.assignee && (
                  <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                    <User className="h-3 w-3" />
                    {item.assignee}
                  </span>
                )}

                {pc && (
                  <Badge variant="outline" className={`hidden sm:inline-flex text-[9px] h-4 shrink-0 ${pc.className}`}>
                    {pc.label}
                  </Badge>
                )}

                <Badge variant="outline" className={`text-[9px] h-4 shrink-0 ${tb.className}`}>
                  {tb.label}
                </Badge>

                {item.dueDate && (
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                    {formatStoredDate(item.dueDate, "d MMM")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
