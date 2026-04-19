import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { WorkEvent } from './events';

// Reads the event log for a given target node. Used by NodeInspector to show
// the task/user/area/project lifecycle. We don't server-side order because
// the adapter doesn't index `workspace_events.created_at` yet; client-side
// sort is fine for the typical <200-event volume per entity.
export function useWorkGraphEvents(targetId: string | null): { events: WorkEvent[]; isLoading: boolean } {
  const rawId = stripPrefix(targetId);

  const q = useQuery({
    queryKey: ['workgraph_events', rawId],
    enabled: !!rawId,
    queryFn: async (): Promise<WorkEvent[]> => {
      if (!rawId) return [];
      const { data, error } = await supabase
        .from('workspace_events')
        .select('*')
        .eq('target_id', rawId);
      if (error) throw error;
      const events = (data || []) as unknown as WorkEvent[];
      return [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });
  return { events: q.data ?? [], isLoading: q.isLoading };
}

function stripPrefix(id: string | null): string | null {
  if (!id) return null;
  const idx = id.indexOf(':');
  return idx === -1 ? id : id.slice(idx + 1);
}
