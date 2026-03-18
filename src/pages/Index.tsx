import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { TopicCard } from '@/components/TopicCard';
import { ReportModal } from '@/components/ReportModal';
import { ReportsList } from '@/components/ReportsList';
import { FilterBar } from '@/components/FilterBar';
import { BulkEmailModal } from '@/components/BulkEmailModal';
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
import { EmailHistoryView } from '@/components/EmailHistoryView';
import { toast } from 'sonner';

type Filter = 'todos' | 'revision' | 'informes' | 'notas' | 'dashboard' | 'checklist' | 'calendario' | 'configuracion' | 'historial_correos';
type StatusTab = 'activo' | 'seguimiento' | 'pausado' | 'completado';

const Index = () => {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { topics, isLoading, createTopic, updateTopic, deleteTopic, addSubtask, toggleSubtask, deleteSubtask, addProgressEntry, updateProgressEntry, deleteProgressEntry, updateSubtask } = useTopics();
  const { tags, getTagsForTopic, createTag, updateTag, deleteTag, addTopicTag, removeTopicTag } = useTags();
  const { assignees, createAssignee, updateAssignee, deleteAssignee } = useAssignees();
  const [filter, setFilter] = useState<Filter>('todos');
  const [statusTab, setStatusTab] = useState<StatusTab>('activo');
  const [reportOpen, setReportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [forceExpand, setForceExpand] = useState<boolean | null>(null);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [filterNoDueDate, setFilterNoDueDate] = useState(false);

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
      if (filterNoDueDate && topic.due_date) return false;
      return true;
    });
    return filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [topics, statusTab, searchQuery, selectedTagIds, selectedAssignee, filterNoDueDate, getTagsForTopic]);

  const statusCounts = useMemo(() => {
    const counts = { activo: 0, seguimiento: 0, pausado: 0, completado: 0 };
    for (const t of topics) {
      if (t.status in counts) counts[t.status as keyof typeof counts]++;
    }
    return counts;
  }, [topics]);

  const uniqueAssignees = useMemo(() => {
    const names = topics.filter(t => t.status === 'seguimiento' && t.assignee).map(t => t.assignee!);
    return [...new Set(names)].sort();
  }, [topics]);

  const bulkEmailAssignee = useMemo(() => {
    if (statusTab !== 'seguimiento' || !selectedAssignee) return null;
    return assignees.find(a => a.name === selectedAssignee) || null;
  }, [statusTab, selectedAssignee, assignees]);

  const bulkEmailTopics = useMemo(() => {
    if (!bulkEmailAssignee) return [];
    return topics.filter(t => t.status === 'seguimiento' && t.assignee === bulkEmailAssignee.name);
  }, [topics, bulkEmailAssignee]);

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
        user_id: user!.id,
      });

      const warnings: string[] = [];
      const finalTagIds = [...data.tagIds];

      for (const newTag of data.newTags) {
        const { data: createdTag, error: tagErr } = await supabase
          .from('tags')
          .insert({ name: newTag.name, color: newTag.color, user_id: user!.id })
          .select()
          .single();

        if (tagErr) {
          throw new Error(`No se pudo crear la etiqueta "${newTag.name}"`);
        }

        finalTagIds.push(createdTag.id);
      }

      const operations: Promise<void>[] = [];

      if (data.subtasks.length > 0) {
        operations.push((async () => {
          const { error } = await supabase.from('subtasks').insert(
            data.subtasks.map((title, i) => ({ topic_id: created.id, title, sort_order: i }))
          );
          if (error) {
            warnings.push('subtareas');
            console.error('Subtask insert error:', error);
          }
        })());
      }

      if (finalTagIds.length > 0) {
        operations.push((async () => {
          const { error } = await supabase.from('topic_tags').insert(
            finalTagIds.map((tag_id) => ({ topic_id: created.id, tag_id }))
          );
          if (error) {
            throw new Error('No se pudieron guardar las etiquetas del tema');
          }
        })());
      }

      if (data.notes.trim()) {
        operations.push((async () => {
          const { error } = await supabase.from('progress_entries').insert({ topic_id: created.id, content: data.notes.trim() });
          if (error) {
            warnings.push('nota inicial');
            console.error('Notes insert error:', error);
          }
        })());
      }

      await Promise.all(operations);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['topics'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['tags'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['topic_tags'], refetchType: 'active' }),
      ]);

      setCreateOpen(false);
      if (warnings.length > 0) {
        toast.success(`Tema creado. Revisa: ${warnings.join(', ')}`);
      } else {
        toast.success('Tema creado');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al crear tema');
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
                {filter === 'configuracion' ? 'Configuración' : filter === 'historial_correos' ? 'Historial de Correos' : filter === 'calendario' ? 'Calendario' : filter === 'notas' ? 'Notas' : filter === 'informes' ? 'Informes' : filter === 'revision' ? 'Revisión' : filter === 'dashboard' ? 'Dashboard' : filter === 'checklist' ? 'Checklist del Día' : 'Temas'}
              </h1>
            </div>
            {filter !== 'notas' && filter !== 'informes' && filter !== 'revision' && filter !== 'dashboard' && filter !== 'checklist' && filter !== 'calendario' && filter !== 'configuracion' && filter !== 'historial_correos' && (
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
              topics={topics}
              onDeleteTag={(id) => deleteTag.mutate(id)}
              onCreateTag={(data) => createTag.mutateAsync(data)}
              onUpdateTag={(id, name) => updateTag.mutate({ id, name })}
              onDeleteAssignee={(id) => deleteAssignee.mutate(id)}
              onCreateAssignee={(name) => createAssignee.mutateAsync(name)}
              onUpdateAssignee={(id, data) => updateAssignee.mutate({ id, ...data })}
            />
          ) : filter === 'dashboard' ? (
            <DashboardView topics={topics} />
          ) : filter === 'historial_correos' ? (
            <EmailHistoryView />
          ) : filter === 'checklist' ? (
            <ChecklistView />
          ) : filter === 'calendario' ? (
            <CalendarView topics={topics} />
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
                    <Tabs value={statusTab} onValueChange={(value) => { setStatusTab(value as StatusTab); setForceExpand(null); setSearchQuery(''); setSelectedTagIds([]); setSelectedAssignee(''); setFilterNoDueDate(false); }}>
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
                      forceExpand={forceExpand}
                      onToggleExpand={() => setForceExpand(prev => !prev)}
                      onBulkEmail={bulkEmailAssignee ? () => setBulkEmailOpen(true) : undefined}
                      filterNoDueDate={filterNoDueDate}
                      onToggleNoDueDate={() => setFilterNoDueDate(prev => !prev)}
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
                          forceExpand={forceExpand}
                          onUpdate={(id, data) => updateTopic.mutate({ id, ...data })}
                          onDelete={(id) => deleteTopic.mutate(id, { onSuccess: () => toast.success('Tema eliminado') })}
                          onAddSubtask={(topicId, title) => addSubtask.mutate({ topic_id: topicId, title })}
                          onToggleSubtask={(id, completed) => toggleSubtask.mutate({ id, completed })}
                          onDeleteSubtask={(id) => deleteSubtask.mutate(id)}
                          onUpdateSubtask={(id, data) => updateSubtask.mutate({ id, ...data })}
                          onAddProgressEntry={(topicId, content) => addProgressEntry.mutate({ topic_id: topicId, content })}
                          onUpdateProgressEntry={(id, content) => updateProgressEntry.mutate({ id, content })}
                          onDeleteProgressEntry={(id) => deleteProgressEntry.mutate(id)}
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
        {bulkEmailAssignee && (
          <BulkEmailModal
            open={bulkEmailOpen}
            onOpenChange={setBulkEmailOpen}
            topics={bulkEmailTopics}
            assignee={bulkEmailAssignee}
          />
        )}
      </div>
    </SidebarProvider>
  );
};

export default Index;
