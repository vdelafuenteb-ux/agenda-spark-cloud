import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TopicCard } from '@/components/TopicCard';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import type { Tag } from '@/hooks/useTags';
import { isStoredDateToday, isStoredDateOverdue, isStoredDateUpcoming } from '@/lib/date';

type ReviewTab = 'hoy' | 'atrasados' | 'proximos';

interface ReviewViewProps {
  topics: TopicWithSubtasks[];
  allTags: Tag[];
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
  const { topics, allTags, getTagsForTopic, ...handlers } = props;
  const [tab, setTab] = useState<ReviewTab>('hoy');

  const activeTopics = topics.filter(t => t.status === 'activo');

  const todayTopics = activeTopics.filter(t => {
    const topicDueToday = isStoredDateToday(t.due_date);
    const hasSubtaskDueToday = t.subtasks.some(s => isStoredDateToday(s.due_date));
    return topicDueToday || hasSubtaskDueToday;
  });

  const overdueTopics = activeTopics.filter(t => isStoredDateOverdue(t.due_date));

  const upcomingTopics = activeTopics.filter(t => isStoredDateUpcoming(t.due_date, 3));

  const currentTopics = tab === 'hoy' ? todayTopics : tab === 'atrasados' ? overdueTopics : upcomingTopics;

  const emptyMessages: Record<ReviewTab, string> = {
    hoy: 'No hay temas programados para hoy.',
    atrasados: '¡Todo al día! No hay temas atrasados.',
    proximos: 'No hay temas próximos a vencer.',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as ReviewTab)}>
        <TabsList className="w-full">
          <TabsTrigger value="hoy" className="flex-1 text-xs gap-1.5">
            Mi día
            {todayTopics.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">{todayTopics.length}</Badge>
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
            {upcomingTopics.length > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-yellow-500 text-white border-0 hover:bg-yellow-500/80">{upcomingTopics.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {currentTopics.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{emptyMessages[tab]}</p>
      ) : (
        currentTopics.map((topic) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            allTags={allTags}
            topicTags={getTagsForTopic(topic.id)}
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
