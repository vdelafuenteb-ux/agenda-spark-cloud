import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle } from 'lucide-react';
import { TopicCard } from '@/components/TopicCard';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Tag } from '@/hooks/useTags';
import type { Assignee } from '@/hooks/useAssignees';
import { useReminders } from '@/hooks/useReminders';
import { useReminderCompletions } from '@/hooks/useReminderCompletions';
import { getRemindersForDate, getUpcomingReminders } from '@/lib/reminderMatch';
import { isStoredDateToday, isStoredDateOverdue, isStoredDateUpcoming } from '@/lib/date';

type ReviewTab = 'hoy' | 'atrasados' | 'proximos';

interface ReviewViewProps {
  topics: TopicWithSubtasks[];
  allTags: Tag[];
  assignees: Assignee[];
  onCreateAssignee: (name: string) => Promise<Assignee>;
  getTagsForTopic: (id: string) => Tag[];
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (topicId: string, title: string) => void;
  onToggleSubtask: (id: string, completed: boolean) => void;
  onDeleteSubtask: (id: string) => void;
  onUpdateSubtask: (id: string, data: any) => void;
  onAddProgressEntry: (topicId: string, content: string) => void;
  onAddTag: (topicId: string, tagId: string) => void;
  onRemoveTag: (topicId: string, tagId: string) => void;
  onCreateTag: (name: string, color: string) => Promise<any>;
}

export function ReviewView(props: ReviewViewProps) {
  const { topics, allTags, assignees, onCreateAssignee, getTagsForTopic, ...handlers } = props;
  const [tab, setTab] = useState<ReviewTab>('hoy');
  const { reminders } = useReminders();
  const { isCompleted, toggleCompletion } = useReminderCompletions();

  const activeTopics = topics.filter(t => t.status === 'activo' || t.status === 'seguimiento');

  const todayTopics = activeTopics.filter(t => {
    const topicDueToday = isStoredDateToday(t.due_date);
    const hasSubtaskDueToday = t.subtasks.some(s => isStoredDateToday(s.due_date));
    return topicDueToday || hasSubtaskDueToday;
  });

  const todayReminders = useMemo(() => getRemindersForDate(reminders, new Date()), [reminders]);
  const todayDateStr = format(new Date(), 'yyyy-MM-dd');

  const overdueTopics = activeTopics.filter(t => {
    const topicOverdue = isStoredDateOverdue(t.due_date);
    const hasSubtaskOverdue = t.subtasks.some(s => !s.completed && isStoredDateOverdue(s.due_date));
    return topicOverdue || hasSubtaskOverdue;
  });

  const upcomingTopics = activeTopics.filter(t => {
    const topicUpcoming = isStoredDateUpcoming(t.due_date, 3);
    const hasSubtaskUpcoming = t.subtasks.some(s => !s.completed && isStoredDateUpcoming(s.due_date, 3));
    return topicUpcoming || hasSubtaskUpcoming;
  });

  const upcomingReminders = useMemo(() => getUpcomingReminders(reminders, 3), [reminders]);

  const currentTopics = tab === 'hoy' ? todayTopics : tab === 'atrasados' ? overdueTopics : upcomingTopics;
  const todayTotalCount = todayTopics.length + todayReminders.length;
  const upcomingTotalCount = upcomingTopics.length + upcomingReminders.length;

  const emptyMessages: Record<ReviewTab, string> = {
    hoy: 'No hay temas programados para hoy.',
    atrasados: '¡Todo al día! No hay temas atrasados.',
    proximos: 'No hay temas próximos a vencer.',
  };

  const handleToggleCompletion = (reminderId: string) => {
    toggleCompletion.mutate({ reminder_id: reminderId, completed_date: todayDateStr });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as ReviewTab)}>
        <TabsList className="w-full">
          <TabsTrigger value="hoy" className="flex-1 text-xs gap-1.5">
            Mi día
            {todayTotalCount > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">{todayTotalCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="atrasados" className="flex-1 text-xs gap-1.5">
            Atrasados
            {overdueTopics.length > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">{overdueTopics.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="proximos" className="flex-1 text-xs gap-1.5">
            Próximos
            {upcomingTotalCount > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-yellow-500 text-white border-0 hover:bg-yellow-500/80">{upcomingTotalCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Today's reminders */}
      {tab === 'hoy' && todayReminders.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Recordatorios de hoy</p>
          {todayReminders.map((r) => {
            const done = isCompleted(r.id, todayDateStr);
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-2.5 bg-background"
              >
                <button
                  onClick={() => handleToggleCompletion(r.id)}
                  className="shrink-0 hover:scale-110 transition-transform"
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <span className={`text-sm font-medium flex-1 ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {r.title}
                </span>
                <Badge variant="outline" className="text-[9px] h-4 shrink-0">Recordatorio</Badge>
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming reminders */}
      {tab === 'proximos' && upcomingReminders.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Recordatorios próximos</p>
          {upcomingReminders.map(({ reminder: r, date }) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const done = isCompleted(r.id, dateStr);
            return (
              <div
                key={`${r.id}-${dateStr}`}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-2.5 bg-yellow-500/5"
              >
                <button
                  onClick={() => toggleCompletion.mutate({ reminder_id: r.id, completed_date: dateStr })}
                  className="shrink-0 hover:scale-110 transition-transform"
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <span className={`text-sm font-medium flex-1 ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {r.title}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {format(date, "EEE d MMM", { locale: es })}
                </span>
                <Badge className="text-[9px] h-4 shrink-0 bg-yellow-500/20 text-yellow-700 border-0">Recordatorio</Badge>
              </div>
            );
          })}
        </div>
      )}

      {currentTopics.length === 0 && (tab === 'hoy' ? todayReminders.length === 0 : tab === 'proximos' ? upcomingReminders.length === 0 : true) ? (
        <p className="text-sm text-muted-foreground text-center py-8">{emptyMessages[tab]}</p>
      ) : (
        currentTopics.map((topic) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            allTags={allTags}
            topicTags={getTagsForTopic(topic.id)}
            assignees={assignees}
            onCreateAssignee={onCreateAssignee}
            highlightToday={tab === 'hoy'}
            highlightUpcoming={tab === 'proximos'}
            highlightOverdue={tab === 'atrasados'}
            onUpdate={handlers.onUpdate}
            onDelete={handlers.onDelete}
            onAddSubtask={handlers.onAddSubtask}
            onToggleSubtask={handlers.onToggleSubtask}
            onDeleteSubtask={handlers.onDeleteSubtask}
            onUpdateSubtask={handlers.onUpdateSubtask}
            onAddProgressEntry={handlers.onAddProgressEntry}
            onAddTag={handlers.onAddTag}
            onRemoveTag={handlers.onRemoveTag}
            onCreateTag={handlers.onCreateTag}
          />
        ))
      )}
    </div>
  );
}