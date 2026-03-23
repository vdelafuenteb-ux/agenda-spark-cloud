import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { TopicCard } from '@/components/TopicCard';
import { ReportModal } from '@/components/ReportModal';
import { ReportsList } from '@/components/ReportsList';
import { FilterBar, type SortOption } from '@/components/FilterBar';
import { BulkEmailModal } from '@/components/BulkEmailModal';
import { CreateTopicModal } from '@/components/CreateTopicModal';
import { AuthPage } from '@/components/AuthPage';
import { ReviewView } from '@/components/ReviewView';
import { useAuth } from '@/hooks/useAuth';
import { useTopics } from '@/hooks/useTopics';
import { useTags } from '@/hooks/useTags';
import { useAssignees } from '@/hooks/useAssignees';
import { useDepartments } from '@/hooks/useDepartments';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, FileText } from 'lucide-react';
import { NotesView } from '@/components/NotesView';
import { DashboardView } from '@/components/DashboardView';
import { ChecklistView } from '@/components/ChecklistView';
import { CalendarView } from '@/components/CalendarView';
import { SettingsView } from '@/components/SettingsView';
import { EmailHistoryView } from '@/components/EmailHistoryView';
import { TeamView } from '@/components/TeamView';
import { toast } from 'sonner';

import type { Filter, StatusTab } from '@/types/filters';

