import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildWorkGraph } from './buildWorkGraph';
import type { ClientEntity, ProjectEntity, WorkGraphData, WorkRelationship } from './types';

export interface WorkGraphFetchOptions {
  /** When true, unify data across ALL workspaces. Default false = current workspace. */
  crossWorkspace?: boolean;
  /** Scope to a specific workspace (ignored when crossWorkspace is true). */
  workspaceId?: string | null;
  /** Upper bound on `createdAt` so the timeline can rewind the graph. */
  asOf?: string | null;
}

/**
 * Fetcher-only hook: pulls every collection the graph needs and delegates the
 * ensembling to `buildWorkGraph` (pure). Keeping this thin makes it easy to
 * test the builder in isolation and to add new sources without entangling
 * fetching with layout logic.
 */
export function useWorkGraph(opts: WorkGraphFetchOptions = {}): { data: WorkGraphData; isLoading: boolean } {
  const { crossWorkspace = false, workspaceId = null, asOf = null } = opts;

  const q = useQuery({
    queryKey: ['workgraph', crossWorkspace ? 'all' : workspaceId, asOf],
    enabled: crossWorkspace || !!workspaceId,
    queryFn: async (): Promise<WorkGraphData> => {
      const applyScope = (builder: any) =>
        crossWorkspace ? builder : workspaceId ? builder.eq('workspace_id', workspaceId) : builder;

      const [
        workspacesR,
        topicsR,
        assigneesR,
        departmentsR,
        emailsR,
        projectsR,
        clientsR,
        relationshipsR,
      ] = await Promise.all([
        supabase.from('workspaces').select('*'),
        applyScope(supabase.from('topics').select('*')),
        applyScope(supabase.from('assignees').select('*')),
        applyScope(supabase.from('departments').select('*')),
        applyScope(supabase.from('notification_emails').select('*')),
        // Projects and clients live globally.
        supabase.from('projects').select('*'),
        supabase.from('clients').select('*'),
        // Relationships: global fetch; builder decides what to render.
        supabase.from('task_relationships').select('*'),
      ]);

      const topics = (topicsR.data || []) as any[];
      const topicIds = topics.map((t) => t.id);
      const subtasks: any[] = [];
      for (let i = 0; i < topicIds.length; i += 30) {
        const chunk = topicIds.slice(i, i + 30);
        const { data } = await supabase.from('subtasks').select('*').in('topic_id', chunk);
        subtasks.push(...((data || []) as any[]));
      }

      return buildWorkGraph({
        workspaces: (workspacesR.data || []) as any[],
        topics,
        assignees: (assigneesR.data || []) as any[],
        departments: (departmentsR.data || []) as any[],
        subtasks,
        emails: (emailsR.data || []) as any[],
        projects: ((projectsR.data || []) as unknown as ProjectEntity[]),
        clients: ((clientsR.data || []) as unknown as ClientEntity[]),
        relationships: ((relationshipsR.data || []) as unknown as WorkRelationship[]),
        asOf,
      });
    },
  });

  return { data: q.data ?? { nodes: [], links: [] }, isLoading: q.isLoading };
}
