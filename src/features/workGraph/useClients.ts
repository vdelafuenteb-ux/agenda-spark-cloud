import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ClientEntity } from './types';

// Clients, like projects, are globally shared across workspaces.
const QUERY_KEY = ['clients', 'global'] as const;

export function useClients() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ClientEntity[]> => {
      const { data, error } = await supabase.from('clients').select('*');
      if (error) throw error;
      const list = (data || []) as unknown as ClientEntity[];
      return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  const createClient = useMutation({
    mutationFn: async (input: { name: string; description?: string; contact_email?: string; color?: string }) => {
      if (!user) throw new Error('No autenticado');
      const payload = {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        contact_email: input.contact_email?.trim() || null,
        color: input.color || '#0ea5e9',
      };
      const { data, error } = await supabase.from('clients').insert(payload).select().single();
      if (error) throw error;
      return data as unknown as ClientEntity;
    },
    onSuccess: invalidate,
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; description?: string | null; contact_email?: string | null; color?: string | null }) => {
      const updateData: Record<string, unknown> = {};
      if (patch.name !== undefined) updateData.name = patch.name.trim();
      if (patch.description !== undefined) updateData.description = patch.description;
      if (patch.contact_email !== undefined) updateData.contact_email = patch.contact_email;
      if (patch.color !== undefined) updateData.color = patch.color;
      const { error } = await supabase.from('clients').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<ClientEntity[]>(QUERY_KEY);
      qc.setQueryData<ClientEntity[]>(QUERY_KEY, (old) => (old ?? []).filter((c) => c.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev); },
    onSettled: invalidate,
  });

  return {
    clients: query.data ?? [],
    isLoading: query.isLoading,
    createClient,
    updateClient,
    deleteClient,
  };
}
