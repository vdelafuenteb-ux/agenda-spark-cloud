
-- ============================================================
-- 1. ROLES ENUM
-- ============================================================
CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

-- ============================================================
-- 2. CORE TABLES
-- ============================================================
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'editor',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON public.workspace_members(workspace_id);

CREATE TABLE public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'editor',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted boolean NOT NULL DEFAULT false,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_invitations_token ON public.workspace_invitations(token);
CREATE INDEX idx_workspace_invitations_email ON public.workspace_invitations(lower(email));

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. SECURITY DEFINER FUNCTIONS (avoid RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_workspace_id uuid, _user_id uuid, _min_role public.workspace_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id 
      AND user_id = _user_id
      AND CASE _min_role
        WHEN 'viewer' THEN role IN ('viewer','editor','admin','owner')
        WHEN 'editor' THEN role IN ('editor','admin','owner')
        WHEN 'admin'  THEN role IN ('admin','owner')
        WHEN 'owner'  THEN role = 'owner'
      END
  );
$$;

CREATE OR REPLACE FUNCTION public.user_workspace_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = _user_id;
$$;

-- ============================================================
-- 4. RLS ON CORE TABLES
-- ============================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Workspaces
CREATE POLICY "members can view workspace" ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(id, auth.uid()));
CREATE POLICY "users can create workspace" ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner can update workspace" ON public.workspaces FOR UPDATE TO authenticated
  USING (public.has_workspace_role(id, auth.uid(), 'owner'));
CREATE POLICY "owner can delete workspace" ON public.workspaces FOR DELETE TO authenticated
  USING (public.has_workspace_role(id, auth.uid(), 'owner'));

-- Members
CREATE POLICY "members can view their memberships" ON public.workspace_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "owner manages members" ON public.workspace_members FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), 'owner'))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), 'owner'));
CREATE POLICY "users can self-insert via invitation" ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Invitations
CREATE POLICY "admin can view invitations" ON public.workspace_invitations FOR SELECT TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), 'admin'));
CREATE POLICY "admin can manage invitations" ON public.workspace_invitations FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), 'admin'));

-- Profiles: anyone authenticated can see profile of any workspace co-member
CREATE POLICY "view co-members profiles" ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.workspace_members m1
      JOIN public.workspace_members m2 ON m1.workspace_id = m2.workspace_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.user_id
    )
  );
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 5. AUTO-CREATE WORKSPACE + PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_ws_id uuid;
  display text;
BEGIN
  display := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));
  
  INSERT INTO public.profiles(user_id, display_name, email)
  VALUES (NEW.id, display, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.workspaces(name, owner_id)
  VALUES ('Mi espacio', NEW.id)
  RETURNING id INTO new_ws_id;

  INSERT INTO public.workspace_members(workspace_id, user_id, role)
  VALUES (new_ws_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. ADD workspace_id + created_by/updated_by TO ALL TABLES
-- ============================================================
-- All tables become workspace-scoped. created_by / updated_by are nullable for now (Fase C will use them).

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'topics','subtasks','subtask_entries','subtask_contacts','progress_entries',
    'notes','notebooks','note_sections','note_tags',
    'departments','assignees','contacts','tags','topic_tags',
    'reminders','reminder_completions','reminder_emails',
    'email_schedules','reports','worker_incidents','score_snapshots',
    'checklist_items','topic_reminders','topic_reschedules',
    'update_tokens','notification_emails','entry_attachments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by uuid', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workspace ON public.%I(workspace_id)', t, t);
  END LOOP;
END $$;

-- ============================================================
-- 7. DROP OLD user_id-BASED POLICIES + ADD WORKSPACE POLICIES
-- ============================================================

-- ---------- TOPICS (everyone in workspace) ----------
DROP POLICY IF EXISTS "Users can view own topics" ON public.topics;
DROP POLICY IF EXISTS "Users can create own topics" ON public.topics;
DROP POLICY IF EXISTS "Users can update own topics" ON public.topics;
DROP POLICY IF EXISTS "Users can delete own topics" ON public.topics;

CREATE POLICY "ws view topics" ON public.topics FOR SELECT TO authenticated
  USING (workspace_id IS NULL AND user_id = auth.uid() OR public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws create topics" ON public.topics FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), 'editor'));
CREATE POLICY "ws update topics" ON public.topics FOR UPDATE TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), 'editor'));
CREATE POLICY "ws delete topics" ON public.topics FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), 'editor'));

-- ---------- Generic helper macro pattern via DO block for shared tables ----------
-- Tables where ALL workspace members (including viewer) can read; editor+ can write
DO $$
DECLARE
  t text;
  shared_tables text[] := ARRAY[
    'departments','assignees','contacts','tags','notebooks','note_sections','notes',
    'checklist_items','topic_reminders','reminders','reminder_completions'
  ];
