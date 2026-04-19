import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  company: string;
  country: string;
  created_at: string;
}

export function useContacts() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', activeWorkspaceId],
    queryFn: async () => {
      if (!activeWorkspaceId) return [] as Contact[];
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('workspace_id', activeWorkspaceId);
      if (error) throw error;
      const list = (data || []) as Contact[];
      return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },
    enabled: !!activeWorkspaceId,
  });

  const createContact = useMutation({
    mutationFn: async (contact: Omit<Contact, 'id' | 'user_id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('contacts')
        .insert({ ...contact, user_id: user!.id, workspace_id: activeWorkspaceId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Omit<Contact, 'id' | 'user_id' | 'created_at'>>) => {
      const { error } = await supabase.from('contacts').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  return { contacts, isLoading, createContact, updateContact, deleteContact };
}
