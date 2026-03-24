import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  company: string;
  created_at: string;
}

export function useContacts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!user,
  });

  const createContact = useMutation({
    mutationFn: async (contact: Omit<Contact, 'id' | 'user_id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('contacts')
        .insert({ ...contact, user_id: user!.id })
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
