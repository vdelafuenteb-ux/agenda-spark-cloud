import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface WorkspaceSummary {
  id: string;
  name: string;
  owner_id: string;
  role: WorkspaceRole;
}

interface WorkspaceContextValue {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  activeWorkspaceId: string | null;
  role: WorkspaceRole | null;
  loading: boolean;
  setActiveWorkspaceId: (id: string) => void;
  refresh: () => Promise<void>;
  createWorkspace: (name: string) => Promise<WorkspaceSummary>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  canEdit: boolean;
  canAdmin: boolean;
  isOwner: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const STORAGE_KEY = 'active_workspace_id';

const ROLE_RANK: Record<WorkspaceRole, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspaceIdState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('workspace_members')
      .select('role, workspace:workspaces(id, name, owner_id)')
      .eq('user_id', user.id);

    if (error) {
      toast.error('Error cargando workspaces');
      setLoading(false);
      return;
    }

    const list: WorkspaceSummary[] = (data ?? [])
      .filter((r: any) => r.workspace)
      .map((r: any) => ({
        id: r.workspace.id,
        name: r.workspace.name,
        owner_id: r.workspace.owner_id,
        role: r.role as WorkspaceRole,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setWorkspaces(list);

    const stored = localStorage.getItem(STORAGE_KEY);
    const valid = stored && list.some((w) => w.id === stored) ? stored : list[0]?.id ?? null;
    setActiveWorkspaceIdState(valid);
    if (valid) localStorage.setItem(STORAGE_KEY, valid);

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
    queryClient.invalidateQueries();
  }, [queryClient]);

  const createWorkspace = useCallback(async (name: string): Promise<WorkspaceSummary> => {
    if (!user) throw new Error('No autenticado');
    const { data: ws, error } = await supabase
      .from('workspaces')
      .insert({ name, owner_id: user.id })
      .select()
      .single();
    if (error) throw error;
    const { error: memberErr } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' });
    if (memberErr) throw memberErr;
    const summary: WorkspaceSummary = { id: ws.id, name: ws.name, owner_id: ws.owner_id, role: 'owner' };
    await fetchWorkspaces();
    setActiveWorkspaceId(ws.id);
    return summary;
  }, [user, fetchWorkspaces, setActiveWorkspaceId]);

  const renameWorkspace = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from('workspaces').update({ name }).eq('id', id);
    if (error) throw error;
    await fetchWorkspaces();
  }, [fetchWorkspaces]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  );

  const role = activeWorkspace?.role ?? null;
  const canEdit = role ? ROLE_RANK[role] >= ROLE_RANK.editor : false;
  const canAdmin = role ? ROLE_RANK[role] >= ROLE_RANK.admin : false;
  const isOwner = role === 'owner';

  const value: WorkspaceContextValue = {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    role,
    loading,
    setActiveWorkspaceId,
    refresh: fetchWorkspaces,
    createWorkspace,
    renameWorkspace,
    canEdit,
    canAdmin,
    isOwner,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
