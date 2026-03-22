
-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own departments" ON public.departments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own departments" ON public.departments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own departments" ON public.departments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add department_id to topics
ALTER TABLE public.topics ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
