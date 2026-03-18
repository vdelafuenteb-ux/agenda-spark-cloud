import { useState, useMemo, useCallback } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { TopicCard } from '@/components/TopicCard';
import { ReportModal } from '@/components/ReportModal';
import { ReportsList } from '@/components/ReportsList';
import { FilterBar } from '@/components/FilterBar';
import { CreateTopicModal } from '@/components/CreateTopicModal';
import { AuthPage } from '@/components/AuthPage';
import { ReviewView } from '@/components/ReviewView';
import { useAuth } from '@/hooks/useAuth';
import { useTopics } from '@/hooks/useTopics';
import { useTags } from '@/hooks/useTags';
import { useAssignees } from '@/hooks/useAssignees';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, FileText } from 'lucide-react';
import { NotesView } from '@/components/NotesView';
import { DashboardView } from '@/components/DashboardView';
import { ChecklistView } from '@/components/ChecklistView';
import { CalendarView } from '@/components/CalendarView';
import { SettingsView } from '@/components/SettingsView';
import { toast } from 'sonner';

type Filter = 'todos' | 'revision' | 'informes' | 'notas' | 'dashboard' | 'checklist' | 'calendario' | 'configuracion';
type StatusTab = 'activo' | 'seguimiento' | 'pausado' | 'completado';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { topics, isLoading, createTopic, updateTopic, deleteTopic, addSubtask, toggleSubtask, deleteSubtask, addProgressEntry, updateSubtask } = useTopics();
  const { tags, getTagsForTopic, createTag, deleteTag, addTopicTag, removeTopicTag } = useTags();
  const { assignees, createAssignee, deleteAssignee } = useAssignees();
  const [filter, setFilter] = useState<Filter>('todos');
  const [statusTab, setStatusTab] = useState<StatusTab>('activo');
  const [reportOpen, setReportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');

  const toggleTagFilter = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  }, []);

  const filteredTopics = useMemo(() => {
    const filtered = topics.filter((topic) => {
      if (topic.status !== statusTab) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = topic.title.toLowerCase().includes(query);
        const matchesSubtask = topic.subtasks.some((s) => s.title.toLowerCase().includes(query));
        if (!matchesTitle && !matchesSubtask) return false;
      }
      if (selectedTagIds.length > 0) {
        const topicTagIds = getTagsForTopic(topic.id).map((t) => t.id);
        if (!selectedTagIds.some((id) => topicTagIds.includes(id))) return false;
      }
      if (selectedAssignee && topic.assignee !== selectedAssignee) return false;
      return true;
    });
    return filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [topics, statusTab, searchQuery, selectedTagIds, selectedAssignee, getTagsForTopic]);

  const statusCounts = useMemo(() => ({
    activo: topics.filter((t) => t.status === 'activo').length,
    seguimiento: topics.filter((t) => t.status === 'seguimiento').length,
    pausado: topics.filter((t) => t.status === 'pausado').length,
    completado: topics.filter((t) => t.status === 'completado').length,
  }), [topics]);

  const uniqueAssignees = useMemo(() => {
    const names = topics.filter(t => t.status === 'seguimiento' && t.assignee).map(t => t.assignee!);
    return [...new Set(names)].sort();
  }, [topics]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!user) return <AuthPage />;

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
    assignee?: string;
  }) => {
    try {
      const created = await createTopic.mutateAsync({
        title: data.title,
        priority: data.priority,
        status: data.status,
        start_date: data.start_date,
        due_date: data.due_date,
        assignee: data.assignee || null,
      });

      // Run subtasks and existing tags in parallel
      const subtaskPromises = data.subtasks.map((title) =>
        addSubtask.mutateAsync({ topic_id: created.id, title })
      );
      const tagPromises = data.tagIds.map((tagId) =>
        addTopicTag.mutateAsync({ topic_id: created.id, tag_id: tagId })
      );

      await Promise.all([...subtaskPromises, ...tagPromises]);

      // New tags must be sequential (create then assign)
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeFilter={filter} onFilterChange={setFilter} topics={topics} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b border-border px-4 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <h1 className="text-sm font-semibold text-foreground">
                {filter === 'configuracion' ? 'Configuración' : filter === 'notas' ? 'Notas' : filter === 'informes' ? 'Informes' : filter === 'revision' ? 'Revisión' : filter === 'dashboard' ? 'Dashboard' : filter === 'checklist' ? 'Checklist del Día' : 'Temas'}
              </h1>
            </div>
            {filter !== 'notas' && filter !== 'informes' && filter !== 'revision' && filter !== 'dashboard' && filter !== 'checklist' && filter !== 'configuracion' && (
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
            )}
          </header>

          {filter === 'configuracion' ? (
            <SettingsView
              tags={tags}
              assignees={assignees}
              onDeleteTag={(id) => deleteTag.mutate(id)}
              onCreateTag={(data) => createTag.mutateAsync(data)}
              onDeleteAssignee={(id) => deleteAssignee.mutate(id)}
              onCreateAssignee={(name) => createAssignee.mutateAsync(name)}
            />
          ) : filter === 'dashboard' ? (
            <DashboardView topics={topics} />
          ) : filter === 'checklist' ? (
            <ChecklistView />
          ) : filter === 'notas' ? (
            <NotesView />
          ) : filter === 'revision' ? (
            <main className="flex-1 overflow-auto p-3 md:p-4">
              <ReviewView
                topics={topics}
                allTags={tags}
                assignees={assignees}
                onCreateAssignee={(name) => createAssignee.mutateAsync(name)}
                getTagsForTopic={getTagsForTopic}
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
            </main>
          ) : (
            <main className="flex-1 overflow-auto p-3 md:p-4">
              <div className="max-w-5xl mx-auto space-y-3">
                {filter === 'informes' ? (
                  <ReportsList onNewReport={() => setReportOpen(true)} />
                ) : (
                  <>
                    <Tabs value={statusTab} onValueChange={(value) => setStatusTab(value as StatusTab)}>
                      <TabsList className="w-full">
                        <TabsTrigger value="activo" className="flex-1 text-xs">Activos ({statusCounts.activo})</TabsTrigger>
                        <TabsTrigger value="seguimiento" className="flex-1 text-xs">Seguimiento ({statusCounts.seguimiento})</TabsTrigger>
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
                      assignees={statusTab === 'seguimiento' ? uniqueAssignees : undefined}
                      selectedAssignee={selectedAssignee}
                      onAssigneeChange={setSelectedAssignee}
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
                          assignees={assignees}
                          onCreateAssignee={(name) => createAssignee.mutateAsync(name)}
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
          )}
        </div>

        <ReportModal open={reportOpen} onOpenChange={setReportOpen} topics={topics} />
        <CreateTopicModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          allTags={tags}
          assignees={assignees}
          onCreateAssignee={(name) => createAssignee.mutateAsync(name)}
          onSubmit={handleCreateTopic}
          isPending={createTopic.isPending}
        />
      </div>
    </SidebarProvider>
  );
};

export default Index;
