import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Notebook {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface NoteSection {
  id: string;
  user_id: string;
  notebook_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  notebook_id: string | null;
  section_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface NoteTag {
  id: string;
  note_id: string;
  tag_id: string;
}

export function useNotes() {
  const qc = useQueryClient();

  const notebooksQuery = useQuery({
    queryKey: ['notebooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notebooks')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Notebook[];
    },
  });

  const sectionsQuery = useQuery({
    queryKey: ['note_sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('note_sections')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as NoteSection[];
    },
  });

  const notesQuery = useQuery({
    queryKey: ['notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  const noteTagsQuery = useQuery({
    queryKey: ['note_tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('note_tags').select('*');
      if (error) throw error;
      return data as NoteTag[];
    },
  });

  const notebooks = notebooksQuery.data ?? [];
  const sections = sectionsQuery.data ?? [];
  const notes = notesQuery.data ?? [];
  const noteTags = noteTagsQuery.data ?? [];

  // Notebook CRUD
  const createNotebook = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('No autenticado');
      const { data: nb, error } = await supabase
        .from('notebooks')
        .insert({ ...data, user_id: user.user.id })
        .select()
        .single();
      if (error) throw error;
      return nb as Notebook;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notebooks'] }),
  });

  const updateNotebook = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; color?: string }) => {
      const { error } = await supabase.from('notebooks').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notebooks'] }),
  });

  const deleteNotebook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notebooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notebooks'] });
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['note_tags'] });
      qc.invalidateQueries({ queryKey: ['note_sections'] });
    },
  });

  // Section CRUD
  const createSection = useMutation({
    mutationFn: async (data: { notebook_id: string; name: string; color?: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('No autenticado');
      const { data: sec, error } = await supabase
        .from('note_sections')
        .insert({ user_id: user.user.id, notebook_id: data.notebook_id, name: data.name, color: data.color ?? '#6b7280' })
        .select()
        .single();
      if (error) throw error;
      return sec as NoteSection;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note_sections'] }),
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; color?: string; sort_order?: number }) => {
      const { error } = await supabase.from('note_sections').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note_sections'] }),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('note_sections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['note_sections'] });
      qc.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  // Note CRUD
  const createNote = useMutation({
    mutationFn: async (data: { title?: string; notebook_id?: string | null; section_id?: string | null }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('No autenticado');
      const { data: note, error } = await supabase
        .from('notes')
        .insert({
          user_id: user.user.id,
          title: data.title ?? '',
          notebook_id: data.notebook_id ?? null,
          section_id: data.section_id ?? null,
          content: '',
        })
        .select()
        .single();
      if (error) throw error;
      return note as Note;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; content?: string; notebook_id?: string | null; section_id?: string | null }) => {
      const { error } = await supabase.from('notes').update(data).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ['notes'] });
      const previous = qc.getQueryData<Note[]>(['notes']);
      qc.setQueryData<Note[]>(['notes'], (old = []) =>
        old.map((n) => (n.id === id ? { ...n, ...data, updated_at: new Date().toISOString() } : n)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['notes'], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notes'] });
      const previous = qc.getQueryData<Note[]>(['notes']);
      qc.setQueryData<Note[]>(['notes'], (old = []) => old.filter((n) => n.id !== id));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['notes'], ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['note_tags'] });
    },
  });

  // Note tags
  const addNoteTag = useMutation({
    mutationFn: async ({ note_id, tag_id }: { note_id: string; tag_id: string }) => {
      const { error } = await supabase.from('note_tags').insert({ note_id, tag_id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note_tags'] }),
  });

  const removeNoteTag = useMutation({
    mutationFn: async ({ note_id, tag_id }: { note_id: string; tag_id: string }) => {
      const { error } = await supabase.from('note_tags').delete().match({ note_id, tag_id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note_tags'] }),
  });

  const getTagsForNote = (noteId: string) => {
    return noteTags.filter((nt) => nt.note_id === noteId).map((nt) => nt.tag_id);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('No autenticado');
    const ext = file.name?.split('.').pop() || 'png';
    const path = `${user.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('note-images').upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('note-images').getPublicUrl(path);
    return urlData.publicUrl;
  };

  return {
    notebooks,
    sections,
    notes,
    noteTags,
    isLoading: notebooksQuery.isLoading || notesQuery.isLoading || sectionsQuery.isLoading,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    createSection,
    updateSection,
    deleteSection,
    createNote,
    updateNote,
    deleteNote,
    addNoteTag,
    removeNoteTag,
    getTagsForNote,
    uploadImage,
  };
}