const Index = () => {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  useEffect(() => {
    if (user) {
      queryClient.invalidateQueries();
    }
  }, [user, queryClient]);

  const { topics, isLoading, createTopic, updateTopic, deleteTopic, addSubtask, toggleSubtask, deleteSubtask, addProgressEntry, updateProgressEntry, deleteProgressEntry, updateSubtask, addSubtaskEntry, updateSubtaskEntry, deleteSubtaskEntry } = useTopics();
  const { tags, getTagsForTopic, createTag, updateTag, deleteTag, addTopicTag, removeTopicTag } = useTags();
  const { assignees, createAssignee, updateAssignee, deleteAssignee } = useAssignees();
  const { departments, createDepartment, updateDepartment, deleteDepartment } = useDepartments();
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
  const [showOngoing, setShowOngoing] = useState(true);
  const [showNotOngoing, setShowNotOngoing] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('order');

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
      if (!showOngoing && topic.is_ongoing) return false;
      if (!showNotOngoing && !topic.is_ongoing) return false;
      return true;
    });
    const priorityOrder: Record<string, number> = { alta: 0, media: 1, baja: 2 };
    return filtered.sort((a, b) => {
      const pinDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (pinDiff !== 0) return pinDiff;

      if (sortBy === 'order') {
        const orderA = (a as any).execution_order ?? Infinity;
        const orderB = (b as any).execution_order ?? Infinity;
        if (orderA !== orderB) return orderA - orderB;
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      }
      if (sortBy === 'priority') {
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      }
      if (sortBy === 'due_date') {
        const da = a.due_date || '9999-12-31';
        const db = b.due_date || '9999-12-31';
        return da.localeCompare(db);
      }
      // created
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [topics, statusTab, searchQuery, selectedTagIds, selectedAssignee, filterNoDueDate, showOngoing, showNotOngoing, getTagsForTopic, sortBy]);

  const statusCounts = useMemo(() => {
    const counts = { activo: 0, seguimiento: 0, pausado: 0, completado: 0 };
    for (const t of topics) {
      if (t.status in counts) counts[t.status as keyof typeof counts]++;
    }
    return counts;
  }, [topics]);

  const uniqueAssignees = useMemo(() => {
    const names = topics.filter(t => t.status === statusTab && t.assignee).map(t => t.assignee!);
    return [...new Set(names)].sort();
  }, [topics, statusTab]);

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
        is_ongoing: (data as any).is_ongoing ?? false,
        assignee: data.assignee || null,
        department_id: (data as Record<string, unknown>).department_id as string | null || null,
        execution_order: (data as any).execution_order ?? null,
        hh_type: (data as any).hh_type ?? null,
        hh_value: (data as any).hh_value ?? null,
        user_id: user!.id,
      } as any);

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
                {filter === 'configuracion' ? 'Configuración' : filter === 'historial_correos' ? 'Historial de Correos' : filter === 'calendario' ? 'Calendario' : filter === 'notas' ? 'Notas' : filter === 'informes' ? 'Informes' : filter === 'revision' ? 'Revisión' : filter === 'dashboard' ? 'Dashboard' : filter === 'checklist' ? 'Checklist del Día' : filter === 'equipo' ? 'Equipo' : 'Temas'}
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
              departments={departments}
              topics={topics}
              onDeleteTag={(id) => deleteTag.mutate(id)}
              onCreateTag={(data) => createTag.mutateAsync(data)}
              onUpdateTag={(id, name) => updateTag.mutate({ id, name })}
              onDeleteAssignee={(id) => deleteAssignee.mutate(id)}
              onCreateAssignee={(name) => createAssignee.mutateAsync(name)}
              onUpdateAssignee={(id, data) => updateAssignee.mutate({ id, ...data })}
              onCreateDepartment={(name) => createDepartment.mutateAsync(name)}
              onUpdateDepartment={(id, name) => updateDepartment.mutate({ id, name })}
              onDeleteDepartment={(id) => deleteDepartment.mutate(id)}
            />
          ) : filter === 'dashboard' ? (
            <DashboardView topics={topics} assignees={assignees} onUpdateTopic={(id, data) => updateTopic.mutate({ id, ...data })} />
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
                onToggleSubtask={(id, completed) => toggleSubtask.mutate({ id, completed })}
              />
            </main>
          ) : (
            <main className="flex-1 overflow-auto p-3 md:p-4">
              <div className="max-w-5xl mx-auto space-y-3">
                {filter === 'informes' ? (
                  <ReportsList onNewReport={() => setReportOpen(true)} />
                ) : (
                  <>
                    <Tabs value={statusTab} onValueChange={(value) => { setStatusTab(value as StatusTab); setForceExpand(null); setSearchQuery(''); setSelectedTagIds([]); setSelectedAssignee(''); setFilterNoDueDate(false); setShowOngoing(true); setShowNotOngoing(true); setSortBy('order'); }}>
                      <TabsList className="w-full">
                        <TabsTrigger value="activo" className="flex-1 text-[11px] sm:text-xs px-1 sm:px-3">Activos <span className="hidden sm:inline">({statusCounts.activo})</span><span className="sm:hidden ml-0.5">{statusCounts.activo}</span></TabsTrigger>
                        <TabsTrigger value="seguimiento" className="flex-1 text-[11px] sm:text-xs px-1 sm:px-3"><span className="sm:hidden">Seguim.</span><span className="hidden sm:inline">Seguimiento</span> <span className="hidden sm:inline">({statusCounts.seguimiento})</span><span className="sm:hidden ml-0.5">{statusCounts.seguimiento}</span></TabsTrigger>
                        <TabsTrigger value="pausado" className="flex-1 text-[11px] sm:text-xs px-1 sm:px-3">Pausados <span className="hidden sm:inline">({statusCounts.pausado})</span><span className="sm:hidden ml-0.5">{statusCounts.pausado}</span></TabsTrigger>
                        <TabsTrigger value="completado" className="flex-1 text-[11px] sm:text-xs px-1 sm:px-3">Cerrados <span className="hidden sm:inline">({statusCounts.completado})</span><span className="sm:hidden ml-0.5">{statusCounts.completado}</span></TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <FilterBar
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      allTags={tags}
                      selectedTagIds={selectedTagIds}
                      onToggleTag={toggleTagFilter}
                      assignees={statusTab !== 'activo' && uniqueAssignees.length > 0 ? uniqueAssignees : undefined}
                      selectedAssignee={statusTab !== 'activo' ? selectedAssignee : ''}
                      onAssigneeChange={statusTab !== 'activo' ? setSelectedAssignee : undefined}
                      forceExpand={forceExpand}
                      onToggleExpand={() => setForceExpand(prev => !prev)}
                      onBulkEmail={bulkEmailAssignee ? () => setBulkEmailOpen(true) : undefined}
                      filterNoDueDate={filterNoDueDate}
                      onToggleNoDueDate={() => setFilterNoDueDate(prev => !prev)}
                      showOngoing={showOngoing}
                      showNotOngoing={showNotOngoing}
                      onToggleShowOngoing={() => setShowOngoing(prev => !prev)}
                      onToggleShowNotOngoing={() => setShowNotOngoing(prev => !prev)}
                      sortBy={sortBy}
                      onSortChange={setSortBy}
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
                          departments={departments}
                          onCreateAssignee={(name) => createAssignee.mutateAsync(name)}
                          forceExpand={forceExpand}
                          onUpdate={(id, data) => {
                            updateTopic.mutate({ id, ...data });
                            if ((data as Record<string, unknown>).status === 'completado') {
                              const topic = topics.find(t => t.id === id);
                              topic?.subtasks.filter(s => !s.completed).forEach(s => {
                                toggleSubtask.mutate({ id: s.id, completed: true });
                              });
                            }
                          }}
                          onDelete={(id) => deleteTopic.mutate(id, { onSuccess: () => toast.success('Tema eliminado') })}
                          onAddSubtask={(topicId, title) => addSubtask.mutate({ topic_id: topicId, title })}
                          onToggleSubtask={(id, completed) => toggleSubtask.mutate({ id, completed })}
                          onDeleteSubtask={(id) => deleteSubtask.mutate(id)}
                          onUpdateSubtask={(id, data) => updateSubtask.mutate({ id, ...data })}
                          onAddSubtaskEntry={(subtaskId, content) => addSubtaskEntry.mutate({ subtask_id: subtaskId, content })}
                          onUpdateSubtaskEntry={(id, content) => updateSubtaskEntry.mutate({ id, content })}
                          onDeleteSubtaskEntry={(id) => deleteSubtaskEntry.mutate(id)}
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
          departments={departments}
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
