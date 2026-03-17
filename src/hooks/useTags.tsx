import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TopicTag {
  id: string;
  topic_id: string;
  tag_id: string;
}

export function useTags() {
  const queryClient = useQueryClient();

  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const topicTagsQuery = useQuery({
    queryKey: ['topic_tags'],
    queryFn: async (): Promise<TopicTag[]> => {
      const { data, error } = await supabase
        .from('topic_tags')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const createTag = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('tags')
        .insert({ user_id: user.id, name, color })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['topic_tags'] });
    },
  });

  const addTopicTag = useMutation({
    mutationFn: async ({ topic_id, tag_id }: { topic_id: string; tag_id: string }) => {
      const { error } = await supabase.from('topic_tags').insert({ topic_id, tag_id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['topic_tags'] }),
  });

  const removeTopicTag = useMutation({
    mutationFn: async ({ topic_id, tag_id }: { topic_id: string; tag_id: string }) => {
      const { error } = await supabase
        .from('topic_tags')
        .delete()
        .eq('topic_id', topic_id)
        .eq('tag_id', tag_id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['topic_tags'] }),
  });

  const getTagsForTopic = (topicId: string): Tag[] => {
    const tagIds = (topicTagsQuery.data || [])
      .filter(tt => tt.topic_id === topicId)
      .map(tt => tt.tag_id);
    return (tagsQuery.data || []).filter(t => tagIds.includes(t.id));
  };

  return {
    tags: tagsQuery.data || [],
    topicTags: topicTagsQuery.data || [],
    isLoading: tagsQuery.isLoading,
    createTag,
    deleteTag,
    addTopicTag,
    removeTopicTag,
    getTagsForTopic,
  };
}
