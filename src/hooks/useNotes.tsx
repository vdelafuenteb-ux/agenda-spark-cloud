import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
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
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();

  const notebooksQuery = useQuery({
    queryKey: ['notebooks', activeWorkspaceId],
    enabled: !!activeWorkspaceId,
    queryFn: async () => {
      if (!activeWorkspaceId) return [] as Notebook[];
      const { data, error } = await supabase
        .from('notebooks')
        .select('*')
        .eq('workspace_id', activeWorkspaceId);
      if (error) throw error;
      return [...(data as Notebook[] || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },
  });

  const sectionsQuery = useQuery({
    queryKey: ['note_sections', activeWorkspaceId],
    enabled: !!activeWorkspaceId,
    queryFn: async () => {
      if (!activeWorkspaceId) return [] as NoteSection[];
      const { data, error } = await supabase
        .from('note_sections')
        .select('*')
        .eq('workspace_id', activeWorkspaceId);
      if (error) throw error;
      return [...(data as NoteSection[] || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    },
  });

  const notesQuery = useQuery({
    queryKey: ['notes', activeWorkspaceId],
    enabled: !!activeWorkspaceId,
    queryFn: async () => {
      if (!activeWorkspaceId) return [] as Note[];
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('workspace_id', activeWorkspaceId);
      if (error) throw error;
      return [...(data as Note[] || [])].sort((a, b) => new Date((b as any).updated_at).getTime() - new Date((a as any).updated_at).getTime());
    },
  });

  const noteTagsQuery = useQuery({
    queryKey: ['note_tags', activeWorkspaceId],
    enabled: !!activeWorkspaceId,
    queryFn: async () => {
      if (!activeWorkspaceId) return [] as NoteTag[];
      const { data } = await supabase.from('notes').select('id').eq('workspace_id', activeWorkspaceId);
      const wsNoteIds = new Set(((data || []) as any[]).map((n) => n.id));
      if (wsNoteIds.size === 0) return [] as NoteTag[];
      const ids = [...wsNoteIds];
      const out: NoteTag[] = [];
      for (let i = 0; i < ids.length; i += 30) {
        const chunk = ids.slice(i, i + 30);
        const { data: ntData } = await supabase.from('note_tags').select('*').in('note_id', chunk);
        out.push(...((ntData || []) as NoteTag[]));
      }
      return out;
    },
  });

  const notebooks = notebooksQuery.data ?? [];
  const sections = sectionsQuery.data ?? [];
  const notes = notesQuery.data ?? [];
  const noteTags = noteTagsQuery.data ?? [];

  // Notebook CRUD
  const createNotebook = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      if (!user || !activeWorkspaceId) throw new Error('No hay workspace activo');
      const { data: nb, error } = await supabase
        .from('notebooks')
        .insert({ ...data, user_id: user.id, workspace_id: activeWorkspaceId })
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
      if (!user || !activeWorkspaceId) throw new Error('No hay workspace activo');
      const { data: sec, error } = await supabase
        .from('note_sections')
        .insert({ user_id: user.id, workspace_id: activeWorkspaceId, notebook_id: data.notebook_id, name: data.name, color: data.color ?? '#6b7280' })
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
      if (!user || !activeWorkspaceId) throw new Error('No hay workspace activo');
      const { data: note, error } = await supabase
        .from('notes')
        .insert({
          user_id: user.id,
          workspace_id: activeWorkspaceId,
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
