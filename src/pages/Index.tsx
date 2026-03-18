import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { TopicCard } from '@/components/TopicCard';
import { ReportModal } from '@/components/ReportModal';
import { ReportsList } from '@/components/ReportsList';
import { FilterBar } from '@/components/FilterBar';
import { CreateTopicModal } from '@/components/CreateTopicModal';
import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/useAuth';
import { useTopics } from '@/hooks/useTopics';
import { useTags } from '@/hooks/useTags';
import { isStoredDateToday } from '@/lib/date';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, FileText } from 'lucide-react';
import { NotesView } from '@/components/NotesView';
import { toast } from 'sonner';

type Filter = 'todos' | 'hoy' | 'alta' | 'informes' | 'notas';
type StatusTab = 'activo' | 'pausado' | 'completado';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { topics, isLoading, createTopic, updateTopic, deleteTopic, addSubtask, toggleSubtask, deleteSubtask, addProgressEntry, updateSubtask } = useTopics();
  const { tags, getTagsForTopic, createTag, addTopicTag, removeTopicTag } = useTags();
  const [filter, setFilter] = useState<Filter>('todos');
  const [statusTab, setStatusTab] = useState<StatusTab>('activo');
  const [reportOpen, setReportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const filteredTopics = topics.filter((topic) => {
    if (topic.status !== statusTab) return false;

    if (filter === 'hoy') {
      const topicDueToday = isStoredDateToday(topic.due_date);
      const hasSubtaskDueToday = topic.subtasks.some((subtask) => isStoredDateToday(subtask.due_date));
      if (!topicDueToday && !hasSubtaskDueToday) return false;
    }

    if (filter === 'alta' && topic.priority !== 'alta') return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = topic.title.toLowerCase().includes(query);
      const matchesSubtask = topic.subtasks.some((subtask) => subtask.title.toLowerCase().includes(query));
      if (!matchesTitle && !matchesSubtask) return false;
    }

    if (selectedTagIds.length > 0) {
      const topicTagIds = getTagsForTopic(topic.id).map((tag) => tag.id);
      if (!selectedTagIds.some((id) => topicTagIds.includes(id))) return false;
    }

    return true;
  });

  const handleCreateTopic = async (data: {
    title: string;
    priority: any;
    status: any;
    start_date: string | null;
    due_date: string | null;
    subtasks: string[];
    tagIds: string[];
    newTags: { name: string; color: string }[];
    notes: string;
  }) => {
    try {
      const created = await createTopic.mutateAsync({
        title: data.title,
        priority: data.priority,
        status: data.status,
        start_date: data.start_date,
        due_date: data.due_date,
      });

      for (const subtaskTitle of data.subtasks) {
        await addSubtask.mutateAsync({ topic_id: created.id, title: subtaskTitle });
      }

      for (const tagId of data.tagIds) {
        await addTopicTag.mutateAsync({ topic_id: created.id, tag_id: tagId });
      }

      for (const newTag of data.newTags) {
        const createdTag = await createTag.mutateAsync({ name: newTag.name, color: newTag.color });
        await addTopicTag.mutateAsync({ topic_id: created.id, tag_id: createdTag.id });
      }

      if (data.notes.trim()) {
        await addProgressEntry.mutateAsync({ topic_id: created.id, content: data.notes.trim() });
      }

      setCreateOpen(false);
      toast.success('Tema creado');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const statusCounts = {
    activo: topics.filter((topic) => topic.status === 'activo').length,
    pausado: topics.filter((topic) => topic.status === 'pausado').length,
    completado: topics.filter((topic) => topic.status === 'completado').length,
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeFilter={filter} onFilterChange={setFilter} topics={topics} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b border-border px-4 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <h1 className="text-sm font-semibold text-foreground">
                {filter === 'informes' ? 'Informes' : filter === 'alta' ? 'Prioridad Alta' : filter === 'hoy' ? 'Mi Día' : 'Temas'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setReportOpen(true)}>
                <FileText className="h-3 w-3" />
                Informe
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3 w-3" />
                Nuevo Tema
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-3xl mx-auto space-y-3">
              {filter === 'notas' ? (
                <NotesView />
              ) : filter === 'informes' ? (
                <ReportsList />
              ) : (
                <>
                  <Tabs value={statusTab} onValueChange={(value) => setStatusTab(value as StatusTab)}>
                    <TabsList className="w-full">
                      <TabsTrigger value="activo" className="flex-1 text-xs">Activos ({statusCounts.activo})</TabsTrigger>
                      <TabsTrigger value="pausado" className="flex-1 text-xs">Pausados ({statusCounts.pausado})</TabsTrigger>
                      <TabsTrigger value="completado" className="flex-1 text-xs">Cerrados ({statusCounts.completado})</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <FilterBar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    allTags={tags}
                    selectedTagIds={selectedTagIds}
                    onToggleTag={toggleTagFilter}
                  />

                  {isLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Cargando temas...</p>
                  ) : filteredTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchQuery || selectedTagIds.length > 0
                        ? 'No hay temas que coincidan con tu búsqueda.'
                        : statusTab === 'activo'
                          ? 'No hay temas activos.'
                          : statusTab === 'pausado'
                            ? 'No hay temas pausados.'
                            : 'No hay temas cerrados.'}
                    </p>
                  ) : (
                    filteredTopics.map((topic) => (
                      <TopicCard
                        key={topic.id}
                        topic={topic}
                        allTags={tags}
                        topicTags={getTagsForTopic(topic.id)}
                        onUpdate={(id, data) => updateTopic.mutate({ id, ...data })}
                        onDelete={(id) => deleteTopic.mutate(id, { onSuccess: () => toast.success('Tema eliminado') })}
                        onAddSubtask={(topicId, title) => addSubtask.mutate({ topic_id: topicId, title })}
                        onToggleSubtask={(id, completed) => toggleSubtask.mutate({ id, completed })}
                        onDeleteSubtask={(id) => deleteSubtask.mutate(id)}
                        onUpdateSubtask={(id, data) => updateSubtask.mutate({ id, ...data })}
                        onAddProgressEntry={(topicId, content) => addProgressEntry.mutate({ topic_id: topicId, content })}
                        onAddTag={(topicId, tagId) => addTopicTag.mutate({ topic_id: topicId, tag_id: tagId })}
                        onRemoveTag={(topicId, tagId) => removeTopicTag.mutate({ topic_id: topicId, tag_id: tagId })}
                        onCreateTag={(name, color) => createTag.mutateAsync({ name, color })}
                      />
                    ))
                  )}
                </>
              )}
            </div>
          </main>
        </div>

        <ReportModal open={reportOpen} onOpenChange={setReportOpen} topics={topics} />
        <CreateTopicModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          allTags={tags}
          onSubmit={handleCreateTopic}
          isPending={createTopic.isPending}
        />
      </div>
    </SidebarProvider>
  );
};

export default Index;
