
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags" ON public.tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tags" ON public.tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON public.tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON public.tags FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.topic_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  UNIQUE(topic_id, tag_id)
);

ALTER TABLE public.topic_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topic_tags" ON public.topic_tags FOR SELECT
USING (EXISTS (SELECT 1 FROM public.topics WHERE topics.id = topic_tags.topic_id AND topics.user_id = auth.uid()));

CREATE POLICY "Users can create own topic_tags" ON public.topic_tags FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.topics WHERE topics.id = topic_tags.topic_id AND topics.user_id = auth.uid()));

CREATE POLICY "Users can delete own topic_tags" ON public.topic_tags FOR DELETE
USING (EXISTS (SELECT 1 FROM public.topics WHERE topics.id = topic_tags.topic_id AND topics.user_id = auth.uid()));
