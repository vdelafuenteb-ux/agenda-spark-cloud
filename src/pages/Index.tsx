import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { TopicCard } from '@/components/TopicCard';
import { ReportModal } from '@/components/ReportModal';
import { ReportsList } from '@/components/ReportsList';
import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/useAuth';
import { useTopics } from '@/hooks/useTopics';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { isToday } from 'date-fns';

type Filter = 'todos' | 'hoy' | 'alta' | 'informes';
type StatusTab = 'activo' | 'pausado' | 'completado';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { topics, isLoading, createTopic, updateTopic, deleteTopic, addSubtask, toggleSubtask, deleteSubtask, addProgressEntry, updateSubtask } = useTopics();
  const [filter, setFilter] = useState<Filter>('todos');
  const [statusTab, setStatusTab] = useState<StatusTab>('activo');
  const [reportOpen, setReportOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  const filteredTopics = topics.filter(t => {
    // First filter by status tab
    if (t.status !== statusTab) return false;
    // Then apply sidebar filters
    if (filter === 'hoy') {
      const topicDueToday = t.due_date && isToday(new Date(t.due_date));
      const hasSubtaskDueToday = t.subtasks.some(s => s.due_date && isToday(new Date(s.due_date)));
      return topicDueToday || hasSubtaskDueToday;
    }
    if (filter === 'alta') return t.priority === 'alta';
    return true;
  });

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createTopic.mutate({ title: newTitle.trim() }, {
      onSuccess: () => { setNewTitle(''); toast.success('Tema creado'); },
      onError: (e) => toast.error(e.message),
    });
  };

  const statusCounts = {
    activo: topics.filter(t => t.status === 'activo').length,
    pausado: topics.filter(t => t.status === 'pausado').length,
    completado: topics.filter(t => t.status === 'completado').length,
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeFilter={filter} onFilterChange={setFilter} topics={topics} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-12 flex items-center justify-between border-b border-border px-4 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <h1 className="text-sm font-semibold text-foreground">
                {filter === 'informes' ? 'Informes' : filter === 'alta' ? 'Prioridad Alta' : filter === 'hoy' ? 'Mi Día' : 'Temas'}
              </h1>
            </div>
            <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setReportOpen(true)}>
              <FileText className="h-3 w-3" />
              Emitir Informe
            </Button>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-3xl mx-auto space-y-3">
              {filter === 'informes' ? (
                <ReportsList />
              ) : (
                <>
                  {/* Status tabs */}
                  <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)}>
                    <TabsList className="w-full">
                      <TabsTrigger value="activo" className="flex-1 text-xs">
                        Activos ({statusCounts.activo})
                      </TabsTrigger>
                      <TabsTrigger value="pausado" className="flex-1 text-xs">
                        Pausados ({statusCounts.pausado})
                      </TabsTrigger>
                      <TabsTrigger value="completado" className="flex-1 text-xs">
                        Cerrados ({statusCounts.completado})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* New topic input */}
                  {statusTab === 'activo' && (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Nuevo tema..."
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        className="h-9 text-sm"
                      />
                      <Button size="sm" className="h-9 shrink-0" onClick={handleCreate} disabled={createTopic.isPending}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {isLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Cargando temas...</p>
                  ) : filteredTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {statusTab === 'activo' ? 'No hay temas activos.' : statusTab === 'pausado' ? 'No hay temas pausados.' : 'No hay temas cerrados.'}
                    </p>
                  ) : (
                    filteredTopics.map(topic => (
                      <TopicCard
                        key={topic.id}
                        topic={topic}
                        onUpdate={(id, data) => updateTopic.mutate({ id, ...data })}
                        onDelete={(id) => deleteTopic.mutate(id, { onSuccess: () => toast.success('Tema eliminado') })}
                        onAddSubtask={(topicId, title) => addSubtask.mutate({ topic_id: topicId, title })}
                        onToggleSubtask={(id, completed) => toggleSubtask.mutate({ id, completed })}
                        onDeleteSubtask={(id) => deleteSubtask.mutate(id)}
                        onUpdateSubtask={(id, data) => updateSubtask.mutate({ id, ...data })}
                        onAddProgressEntry={(topicId, content) => addProgressEntry.mutate({ topic_id: topicId, content })}
                      />
                    ))
                  )}
                </>
              )}
            </div>
          </main>
        </div>

        <ReportModal open={reportOpen} onOpenChange={setReportOpen} topics={topics} />
      </div>
    </SidebarProvider>
  );
};

export default Index;
