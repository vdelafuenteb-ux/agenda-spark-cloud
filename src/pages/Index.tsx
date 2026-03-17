import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { TopicCard } from '@/components/TopicCard';
import { ReportModal } from '@/components/ReportModal';
import { ReportsList } from '@/components/ReportsList';
import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/useAuth';
import { useTopics } from '@/hooks/useTopics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { isToday } from 'date-fns';

type Filter = 'todos' | 'hoy' | 'alta' | 'informes';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { topics, isLoading, createTopic, updateTopic, deleteTopic, addSubtask, toggleSubtask, deleteSubtask } = useTopics();
  const [filter, setFilter] = useState<Filter>('todos');
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
    if (filter === 'hoy') return t.due_date && isToday(new Date(t.due_date));
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
                {filter === 'informes' ? 'Informes' : filter === 'alta' ? 'Prioridad Alta' : filter === 'hoy' ? 'Vence Hoy' : 'Todos los Temas'}
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
                  {/* New topic input */}
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

                  {isLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Cargando temas...</p>
                  ) : filteredTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {filter === 'todos' ? 'No hay temas. Crea uno arriba.' : 'No hay temas con este filtro.'}
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
