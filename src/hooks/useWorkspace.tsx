import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useApproval } from '@/hooks/useApproval';
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
  setActiveWorkspaceId: (id: string | null) => void;
  refresh: () => Promise<void>;
  createWorkspace: (name: string) => Promise<WorkspaceSummary>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  canEdit: boolean;
  canAdmin: boolean;
  isOwner: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const STORAGE_KEY = 'active_workspace_id';

const ROLE_RANK: Record<WorkspaceRole, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { approved } = useApproval();
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

    // Shared model: any approved user can see ALL workspaces. Role is 'owner'
    // when owner_id matches the current user, 'editor' otherwise.
    const { data: wsData, error } = await supabase.from('workspaces').select('*');
    if (error) {
      console.error('[useWorkspace] workspaces fetch error:', error);
      setLoading(false);
      return;
    }

    const list: WorkspaceSummary[] = ((wsData ?? []) as any[])
      .map((w) => ({
        id: w.id,
        name: w.name,
        owner_id: w.owner_id,
        role: (w.owner_id === user.id ? 'owner' : 'editor') as WorkspaceRole,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setWorkspaces(list);

    const stored = localStorage.getItem(STORAGE_KEY);
    const valid = stored && list.some((w) => w.id === stored) ? stored : null;
    setActiveWorkspaceIdState(valid);
    if (valid) localStorage.setItem(STORAGE_KEY, valid);
    else localStorage.removeItem(STORAGE_KEY);

    setLoading(false);
  }, [user]);

  // Trigger the fetch when user logs in AND once approval resolves (so the
  // auto-bootstrap create succeeds against the write-requires-approval rule).
  useEffect(() => {
    if (!user) return;
    fetchWorkspaces();
  }, [fetchWorkspaces, user, approved]);

  const setActiveWorkspaceId = useCallback((id: string | null) => {
    setActiveWorkspaceIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
    queryClient.invalidateQueries();
  }, [queryClient]);

  const createWorkspace = useCallback(async (name: string): Promise<WorkspaceSummary> => {
    if (!user) throw new Error('No autenticado');
    const { data: ws, error } = await supabase
      .from('workspaces')
      .insert({ name, owner_id: user.id, created_by_email: user.email ?? null })
      .select()
      .single();
    if (error) throw error;
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

  // Cascade-delete workspace: remove all records in workspace-scoped collections
  // that reference this workspace, plus the workspace doc itself. Ordering is
  // child-first so sub-collections (subtasks, entries) are removed before their parents.
  const deleteWorkspace = useCallback(async (id: string) => {
    // 1) Fetch topics in this workspace to delete their sub-collections.
    const { data: topicsData } = await supabase.from('topics').select('id').eq('workspace_id', id);
    const topicIds = ((topicsData || []) as any[]).map((t) => t.id);
    if (topicIds.length > 0) {
      for (let i = 0; i < topicIds.length; i += 30) {
        const chunk = topicIds.slice(i, i + 30);
        const [subs] = await Promise.all([
          supabase.from('subtasks').select('id').in('topic_id', chunk).then((r) => ((r.data || []) as any[]).map((s) => s.id)),
          supabase.from('progress_entries').delete().in('topic_id', chunk),
          supabase.from('topic_tags').delete().in('topic_id', chunk),
          supabase.from('topic_reschedules' as any).delete().in('topic_id', chunk),
          supabase.from('topic_reminders').delete().in('topic_id', chunk),
          supabase.from('notification_emails').delete().in('topic_id', chunk),
        ]);
        if (subs.length > 0) {
          for (let j = 0; j < subs.length; j += 30) {
            const subChunk = subs.slice(j, j + 30);
            await Promise.all([
              supabase.from('subtask_entries').delete().in('subtask_id', subChunk),
              supabase.from('subtask_contacts').delete().in('subtask_id', subChunk),
            ]);
          }
          await supabase.from('subtasks').delete().in('topic_id', chunk);
        }
      }
      await supabase.from('topics').delete().eq('workspace_id', id);
    }
    // 2) Delete workspace-scoped first-class collections.
    await Promise.all([
      supabase.from('tags').delete().eq('workspace_id', id),
      supabase.from('assignees').delete().eq('workspace_id', id),
      supabase.from('departments').delete().eq('workspace_id', id),
      supabase.from('checklist_items').delete().eq('workspace_id', id),
      supabase.from('reminders').delete().eq('workspace_id', id),
      supabase.from('contacts').delete().eq('workspace_id', id),
      supabase.from('notebooks').delete().eq('workspace_id', id),
      supabase.from('notes').delete().eq('workspace_id', id),
      supabase.from('note_sections').delete().eq('workspace_id', id),
      supabase.from('email_schedules').delete().eq('workspace_id', id),
      supabase.from('reminder_emails' as any).delete().eq('workspace_id', id),
      supabase.from('reports').delete().eq('workspace_id', id),
      supabase.from('workspace_members').delete().eq('workspace_id', id),
    ]);
    // 3) Finally remove the workspace doc and any stale membership references.
    const { error } = await supabase.from('workspaces').delete().eq('id', id);
    if (error) throw error;
    if (activeWorkspaceId === id) setActiveWorkspaceId(null);
    await fetchWorkspaces();
  }, [fetchWorkspaces, activeWorkspaceId, setActiveWorkspaceId]);

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
    deleteWorkspace,
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