BEGIN
  FOREACH t IN ARRAY shared_tables LOOP
    -- Drop legacy policies (best effort by name patterns)
    EXECUTE format('DO $inner$ BEGIN
      EXECUTE (SELECT string_agg(format(''DROP POLICY IF EXISTS %%I ON public.%I'', polname), ''; '') FROM pg_policies WHERE schemaname=''public'' AND tablename=''%s'');
    EXCEPTION WHEN OTHERS THEN NULL; END $inner$;', t, t);

    EXECUTE format('CREATE POLICY "ws view %s" ON public.%I FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "ws insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ''editor''))', t, t);
    EXECUTE format('CREATE POLICY "ws update %s" ON public.%I FOR UPDATE TO authenticated USING (public.has_workspace_role(workspace_id, auth.uid(), ''editor''))', t, t);
    EXECUTE format('CREATE POLICY "ws delete %s" ON public.%I FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, auth.uid(), ''editor''))', t, t);
  END LOOP;
END $$;

-- ---------- ADMIN-ONLY tables (only admin/owner can see/edit) ----------
DO $$
DECLARE
  t text;
  admin_tables text[] := ARRAY[
    'reports','worker_incidents','score_snapshots','email_schedules','reminder_emails',
    'notification_emails','update_tokens','topic_reschedules'
  ];
BEGIN
  FOREACH t IN ARRAY admin_tables LOOP
    EXECUTE format('DO $inner$ BEGIN
      EXECUTE (SELECT string_agg(format(''DROP POLICY IF EXISTS %%I ON public.%I'', polname), ''; '') FROM pg_policies WHERE schemaname=''public'' AND tablename=''%s'');
    EXCEPTION WHEN OTHERS THEN NULL; END $inner$;', t, t);

    EXECUTE format('CREATE POLICY "ws admin view %s" ON public.%I FOR SELECT TO authenticated USING (public.has_workspace_role(workspace_id, auth.uid(), ''admin''))', t, t);
    EXECUTE format('CREATE POLICY "ws admin insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ''admin''))', t, t);
    EXECUTE format('CREATE POLICY "ws admin update %s" ON public.%I FOR UPDATE TO authenticated USING (public.has_workspace_role(workspace_id, auth.uid(), ''admin''))', t, t);
    EXECUTE format('CREATE POLICY "ws admin delete %s" ON public.%I FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, auth.uid(), ''admin''))', t, t);
  END LOOP;
END $$;

-- Service role keep for score_snapshots
CREATE POLICY "service role manages snapshots v2" ON public.score_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------- Child tables (subtasks, entries, etc.) — derive workspace via parent ----------
-- subtasks
DROP POLICY IF EXISTS "Users can view own subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Users can create own subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Users can update own subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Users can delete own subtasks" ON public.subtasks;
CREATE POLICY "ws subtasks all" ON public.subtasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = subtasks.topic_id AND public.is_workspace_member(t.workspace_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = subtasks.topic_id AND public.has_workspace_role(t.workspace_id, auth.uid(), 'editor')));

-- subtask_entries
DROP POLICY IF EXISTS "Users can view own subtask entries" ON public.subtask_entries;
DROP POLICY IF EXISTS "Users can create own subtask entries" ON public.subtask_entries;
DROP POLICY IF EXISTS "Users can update own subtask entries" ON public.subtask_entries;
DROP POLICY IF EXISTS "Users can delete own subtask entries" ON public.subtask_entries;
CREATE POLICY "ws subtask_entries all" ON public.subtask_entries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subtasks s JOIN public.topics t ON t.id = s.topic_id WHERE s.id = subtask_entries.subtask_id AND public.is_workspace_member(t.workspace_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.subtasks s JOIN public.topics t ON t.id = s.topic_id WHERE s.id = subtask_entries.subtask_id AND public.has_workspace_role(t.workspace_id, auth.uid(), 'editor')));

-- subtask_contacts
DROP POLICY IF EXISTS "Users can view own subtask contacts" ON public.subtask_contacts;
DROP POLICY IF EXISTS "Users can create own subtask contacts" ON public.subtask_contacts;
DROP POLICY IF EXISTS "Users can update own subtask contacts" ON public.subtask_contacts;
DROP POLICY IF EXISTS "Users can delete own subtask contacts" ON public.subtask_contacts;
CREATE POLICY "ws subtask_contacts all" ON public.subtask_contacts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subtasks s JOIN public.topics t ON t.id = s.topic_id WHERE s.id = subtask_contacts.subtask_id AND public.is_workspace_member(t.workspace_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.subtasks s JOIN public.topics t ON t.id = s.topic_id WHERE s.id = subtask_contacts.subtask_id AND public.has_workspace_role(t.workspace_id, auth.uid(), 'editor')));

-- progress_entries
DROP POLICY IF EXISTS "Users can view own progress entries" ON public.progress_entries;
DROP POLICY IF EXISTS "Users can create own progress entries" ON public.progress_entries;
DROP POLICY IF EXISTS "Users can update own progress entries" ON public.progress_entries;
DROP POLICY IF EXISTS "Users can delete own progress entries" ON public.progress_entries;
CREATE POLICY "ws progress_entries all" ON public.progress_entries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = progress_entries.topic_id AND public.is_workspace_member(t.workspace_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = progress_entries.topic_id AND public.has_workspace_role(t.workspace_id, auth.uid(), 'editor')));

-- topic_tags
DROP POLICY IF EXISTS "Users can view own topic_tags" ON public.topic_tags;
DROP POLICY IF EXISTS "Users can create own topic_tags" ON public.topic_tags;
DROP POLICY IF EXISTS "Users can delete own topic_tags" ON public.topic_tags;
CREATE POLICY "ws topic_tags all" ON public.topic_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_tags.topic_id AND public.is_workspace_member(t.workspace_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_tags.topic_id AND public.has_workspace_role(t.workspace_id, auth.uid(), 'editor')));

-- note_tags
DROP POLICY IF EXISTS "Users can view own note_tags" ON public.note_tags;
DROP POLICY IF EXISTS "Users can create own note_tags" ON public.note_tags;
DROP POLICY IF EXISTS "Users can delete own note_tags" ON public.note_tags;
CREATE POLICY "ws note_tags all" ON public.note_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_tags.note_id AND public.is_workspace_member(n.workspace_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_tags.note_id AND public.has_workspace_role(n.workspace_id, auth.uid(), 'editor')));

-- entry_attachments — keep existing function-based policy but it still works since topics now have workspace
-- (owns_entry_attachment uses topic.user_id; we keep it for now since attachments are tied to entries)

-- ============================================================
-- 8. UPDATED_AT TRIGGERS for new tables
-- ============================================================
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
