import { Eye, LayoutList, FileText, LogOut, StickyNote, BarChart3, CheckSquare, Settings, CalendarDays, MailCheck } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import { isStoredDateOverdue } from '@/lib/date';

type Filter = 'todos' | 'revision' | 'informes' | 'notas' | 'dashboard' | 'checklist' | 'calendario' | 'configuracion' | 'historial_correos';

interface AppSidebarProps {
  activeFilter: Filter;
  onFilterChange: (f: Filter) => void;
  topics: TopicWithSubtasks[];
}

const filters: { key: Filter; label: string; icon: typeof LayoutList }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'todos', label: 'Todos los temas', icon: LayoutList },
  { key: 'revision', label: 'Revisión', icon: Eye },
  { key: 'checklist', label: 'Checklist', icon: CheckSquare },
  { key: 'calendario', label: 'Calendario', icon: CalendarDays },
  { key: 'notas', label: 'Notas', icon: StickyNote },
  { key: 'informes', label: 'Informes', icon: FileText },
  { key: 'historial_correos', label: 'Historial Correos', icon: MailCheck },
  { key: 'configuracion', label: 'Configuración', icon: Settings },
];

export function AppSidebar({ activeFilter, onFilterChange, topics }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut } = useAuth();

  const activeTopics = topics.filter(t => t.status === 'activo');
  const seguimientoCount = topics.filter(t => t.status === 'seguimiento').length;
  const overdueCount = activeTopics.filter(t => isStoredDateOverdue(t.due_date)).length;
  const totalSubtasks = activeTopics.reduce((acc, t) => acc + t.subtasks.length, 0);
  const completedSubtasks = activeTopics.reduce((acc, t) => acc + t.subtasks.filter(s => s.completed).length, 0);
  const progress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <div className={`px-3 py-4 ${collapsed ? 'text-center' : ''}`}>
            {!collapsed && (
              <>
                <h2 className="text-sm font-semibold text-foreground tracking-tight">Agenda de Matías</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                  {activeTopics.length} activos · {seguimientoCount} seguimiento · {progress}% avance
                </p>
              </>
            )}
            {collapsed && <span className="text-xs font-bold text-foreground">AM</span>}
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {filters.map(f => (
                <SidebarMenuItem key={f.key}>
                  <SidebarMenuButton
                    onClick={() => onFilterChange(f.key)}
                    className={activeFilter === f.key ? 'bg-accent text-accent-foreground font-medium' : ''}
                  >
                    <f.icon className="h-4 w-4" />
                    {!collapsed && (
                      <span className="flex items-center gap-2">
                        {f.label}
                        {f.key === 'revision' && overdueCount > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                            {overdueCount}
                          </Badge>
                        )}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Cerrar sesión</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
