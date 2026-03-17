import { AlertTriangle, CalendarClock, FileText, LogOut, LayoutList } from 'lucide-react';
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
import type { TopicWithSubtasks } from '@/hooks/useTopics';

type Filter = 'todos' | 'hoy' | 'alta' | 'informes';

interface AppSidebarProps {
  activeFilter: Filter;
  onFilterChange: (f: Filter) => void;
  topics: TopicWithSubtasks[];
}

const filters: { key: Filter; label: string; icon: typeof LayoutList }[] = [
  { key: 'todos', label: 'Todos', icon: LayoutList },
  { key: 'hoy', label: 'Vence hoy', icon: CalendarClock },
  { key: 'alta', label: 'Prioridad Alta', icon: AlertTriangle },
  { key: 'informes', label: 'Informes', icon: FileText },
];

export function AppSidebar({ activeFilter, onFilterChange, topics }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut } = useAuth();

  const activeTopics = topics.filter(t => t.status === 'activo');
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
                <h2 className="text-sm font-semibold text-foreground tracking-tight">Progress Engine</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {activeTopics.length} activos · {progress}% avance
                </p>
              </>
            )}
            {collapsed && <span className="text-xs font-bold text-foreground">PE</span>}
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
                    {!collapsed && <span>{f.label}</span>}
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
