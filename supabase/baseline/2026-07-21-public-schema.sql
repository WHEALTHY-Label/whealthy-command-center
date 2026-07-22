-- WHEALTHY production public schema catalog snapshot
-- Captured: 2026-07-22T04:49:14.784Z
-- Project ref: yzaxzmuuvozonhgwhlim
-- Capture method: strictly SELECT-only pg_catalog and information_schema queries via Supabase MCP.
-- Scope: schema metadata only. No table row data was queried or included.
--
-- IMPORTANT LIMITATION: Supabase CLI db dump was not used. Its linked capture attempted a remote
-- role initialization and was refused with permission denied. This file is therefore a catalog-derived
-- recovery snapshot, not a byte-for-byte pg_dump. Recreating production must be reviewed before execution.
-- Statements marked NON-EXECUTABLE are metadata records only; they must not be replayed blindly.

-- === TABLES, COLUMNS, CONSTRAINTS, RLS, POLICIES, INDEXES, AND TABLE GRANTS ===

-- Table: public."_qa_sync" | relkind=r | force_rls=false
CREATE TABLE public."_qa_sync" (
  "id" bigint
);
ALTER TABLE public."_qa_sync" ENABLE ROW LEVEL SECURITY;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."_qa_sync" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."_qa_sync" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."_qa_sync" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."_qa_sync" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."_qa_sync" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."_qa_sync" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."_qa_sync" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."_qa_sync" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."_qa_sync" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."_qa_sync" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."_qa_sync" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."_qa_sync" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."_qa_sync" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."_qa_sync" TO "service_role";

-- Table: public."admin_audit_log" | relkind=r | force_rls=false
CREATE TABLE public."admin_audit_log" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "actor_email" text NOT NULL,
  "actor_role" text NOT NULL,
  "action" text NOT NULL,
  "target" text,
  "details" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."admin_audit_log" ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."admin_audit_log" ENABLE ROW LEVEL SECURITY;
CREATE INDEX admin_audit_log_actor_idx ON public.admin_audit_log USING btree (actor_email);
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log USING btree (created_at DESC);
CREATE UNIQUE INDEX admin_audit_log_pkey ON public.admin_audit_log USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."admin_audit_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."admin_audit_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."admin_audit_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."admin_audit_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."admin_audit_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."admin_audit_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."admin_audit_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."admin_audit_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."admin_audit_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."admin_audit_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."admin_audit_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."admin_audit_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."admin_audit_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."admin_audit_log" TO "service_role";

-- Table: public."affiliates" | relkind=r | force_rls=false
CREATE TABLE public."affiliates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "ref_id" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "email" text
);
ALTER TABLE ONLY public."affiliates" ADD CONSTRAINT "affiliates_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."affiliates" ADD CONSTRAINT "affiliates_ref_id_key" UNIQUE (ref_id);
ALTER TABLE public."affiliates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_affiliate_directory" ON public."affiliates" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);
CREATE UNIQUE INDEX affiliates_pkey ON public.affiliates USING btree (id);
CREATE UNIQUE INDEX affiliates_ref_id_key ON public.affiliates USING btree (ref_id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."affiliates" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."affiliates" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."affiliates" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."affiliates" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."affiliates" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."affiliates" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."affiliates" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."affiliates" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."affiliates" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."affiliates" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."affiliates" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."affiliates" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."affiliates" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."affiliates" TO "service_role";

-- Table: public."ambassadors" | relkind=r | force_rls=false
CREATE TABLE public."ambassadors" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "email" text NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text,
  "phone" text,
  "referral_code" text NOT NULL,
  "commission_rate" numeric(5,2) DEFAULT 15.00 NOT NULL,
  "stripe_connect_id" text,
  "tier" text DEFAULT 'T3'::text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "total_referrals" integer DEFAULT 0 NOT NULL,
  "total_conversions" integer DEFAULT 0 NOT NULL,
  "total_earned" numeric(10,2) DEFAULT 0.00 NOT NULL,
  "total_paid" numeric(10,2) DEFAULT 0.00 NOT NULL,
  "source" text DEFAULT 'skool'::text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."ambassadors" ADD CONSTRAINT "ambassadors_email_key" UNIQUE (email);
ALTER TABLE ONLY public."ambassadors" ADD CONSTRAINT "ambassadors_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."ambassadors" ADD CONSTRAINT "ambassadors_referral_code_key" UNIQUE (referral_code);
ALTER TABLE ONLY public."ambassadors" ADD CONSTRAINT "ambassadors_status_check" CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'suspended'::text]));
ALTER TABLE ONLY public."ambassadors" ADD CONSTRAINT "ambassadors_tier_check" CHECK (tier = ANY (ARRAY['T1'::text, 'T2'::text, 'T3'::text]));
ALTER TABLE public."ambassadors" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public."ambassadors" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX ambassadors_email_key ON public.ambassadors USING btree (email);
CREATE UNIQUE INDEX ambassadors_pkey ON public.ambassadors USING btree (id);
CREATE UNIQUE INDEX ambassadors_referral_code_key ON public.ambassadors USING btree (referral_code);
CREATE INDEX idx_ambassadors_referral_code ON public.ambassadors USING btree (referral_code);
CREATE INDEX idx_ambassadors_status ON public.ambassadors USING btree (status);
-- NON-EXECUTABLE trigger definition: CREATE TRIGGER set_updated_at_ambassadors BEFORE UPDATE ON ambassadors FOR EACH ROW EXECUTE FUNCTION update_updated_at()
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."ambassadors" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."ambassadors" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."ambassadors" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."ambassadors" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."ambassadors" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."ambassadors" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."ambassadors" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."ambassadors" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."ambassadors" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."ambassadors" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."ambassadors" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."ambassadors" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."ambassadors" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."ambassadors" TO "service_role";

-- Table: public."app_config" | relkind=r | force_rls=false
CREATE TABLE public."app_config" (
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."app_config" ADD CONSTRAINT "app_config_pkey" PRIMARY KEY (key);
ALTER TABLE public."app_config" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX app_config_pkey ON public.app_config USING btree (key);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."app_config" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."app_config" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."app_config" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."app_config" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."app_config" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."app_config" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."app_config" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."app_config" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."app_config" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."app_config" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."app_config" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."app_config" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."app_config" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."app_config" TO "service_role";

-- Table: public."app_events" | relkind=r | force_rls=false
CREATE TABLE public."app_events" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "email" text NOT NULL,
  "event_type" text DEFAULT 'app_open'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."app_events" ADD CONSTRAINT "app_events_pkey" PRIMARY KEY (id);
ALTER TABLE public."app_events" ENABLE ROW LEVEL SECURITY;
CREATE INDEX app_events_created_idx ON public.app_events USING btree (created_at);
CREATE INDEX app_events_email_created_idx ON public.app_events USING btree (email, created_at);
CREATE UNIQUE INDEX app_events_pkey ON public.app_events USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."app_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."app_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."app_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."app_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."app_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."app_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."app_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."app_events" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."app_events" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."app_events" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."app_events" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."app_events" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."app_events" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."app_events" TO "service_role";

-- Table: public."approved_members" | relkind=r | force_rls=false
CREATE TABLE public."approved_members" (
  "id" bigint DEFAULT nextval('approved_members_id_seq'::regclass) NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "joined_at" timestamp with time zone DEFAULT now(),
  "source" text DEFAULT 'skool'::text,
  "last_name" text,
  "phone" text,
  "archetype" text,
  "archetype_name" text,
  "identity_anchor" text,
  "bundle_key" text,
  "bundle_name" text,
  "price" text,
  "price_interval" text,
  "scores" jsonb,
  "answers" jsonb,
  "referred_by" text,
  "referral_id" bigint,
  "active" boolean DEFAULT true,
  "active_through" date,
  "sex" text DEFAULT ''::text,
  "age_band" text DEFAULT ''::text,
  "relationship" text DEFAULT ''::text,
  "kids_count" integer,
  "job_type" text DEFAULT ''::text,
  "hours_band" text DEFAULT ''::text,
  "consumption" text DEFAULT ''::text,
  "identity_profile" text DEFAULT ''::text,
  "load_score" real,
  "load_season" text DEFAULT ''::text,
  "member_status" text DEFAULT 'lead'::text NOT NULL,
  "skool_user_id" text,
  "skool_handle" text,
  "skool_joined_at" timestamp with time zone,
  "admin_role" text,
  "tour_done_at" timestamp with time zone,
  "first_steps" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "pathway" text,
  "peak_block" text,
  "skeptical_flag" boolean DEFAULT false NOT NULL,
  "invited_at" timestamp with time zone,
  "tier" text DEFAULT 'free'::text NOT NULL
);
ALTER TABLE ONLY public."approved_members" ADD CONSTRAINT "approved_members_admin_role_check" CHECK (admin_role IS NULL OR (admin_role = ANY (ARRAY['master'::text, 'admin'::text, 'moderator'::text])));
ALTER TABLE ONLY public."approved_members" ADD CONSTRAINT "approved_members_email_key" UNIQUE (email);
ALTER TABLE ONLY public."approved_members" ADD CONSTRAINT "approved_members_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."approved_members" ADD CONSTRAINT "approved_members_tier_check" CHECK (tier = ANY (ARRAY['free'::text, 'premium'::text]));
ALTER TABLE public."approved_members" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role insert only" ON public."approved_members" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);
CREATE UNIQUE INDEX approved_members_email_key ON public.approved_members USING btree (email);
CREATE UNIQUE INDEX approved_members_pkey ON public.approved_members USING btree (id);
CREATE UNIQUE INDEX approved_members_skool_user_id_key ON public.approved_members USING btree (skool_user_id) WHERE (skool_user_id IS NOT NULL);
CREATE INDEX idx_approved_members_email ON public.approved_members USING btree (email);
CREATE INDEX idx_approved_members_referred_by ON public.approved_members USING btree (referred_by);
-- NON-EXECUTABLE trigger definition: CREATE TRIGGER log_quiz_history_trigger AFTER INSERT OR UPDATE ON approved_members FOR EACH ROW EXECUTE FUNCTION log_quiz_history_fn()
-- NON-EXECUTABLE trigger definition: CREATE TRIGGER trg_member_onboarding AFTER INSERT OR UPDATE ON approved_members FOR EACH ROW EXECUTE FUNCTION enqueue_member_onboarding()
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."approved_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."approved_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."approved_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."approved_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."approved_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."approved_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."approved_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."approved_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."approved_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."approved_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."approved_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."approved_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."approved_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."approved_members" TO "service_role";

-- Table: public."bible_progress" | relkind=r | force_rls=false
CREATE TABLE public."bible_progress" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "start_date" date DEFAULT CURRENT_DATE NOT NULL,
  "completed_days" integer[] DEFAULT '{}'::integer[] NOT NULL,
  "streak" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "email" text
);
ALTER TABLE ONLY public."bible_progress" ADD CONSTRAINT "bible_progress_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."bible_progress" ADD CONSTRAINT "bible_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."bible_progress" ADD CONSTRAINT "bible_progress_user_unique" UNIQUE (user_id);
ALTER TABLE public."bible_progress" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_insert_own_progress" ON public."bible_progress" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "authenticated_read_own_progress" ON public."bible_progress" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "authenticated_update_own_progress" ON public."bible_progress" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE UNIQUE INDEX bible_progress_pkey ON public.bible_progress USING btree (id);
CREATE UNIQUE INDEX bible_progress_user_unique ON public.bible_progress USING btree (user_id);
CREATE INDEX idx_bible_progress_email ON public.bible_progress USING btree (email);
CREATE INDEX idx_bible_progress_user_id ON public.bible_progress USING btree (user_id);
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."bible_progress" TO "authenticated";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."bible_progress" TO "authenticated";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."bible_progress" TO "authenticated";
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."bible_progress" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."bible_progress" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."bible_progress" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."bible_progress" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."bible_progress" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."bible_progress" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."bible_progress" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."bible_progress" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."bible_progress" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."bible_progress" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."bible_progress" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."bible_progress" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."bible_progress" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."bible_progress" TO "service_role";

-- Table: public."bible_reflections" | relkind=r | force_rls=false
CREATE TABLE public."bible_reflections" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "member_email" text NOT NULL,
  "day_number" integer NOT NULL,
  "scripture_ref" text NOT NULL,
  "text" text NOT NULL,
  "share_personalization" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "said" text,
  "will_do" text
);
ALTER TABLE ONLY public."bible_reflections" ADD CONSTRAINT "bible_reflections_member_email_day_number_key" UNIQUE (member_email, day_number);
ALTER TABLE ONLY public."bible_reflections" ADD CONSTRAINT "bible_reflections_pkey" PRIMARY KEY (id);
ALTER TABLE public."bible_reflections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public."bible_reflections" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX bible_reflections_member_email_day_number_key ON public.bible_reflections USING btree (member_email, day_number);
CREATE UNIQUE INDEX bible_reflections_pkey ON public.bible_reflections USING btree (id);
CREATE INDEX idx_bible_reflections_email_day ON public.bible_reflections USING btree (member_email, day_number DESC);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."bible_reflections" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."bible_reflections" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."bible_reflections" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."bible_reflections" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."bible_reflections" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."bible_reflections" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."bible_reflections" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."bible_reflections" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."bible_reflections" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."bible_reflections" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."bible_reflections" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."bible_reflections" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."bible_reflections" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."bible_reflections" TO "service_role";

-- Table: public."bible_verses" | relkind=r | force_rls=false
-- Owned scripture library. Berean Standard Bible (public domain). Serves Bible 365 and the Governor via the bible-verses edge function; replaces bible-api.com. Service-role access only, no public policies, per house rule.
CREATE TABLE public."bible_verses" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "translation" text DEFAULT 'BSB'::text NOT NULL,
  "book_num" integer NOT NULL,
  "book" text NOT NULL,
  "chapter" integer NOT NULL,
  "verse" integer NOT NULL,
  "text" text NOT NULL
);
ALTER TABLE ONLY public."bible_verses" ADD CONSTRAINT "bible_verses_pkey" PRIMARY KEY (id);
ALTER TABLE public."bible_verses" ENABLE ROW LEVEL SECURITY;
CREATE INDEX bible_verses_book_idx ON public.bible_verses USING btree (book, chapter);
CREATE UNIQUE INDEX bible_verses_pkey ON public.bible_verses USING btree (id);
CREATE UNIQUE INDEX bible_verses_ref_idx ON public.bible_verses USING btree (translation, book_num, chapter, verse);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."bible_verses" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."bible_verses" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."bible_verses" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."bible_verses" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."bible_verses" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."bible_verses" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."bible_verses" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."bible_verses" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."bible_verses" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."bible_verses" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."bible_verses" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."bible_verses" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."bible_verses" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."bible_verses" TO "service_role";

-- Table: public."book_intros" | relkind=r | force_rls=false
CREATE TABLE public."book_intros" (
  "book" text NOT NULL,
  "what_this_is" text NOT NULL,
  "who_its_for" text NOT NULL,
  "what_to_watch_for" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."book_intros" ADD CONSTRAINT "book_intros_pkey" PRIMARY KEY (book);
ALTER TABLE public."book_intros" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public."book_intros" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX book_intros_pkey ON public.book_intros USING btree (book);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."book_intros" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."book_intros" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."book_intros" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."book_intros" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."book_intros" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."book_intros" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."book_intros" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."book_intros" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."book_intros" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."book_intros" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."book_intros" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."book_intros" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."book_intros" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."book_intros" TO "service_role";

-- Table: public."bundle_orders" | relkind=r | force_rls=false
CREATE TABLE public."bundle_orders" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "email" text NOT NULL,
  "bundle_key" text NOT NULL,
  "bundle_name" text,
  "ship_name" text,
  "ship_phone" text,
  "ship_address1" text,
  "ship_address2" text,
  "ship_city" text,
  "ship_state" text,
  "ship_zip" text,
  "ship_country" text DEFAULT 'US'::text,
  "status" text DEFAULT 'pending'::text,
  "source" text,
  "hold_until" date,
  "created_at" timestamp with time zone DEFAULT now(),
  "confirmed_at" timestamp with time zone,
  "shipped_at" timestamp with time zone
);
ALTER TABLE ONLY public."bundle_orders" ADD CONSTRAINT "bundle_orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."bundle_orders" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX bundle_orders_pkey ON public.bundle_orders USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."bundle_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."bundle_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."bundle_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."bundle_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."bundle_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."bundle_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."bundle_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."bundle_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."bundle_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."bundle_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."bundle_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."bundle_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."bundle_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."bundle_orders" TO "service_role";

-- Table: public."bundle_subscriptions" | relkind=r | force_rls=false
CREATE TABLE public."bundle_subscriptions" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "email" text NOT NULL,
  "full_name" text,
  "bundle_key" text NOT NULL,
  "bundle_name" text,
  "ship_name" text,
  "ship_phone" text,
  "ship_address1" text,
  "ship_address2" text,
  "ship_city" text,
  "ship_state" text,
  "ship_zip" text,
  "ship_country" text DEFAULT 'US'::text,
  "auto_order" boolean DEFAULT true,
  "status" text DEFAULT 'active'::text,
  "next_eligible_date" date,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public."bundle_subscriptions" ADD CONSTRAINT "bundle_subscriptions_email_key" UNIQUE (email);
ALTER TABLE ONLY public."bundle_subscriptions" ADD CONSTRAINT "bundle_subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."bundle_subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX bundle_subscriptions_email_key ON public.bundle_subscriptions USING btree (email);
CREATE UNIQUE INDEX bundle_subscriptions_pkey ON public.bundle_subscriptions USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."bundle_subscriptions" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."bundle_subscriptions" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."bundle_subscriptions" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."bundle_subscriptions" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."bundle_subscriptions" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."bundle_subscriptions" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."bundle_subscriptions" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."bundle_subscriptions" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."bundle_subscriptions" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."bundle_subscriptions" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."bundle_subscriptions" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."bundle_subscriptions" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."bundle_subscriptions" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."bundle_subscriptions" TO "service_role";

-- Table: public."challenge_cohorts" | relkind=r | force_rls=false
-- Rhythm Mechanics Page 3: thirty-day fast cohorts. One start date, one board. Service-role only.
CREATE TABLE public."challenge_cohorts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status" text DEFAULT 'open'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" text
);
ALTER TABLE ONLY public."challenge_cohorts" ADD CONSTRAINT "challenge_cohorts_pkey" PRIMARY KEY (id);
ALTER TABLE public."challenge_cohorts" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX challenge_cohorts_pkey ON public.challenge_cohorts USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."challenge_cohorts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."challenge_cohorts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."challenge_cohorts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."challenge_cohorts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."challenge_cohorts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."challenge_cohorts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."challenge_cohorts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."challenge_cohorts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."challenge_cohorts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."challenge_cohorts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."challenge_cohorts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."challenge_cohorts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."challenge_cohorts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."challenge_cohorts" TO "service_role";

-- Table: public."circle_members" | relkind=r | force_rls=false
CREATE TABLE public."circle_members" (
  "circle_id" uuid NOT NULL,
  "member_id" bigint NOT NULL,
  "role" text DEFAULT 'member'::text NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."circle_members" ADD CONSTRAINT "circle_members_circle_id_fkey" FOREIGN KEY (circle_id) REFERENCES circles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."circle_members" ADD CONSTRAINT "circle_members_circle_id_member_id_key" UNIQUE (circle_id, member_id);
ALTER TABLE public."circle_members" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX circle_members_circle_id_member_id_key ON public.circle_members USING btree (circle_id, member_id);
CREATE INDEX circle_members_member_idx ON public.circle_members USING btree (member_id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."circle_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."circle_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."circle_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."circle_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."circle_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."circle_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."circle_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."circle_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."circle_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."circle_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."circle_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."circle_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."circle_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."circle_members" TO "service_role";

-- Table: public."circle_prays" | relkind=r | force_rls=false
-- Page 5: pray-gesture events. Decision 10: up to 3 per (from_member, for_member, day), enforced in circle-nudge, not by constraint.
CREATE TABLE public."circle_prays" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "circle_id" uuid NOT NULL,
  "from_member" bigint NOT NULL,
  "for_member" bigint NOT NULL,
  "day" date DEFAULT CURRENT_DATE NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "nth" integer NOT NULL
);
ALTER TABLE ONLY public."circle_prays" ADD CONSTRAINT "circle_prays_circle_id_fkey" FOREIGN KEY (circle_id) REFERENCES circles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."circle_prays" ADD CONSTRAINT "circle_prays_nth_range" CHECK (nth >= 1 AND nth <= 3);
ALTER TABLE ONLY public."circle_prays" ADD CONSTRAINT "circle_prays_nth_uniq" UNIQUE (circle_id, from_member, for_member, day, nth);
-- Atomic cap: at most 3 prays per (from,for,day). nth in 1..3, each unique, so races cannot exceed 3.
ALTER TABLE ONLY public."circle_prays" ADD CONSTRAINT "circle_prays_pkey" PRIMARY KEY (id);
ALTER TABLE public."circle_prays" ENABLE ROW LEVEL SECURITY;
CREATE INDEX circle_prays_lookup_idx ON public.circle_prays USING btree (circle_id, from_member, for_member, day);
CREATE UNIQUE INDEX circle_prays_nth_uniq ON public.circle_prays USING btree (circle_id, from_member, for_member, day, nth);
CREATE UNIQUE INDEX circle_prays_pkey ON public.circle_prays USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."circle_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."circle_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."circle_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."circle_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."circle_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."circle_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."circle_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."circle_prays" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."circle_prays" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."circle_prays" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."circle_prays" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."circle_prays" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."circle_prays" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."circle_prays" TO "service_role";

-- Table: public."circles" | relkind=r | force_rls=false
CREATE TABLE public."circles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "invite_code" text NOT NULL,
  "created_by" bigint NOT NULL,
  "max_size" integer DEFAULT 7 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."circles" ADD CONSTRAINT "circles_invite_code_key" UNIQUE (invite_code);
ALTER TABLE ONLY public."circles" ADD CONSTRAINT "circles_pkey" PRIMARY KEY (id);
ALTER TABLE public."circles" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX circles_invite_code_key ON public.circles USING btree (invite_code);
CREATE UNIQUE INDEX circles_pkey ON public.circles USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."circles" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."circles" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."circles" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."circles" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."circles" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."circles" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."circles" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."circles" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."circles" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."circles" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."circles" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."circles" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."circles" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."circles" TO "service_role";

-- Table: public."commission_payouts" | relkind=r | force_rls=false
CREATE TABLE public."commission_payouts" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "ambassador_id" bigint NOT NULL,
  "amount" numeric(10,2) NOT NULL,
  "referral_count" integer DEFAULT 0 NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "method" text DEFAULT 'stripe'::text NOT NULL,
  "stripe_transfer_id" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
ALTER TABLE ONLY public."commission_payouts" ADD CONSTRAINT "commission_payouts_ambassador_id_fkey" FOREIGN KEY (ambassador_id) REFERENCES ambassadors(id);
ALTER TABLE ONLY public."commission_payouts" ADD CONSTRAINT "commission_payouts_method_check" CHECK (method = ANY (ARRAY['stripe'::text, 'manual'::text, 'paypal'::text]));
ALTER TABLE ONLY public."commission_payouts" ADD CONSTRAINT "commission_payouts_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."commission_payouts" ADD CONSTRAINT "commission_payouts_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]));
ALTER TABLE public."commission_payouts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public."commission_payouts" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX commission_payouts_pkey ON public.commission_payouts USING btree (id);
CREATE INDEX idx_payouts_ambassador_id ON public.commission_payouts USING btree (ambassador_id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."commission_payouts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."commission_payouts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."commission_payouts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."commission_payouts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."commission_payouts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."commission_payouts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."commission_payouts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."commission_payouts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."commission_payouts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."commission_payouts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."commission_payouts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."commission_payouts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."commission_payouts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."commission_payouts" TO "service_role";

-- Table: public."daily_logs" | relkind=r | force_rls=false
CREATE TABLE public."daily_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "log_date" date DEFAULT CURRENT_DATE NOT NULL,
  "drank_powder" boolean DEFAULT false,
  "skipped_second_cup" boolean DEFAULT false,
  "energy_stability" integer,
  "presence_score" integer,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public."daily_logs" ADD CONSTRAINT "daily_logs_energy_stability_check" CHECK (energy_stability >= 0 AND energy_stability <= 100);
ALTER TABLE ONLY public."daily_logs" ADD CONSTRAINT "daily_logs_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."daily_logs" ADD CONSTRAINT "daily_logs_presence_score_check" CHECK (presence_score >= 1 AND presence_score <= 10);
ALTER TABLE ONLY public."daily_logs" ADD CONSTRAINT "daily_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."daily_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_insert_own_logs" ON public."daily_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "authenticated_read_own_logs" ON public."daily_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "authenticated_update_own_logs" ON public."daily_logs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE UNIQUE INDEX daily_logs_pkey ON public.daily_logs USING btree (id);
CREATE UNIQUE INDEX idx_user_daily_log ON public.daily_logs USING btree (user_id, log_date);
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."daily_logs" TO "authenticated";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."daily_logs" TO "authenticated";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."daily_logs" TO "authenticated";
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."daily_logs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."daily_logs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."daily_logs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."daily_logs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."daily_logs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."daily_logs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."daily_logs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."daily_logs" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."daily_logs" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."daily_logs" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."daily_logs" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."daily_logs" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."daily_logs" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."daily_logs" TO "service_role";

-- Table: public."email_log" | relkind=r | force_rls=false
-- Every transactional email send (service-role only). status: sent|failed.
CREATE TABLE public."email_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "to_email" text NOT NULL,
  "template" text NOT NULL,
  "subject" text,
  "status" text DEFAULT 'sent'::text NOT NULL,
  "resend_id" text,
  "error" text,
  "meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."email_log" ADD CONSTRAINT "email_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."email_log" ENABLE ROW LEVEL SECURITY;
CREATE INDEX email_log_created_idx ON public.email_log USING btree (created_at DESC);
CREATE UNIQUE INDEX email_log_pkey ON public.email_log USING btree (id);
CREATE INDEX email_log_to_idx ON public.email_log USING btree (to_email);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."email_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."email_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."email_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."email_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."email_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."email_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."email_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."email_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."email_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."email_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."email_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."email_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."email_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."email_log" TO "service_role";

-- Table: public."fast_history" | relkind=r | force_rls=false
CREATE TABLE public."fast_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "member_email" text NOT NULL,
  "model" text,
  "duration" integer,
  "ended_day" integer,
  "finished" boolean,
  "weak_rule" text,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public."fast_history" ADD CONSTRAINT "fast_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."fast_history" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX fast_history_pkey ON public.fast_history USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."fast_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."fast_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."fast_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."fast_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."fast_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."fast_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."fast_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."fast_history" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."fast_history" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."fast_history" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."fast_history" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."fast_history" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."fast_history" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."fast_history" TO "service_role";

-- Table: public."fasts" | relkind=r | force_rls=false
CREATE TABLE public."fasts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "member_email" text NOT NULL,
  "status" text,
  "fast_model" jsonb,
  "whys" jsonb,
  "laid" jsonb,
  "exclusions" jsonb,
  "duration" integer,
  "start_date" date,
  "anchors" jsonb,
  "carried" text,
  "product_state" text,
  "bundle_key" text,
  "structure_only" boolean DEFAULT false,
  "plan" jsonb,
  "briefs" jsonb DEFAULT '{}'::jsonb,
  "synthesis" text,
  "ack_timestamp" timestamp with time zone NOT NULL,
  "ended_day" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "ended_at" timestamp with time zone,
  "prayer_id" uuid,
  "cohort_id" uuid
);
ALTER TABLE ONLY public."fasts" ADD CONSTRAINT "fasts_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."fasts" ADD CONSTRAINT "fasts_prayer_id_fkey" FOREIGN KEY (prayer_id) REFERENCES prayers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public."fasts" ADD CONSTRAINT "fasts_status_check" CHECK (status = ANY (ARRAY['revealed'::text, 'active'::text, 'completed'::text, 'ended_early'::text]));
ALTER TABLE public."fasts" ENABLE ROW LEVEL SECURITY;
CREATE INDEX fasts_member_email_created_at_idx ON public.fasts USING btree (member_email, created_at DESC);
CREATE UNIQUE INDEX fasts_pkey ON public.fasts USING btree (id);
CREATE INDEX fasts_prayer_idx ON public.fasts USING btree (prayer_id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."fasts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."fasts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."fasts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."fasts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."fasts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."fasts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."fasts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."fasts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."fasts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."fasts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."fasts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."fasts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."fasts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."fasts" TO "service_role";

-- Table: public."habit_ledgers" | relkind=r | force_rls=false
CREATE TABLE public."habit_ledgers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "habit_date" date NOT NULL,
  "completed" boolean DEFAULT false,
  "current_streak" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "score" integer DEFAULT 0
);
ALTER TABLE ONLY public."habit_ledgers" ADD CONSTRAINT "habit_ledgers_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."habit_ledgers" ADD CONSTRAINT "habit_ledgers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES whealthy_users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."habit_ledgers" ADD CONSTRAINT "habit_ledgers_user_id_habit_date_key" UNIQUE (user_id, habit_date);
ALTER TABLE public."habit_ledgers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_insert_own_habits" ON public."habit_ledgers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "authenticated_read_own_habits" ON public."habit_ledgers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "authenticated_update_own_habits" ON public."habit_ledgers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE UNIQUE INDEX habit_ledgers_pkey ON public.habit_ledgers USING btree (id);
CREATE UNIQUE INDEX habit_ledgers_user_id_habit_date_key ON public.habit_ledgers USING btree (user_id, habit_date);
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."habit_ledgers" TO "authenticated";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."habit_ledgers" TO "authenticated";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."habit_ledgers" TO "authenticated";
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."habit_ledgers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."habit_ledgers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."habit_ledgers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."habit_ledgers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."habit_ledgers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."habit_ledgers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."habit_ledgers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."habit_ledgers" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."habit_ledgers" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."habit_ledgers" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."habit_ledgers" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."habit_ledgers" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."habit_ledgers" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."habit_ledgers" TO "service_role";

-- Table: public."member_ai_prefs" | relkind=r | force_rls=false
CREATE TABLE public."member_ai_prefs" (
  "member_email" text NOT NULL,
  "scribe_style" text DEFAULT 'full'::text,
  "landed" integer DEFAULT 0,
  "missed" integer DEFAULT 0,
  "last_scribe_lines" jsonb DEFAULT '[]'::jsonb,
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public."member_ai_prefs" ADD CONSTRAINT "member_ai_prefs_pkey" PRIMARY KEY (member_email);
ALTER TABLE ONLY public."member_ai_prefs" ADD CONSTRAINT "member_ai_prefs_scribe_style_check" CHECK (scribe_style = ANY (ARRAY['full'::text, 'brief'::text]));
ALTER TABLE public."member_ai_prefs" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX member_ai_prefs_pkey ON public.member_ai_prefs USING btree (member_email);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."member_ai_prefs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."member_ai_prefs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."member_ai_prefs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."member_ai_prefs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."member_ai_prefs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."member_ai_prefs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."member_ai_prefs" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."member_ai_prefs" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."member_ai_prefs" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."member_ai_prefs" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."member_ai_prefs" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."member_ai_prefs" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."member_ai_prefs" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."member_ai_prefs" TO "service_role";

-- Table: public."member_onboarding_queue" | relkind=r | force_rls=false
CREATE TABLE public."member_onboarding_queue" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "member_email" text NOT NULL,
  "kind" text NOT NULL,
  "scheduled_at" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone,
  "skipped" boolean DEFAULT false NOT NULL,
  "skip_reason" text,
  "cancelled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."member_onboarding_queue" ADD CONSTRAINT "member_onboarding_queue_member_email_kind_key" UNIQUE (member_email, kind);
ALTER TABLE ONLY public."member_onboarding_queue" ADD CONSTRAINT "member_onboarding_queue_pkey" PRIMARY KEY (id);
ALTER TABLE public."member_onboarding_queue" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX member_onboarding_queue_member_email_kind_key ON public.member_onboarding_queue USING btree (member_email, kind);
CREATE UNIQUE INDEX member_onboarding_queue_pkey ON public.member_onboarding_queue USING btree (id);
CREATE INDEX moq_due_idx ON public.member_onboarding_queue USING btree (scheduled_at) WHERE ((sent_at IS NULL) AND (cancelled = false));
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."member_onboarding_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."member_onboarding_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."member_onboarding_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."member_onboarding_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."member_onboarding_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."member_onboarding_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."member_onboarding_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."member_onboarding_queue" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."member_onboarding_queue" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."member_onboarding_queue" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."member_onboarding_queue" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."member_onboarding_queue" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."member_onboarding_queue" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."member_onboarding_queue" TO "service_role";

-- Table: public."member_orders" | relkind=r | force_rls=false
-- Shopify orders synced by webhook, matched to a member by email. Service-role only; read via member-orders edge fn.
CREATE TABLE public."member_orders" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "shopify_order_id" text NOT NULL,
  "order_number" text,
  "email" text,
  "member_email" text,
  "financial_status" text,
  "fulfillment_status" text,
  "line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "total_price" numeric,
  "currency" text,
  "tracking_company" text,
  "tracking_number" text,
  "tracking_url" text,
  "ordered_at" timestamp with time zone,
  "fulfilled_at" timestamp with time zone,
  "raw" jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."member_orders" ADD CONSTRAINT "member_orders_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."member_orders" ADD CONSTRAINT "member_orders_shopify_order_id_key" UNIQUE (shopify_order_id);
ALTER TABLE public."member_orders" ENABLE ROW LEVEL SECURITY;
CREATE INDEX member_orders_member_idx ON public.member_orders USING btree (member_email, ordered_at DESC);
CREATE UNIQUE INDEX member_orders_pkey ON public.member_orders USING btree (id);
CREATE UNIQUE INDEX member_orders_shopify_order_id_key ON public.member_orders USING btree (shopify_order_id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."member_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."member_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."member_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."member_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."member_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."member_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."member_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."member_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."member_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."member_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."member_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."member_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."member_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."member_orders" TO "service_role";

-- Table: public."member_prayer_state" | relkind=r | force_rls=false
CREATE TABLE public."member_prayer_state" (
  "member_id" bigint NOT NULL,
  "midday_next_movement" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "unaware_empty_seen" boolean DEFAULT false NOT NULL
);
ALTER TABLE ONLY public."member_prayer_state" ADD CONSTRAINT "member_prayer_state_member_id_fkey" FOREIGN KEY (member_id) REFERENCES approved_members(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."member_prayer_state" ADD CONSTRAINT "member_prayer_state_midday_next_movement_check" CHECK (midday_next_movement >= 1 AND midday_next_movement <= 6);
ALTER TABLE ONLY public."member_prayer_state" ADD CONSTRAINT "member_prayer_state_pkey" PRIMARY KEY (member_id);
ALTER TABLE public."member_prayer_state" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public."member_prayer_state" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX member_prayer_state_pkey ON public.member_prayer_state USING btree (member_id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."member_prayer_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."member_prayer_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."member_prayer_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."member_prayer_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."member_prayer_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."member_prayer_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."member_prayer_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."member_prayer_state" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."member_prayer_state" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."member_prayer_state" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."member_prayer_state" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."member_prayer_state" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."member_prayer_state" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."member_prayer_state" TO "service_role";

-- Table: public."member_profile" | relkind=r | force_rls=false
CREATE TABLE public."member_profile" (
  "member_email" text NOT NULL,
  "season" text,
  "identity_profile" text,
  "archetype" text,
  "recurring_people" jsonb DEFAULT '[]'::jsonb,
  "recurring_burdens" jsonb DEFAULT '[]'::jsonb,
  "recurring_wins" jsonb DEFAULT '[]'::jsonb,
  "scripture_comfort" integer DEFAULT 1,
  "scripture_engaged" integer DEFAULT 0,
  "themes_that_land" jsonb DEFAULT '[]'::jsonb,
  "tone_pref" text DEFAULT 'standard'::text,
  "responds_to" jsonb DEFAULT '[]'::jsonb,
  "goes_quiet_on" jsonb DEFAULT '[]'::jsonb,
  "last_summary" text,
  "interaction_count" integer DEFAULT 0,
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public."member_profile" ADD CONSTRAINT "member_profile_pkey" PRIMARY KEY (member_email);
ALTER TABLE ONLY public."member_profile" ADD CONSTRAINT "member_profile_scripture_comfort_check" CHECK (scripture_comfort >= 1 AND scripture_comfort <= 5);
ALTER TABLE public."member_profile" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX member_profile_pkey ON public.member_profile USING btree (member_email);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."member_profile" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."member_profile" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."member_profile" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."member_profile" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."member_profile" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."member_profile" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."member_profile" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."member_profile" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."member_profile" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."member_profile" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."member_profile" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."member_profile" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."member_profile" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."member_profile" TO "service_role";

-- Table: public."my_bible_marks" | relkind=r | force_rls=false
CREATE TABLE public."my_bible_marks" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "member_id" bigint NOT NULL,
  "book" text NOT NULL,
  "chapter" integer NOT NULL,
  "verse" integer NOT NULL,
  "kind" text NOT NULL,
  "body" text,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public."my_bible_marks" ADD CONSTRAINT "my_bible_marks_kind_check" CHECK (kind = ANY (ARRAY['highlight'::text, 'note'::text]));
ALTER TABLE ONLY public."my_bible_marks" ADD CONSTRAINT "my_bible_marks_member_id_fkey" FOREIGN KEY (member_id) REFERENCES approved_members(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."my_bible_marks" ADD CONSTRAINT "my_bible_marks_pkey" PRIMARY KEY (id);
ALTER TABLE public."my_bible_marks" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX my_bible_marks_hl_uniq ON public.my_bible_marks USING btree (member_id, book, chapter, verse) WHERE (kind = 'highlight'::text);
CREATE INDEX my_bible_marks_member_idx ON public.my_bible_marks USING btree (member_id, book, chapter);
CREATE UNIQUE INDEX my_bible_marks_pkey ON public.my_bible_marks USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."my_bible_marks" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."my_bible_marks" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."my_bible_marks" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."my_bible_marks" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."my_bible_marks" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."my_bible_marks" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."my_bible_marks" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."my_bible_marks" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."my_bible_marks" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."my_bible_marks" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."my_bible_marks" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."my_bible_marks" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."my_bible_marks" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."my_bible_marks" TO "service_role";

-- Table: public."my_bible_state" | relkind=r | force_rls=false
CREATE TABLE public."my_bible_state" (
  "member_id" bigint NOT NULL,
  "book" text,
  "chapter" integer,
  "verse" integer,
  "mode" text DEFAULT 'my_bible'::text,
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public."my_bible_state" ADD CONSTRAINT "my_bible_state_member_id_fkey" FOREIGN KEY (member_id) REFERENCES approved_members(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."my_bible_state" ADD CONSTRAINT "my_bible_state_pkey" PRIMARY KEY (member_id);
ALTER TABLE public."my_bible_state" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX my_bible_state_pkey ON public.my_bible_state USING btree (member_id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."my_bible_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."my_bible_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."my_bible_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."my_bible_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."my_bible_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."my_bible_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."my_bible_state" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."my_bible_state" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."my_bible_state" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."my_bible_state" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."my_bible_state" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."my_bible_state" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."my_bible_state" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."my_bible_state" TO "service_role";

-- Table: public."nurture_queue" | relkind=r | force_rls=false
CREATE TABLE public."nurture_queue" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "email" text NOT NULL,
  "first_name" text,
  "archetype_key" text NOT NULL,
  "bundle_key" text,
  "position" integer NOT NULL,
  "scheduled_at" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone,
  "cancelled" boolean DEFAULT false,
  "cancel_reason" text,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public."nurture_queue" ADD CONSTRAINT "nurture_queue_pkey" PRIMARY KEY (id);
ALTER TABLE public."nurture_queue" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_nurture_due ON public.nurture_queue USING btree (scheduled_at) WHERE ((sent_at IS NULL) AND (cancelled = false));
CREATE INDEX idx_nurture_email ON public.nurture_queue USING btree (lower(email));
CREATE INDEX idx_nurture_email_position ON public.nurture_queue USING btree (email, "position");
CREATE UNIQUE INDEX nurture_queue_pkey ON public.nurture_queue USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."nurture_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."nurture_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."nurture_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."nurture_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."nurture_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."nurture_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."nurture_queue" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."nurture_queue" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."nurture_queue" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."nurture_queue" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."nurture_queue" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."nurture_queue" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."nurture_queue" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."nurture_queue" TO "service_role";

-- Table: public."page_events" | relkind=r | force_rls=false
CREATE TABLE public."page_events" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "session_id" text NOT NULL,
  "event_type" text NOT NULL,
  "event_data" jsonb DEFAULT '{}'::jsonb,
  "page" text DEFAULT '/'::text NOT NULL,
  "referral_code" text,
  "device_type" text,
  "viewport_width" integer,
  "time_on_page" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."page_events" ADD CONSTRAINT "page_events_pkey" PRIMARY KEY (id);
ALTER TABLE public."page_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public."page_events" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);
CREATE INDEX idx_page_events_created ON public.page_events USING btree (created_at);
CREATE INDEX idx_page_events_referral ON public.page_events USING btree (referral_code) WHERE (referral_code IS NOT NULL);
CREATE INDEX idx_page_events_session ON public.page_events USING btree (session_id);
CREATE INDEX idx_page_events_session_type ON public.page_events USING btree (session_id, event_type);
CREATE INDEX idx_page_events_type ON public.page_events USING btree (event_type);
CREATE INDEX idx_page_events_type_created ON public.page_events USING btree (event_type, created_at);
CREATE UNIQUE INDEX page_events_pkey ON public.page_events USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."page_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."page_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."page_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."page_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."page_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."page_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."page_events" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."page_events" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."page_events" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."page_events" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."page_events" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."page_events" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."page_events" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."page_events" TO "service_role";

-- Table: public."pending_registrations" | relkind=r | force_rls=false
CREATE TABLE public."pending_registrations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "skool_handle" text,
  "note" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."pending_registrations" ADD CONSTRAINT "pending_registrations_pkey" PRIMARY KEY (id);
ALTER TABLE public."pending_registrations" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX pending_reg_one_open ON public.pending_registrations USING btree (lower(email)) WHERE (status = 'pending'::text);
CREATE INDEX pending_reg_status_idx ON public.pending_registrations USING btree (status, created_at);
CREATE UNIQUE INDEX pending_registrations_pkey ON public.pending_registrations USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."pending_registrations" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."pending_registrations" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."pending_registrations" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."pending_registrations" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."pending_registrations" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."pending_registrations" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."pending_registrations" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."pending_registrations" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."pending_registrations" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."pending_registrations" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."pending_registrations" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."pending_registrations" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."pending_registrations" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."pending_registrations" TO "service_role";

-- Table: public."portal_orders" | relkind=r | force_rls=false
CREATE TABLE public."portal_orders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "stripe_session_id" text NOT NULL,
  "amount_total" integer NOT NULL,
  "currency" text DEFAULT 'usd'::text NOT NULL,
  "product_name" text NOT NULL,
  "status" text DEFAULT 'completed'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE ONLY public."portal_orders" ADD CONSTRAINT "portal_orders_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."portal_orders" ADD CONSTRAINT "portal_orders_stripe_session_id_key" UNIQUE (stripe_session_id);
ALTER TABLE ONLY public."portal_orders" ADD CONSTRAINT "portal_orders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public."portal_orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_own_portal_orders" ON public."portal_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE UNIQUE INDEX portal_orders_pkey ON public.portal_orders USING btree (id);
CREATE UNIQUE INDEX portal_orders_stripe_session_id_key ON public.portal_orders USING btree (stripe_session_id);
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."portal_orders" TO "authenticated";
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."portal_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."portal_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."portal_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."portal_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."portal_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."portal_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."portal_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."portal_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."portal_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."portal_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."portal_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."portal_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."portal_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."portal_orders" TO "service_role";

-- Table: public."prayers" | relkind=r | force_rls=false
CREATE TABLE public."prayers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "member_id" bigint NOT NULL,
  "body" text NOT NULL,
  "category" text NOT NULL,
  "state" text DEFAULT 'not_yet'::text NOT NULL,
  "asked_on" date DEFAULT CURRENT_DATE NOT NULL,
  "closed_on" date,
  "outcome" text,
  "pinned" boolean DEFAULT false NOT NULL,
  "last_surfaced_at" timestamp with time zone,
  "last_milestone_asked" integer DEFAULT 0 NOT NULL,
  "wall_post_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."prayers" ADD CONSTRAINT "close_is_complete" CHECK (state = 'not_yet'::text AND closed_on IS NULL AND outcome IS NULL OR (state = ANY (ARRAY['yes'::text, 'no'::text])) AND closed_on IS NOT NULL AND outcome IS NOT NULL);
ALTER TABLE ONLY public."prayers" ADD CONSTRAINT "prayers_body_check" CHECK (char_length(TRIM(BOTH FROM body)) >= 1 AND char_length(TRIM(BOTH FROM body)) <= 1000);
ALTER TABLE ONLY public."prayers" ADD CONSTRAINT "prayers_category_check" CHECK (category = ANY (ARRAY['household'::text, 'soul'::text, 'provision'::text, 'brothers'::text, 'unaware'::text, 'family'::text, 'work'::text, 'money'::text, 'health'::text, 'head'::text, 'freeform'::text]));
ALTER TABLE ONLY public."prayers" ADD CONSTRAINT "prayers_member_id_fkey" FOREIGN KEY (member_id) REFERENCES approved_members(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."prayers" ADD CONSTRAINT "prayers_outcome_check" CHECK (outcome IS NULL OR char_length(TRIM(BOTH FROM outcome)) >= 1 AND char_length(TRIM(BOTH FROM outcome)) <= 1000);
ALTER TABLE ONLY public."prayers" ADD CONSTRAINT "prayers_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."prayers" ADD CONSTRAINT "prayers_state_check" CHECK (state = ANY (ARRAY['not_yet'::text, 'yes'::text, 'no'::text]));
ALTER TABLE ONLY public."prayers" ADD CONSTRAINT "prayers_wall_post_id_fkey" FOREIGN KEY (wall_post_id) REFERENCES wall_posts(id) ON DELETE SET NULL;
ALTER TABLE ONLY public."prayers" ADD CONSTRAINT "unaware_never_publishes" CHECK (NOT (category = 'unaware'::text AND wall_post_id IS NOT NULL));
ALTER TABLE public."prayers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public."prayers" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);
CREATE INDEX prayers_member_state_idx ON public.prayers USING btree (member_id, state);
CREATE INDEX prayers_milestone_idx ON public.prayers USING btree (member_id, state, asked_on);
CREATE UNIQUE INDEX prayers_pkey ON public.prayers USING btree (id);
CREATE INDEX prayers_surface_idx ON public.prayers USING btree (member_id, state, pinned DESC, last_surfaced_at NULLS FIRST);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."prayers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."prayers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."prayers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."prayers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."prayers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."prayers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."prayers" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."prayers" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."prayers" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."prayers" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."prayers" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."prayers" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."prayers" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."prayers" TO "service_role";

-- Table: public."product_timing" | relkind=r | force_rls=false
CREATE TABLE public."product_timing" (
  "product_key" text NOT NULL,
  "display_name" text NOT NULL,
  "form" text,
  "has_caffeine" boolean DEFAULT false NOT NULL,
  "default_domain" text DEFAULT 'supplement'::text NOT NULL,
  "dose_text" text,
  "with_food" text,
  "timing" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "warnings" text,
  "active" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."product_timing" ADD CONSTRAINT "product_timing_pkey" PRIMARY KEY (product_key);
ALTER TABLE public."product_timing" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX product_timing_pkey ON public.product_timing USING btree (product_key);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."product_timing" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."product_timing" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."product_timing" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."product_timing" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."product_timing" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."product_timing" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."product_timing" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."product_timing" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."product_timing" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."product_timing" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."product_timing" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."product_timing" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."product_timing" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."product_timing" TO "service_role";

-- Table: public."quiz_history" | relkind=r | force_rls=false
CREATE TABLE public."quiz_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "archetype" text,
  "scores" jsonb,
  "answers" jsonb,
  "taken_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public."quiz_history" ADD CONSTRAINT "quiz_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."quiz_history" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX quiz_history_pkey ON public.quiz_history USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."quiz_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."quiz_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."quiz_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."quiz_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."quiz_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."quiz_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."quiz_history" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."quiz_history" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."quiz_history" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."quiz_history" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."quiz_history" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."quiz_history" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."quiz_history" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."quiz_history" TO "service_role";

-- Table: public."record_entries" | relkind=r | force_rls=false
CREATE TABLE public."record_entries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "member_email" text NOT NULL,
  "entry_date" date NOT NULL,
  "text" text,
  "tone" text,
  "fast_id" uuid,
  "fast_day" integer,
  "scribe_line" text,
  "resurface" jsonb,
  "burned" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public."record_entries" ADD CONSTRAINT "record_entries_member_email_entry_date_key" UNIQUE (member_email, entry_date);
ALTER TABLE ONLY public."record_entries" ADD CONSTRAINT "record_entries_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."record_entries" ADD CONSTRAINT "record_entries_tone_check" CHECK (tone = ANY (ARRAY['heavy'::text, 'win'::text, 'mixed'::text]));
ALTER TABLE public."record_entries" ENABLE ROW LEVEL SECURITY;
CREATE INDEX record_entries_member_email_entry_date_idx ON public.record_entries USING btree (member_email, entry_date DESC);
CREATE UNIQUE INDEX record_entries_member_email_entry_date_key ON public.record_entries USING btree (member_email, entry_date);
CREATE UNIQUE INDEX record_entries_pkey ON public.record_entries USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."record_entries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."record_entries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."record_entries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."record_entries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."record_entries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."record_entries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."record_entries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."record_entries" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."record_entries" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."record_entries" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."record_entries" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."record_entries" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."record_entries" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."record_entries" TO "service_role";

-- Table: public."referrals" | relkind=r | force_rls=false
CREATE TABLE public."referrals" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "ambassador_id" bigint NOT NULL,
  "referral_code" text NOT NULL,
  "referred_email" text,
  "referred_name" text,
  "status" text DEFAULT 'clicked'::text NOT NULL,
  "archetype" text,
  "bundle_key" text,
  "order_amount" numeric(10,2),
  "commission_amount" numeric(10,2),
  "commission_status" text DEFAULT 'pending'::text NOT NULL,
  "commission_paid_at" timestamp with time zone,
  "stripe_payment_id" text,
  "stripe_transfer_id" text,
  "ip_hash" text,
  "user_agent" text,
  "landing_page" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."referrals" ADD CONSTRAINT "referrals_ambassador_id_fkey" FOREIGN KEY (ambassador_id) REFERENCES ambassadors(id);
ALTER TABLE ONLY public."referrals" ADD CONSTRAINT "referrals_commission_status_check" CHECK (commission_status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text, 'voided'::text]));
ALTER TABLE ONLY public."referrals" ADD CONSTRAINT "referrals_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."referrals" ADD CONSTRAINT "referrals_status_check" CHECK (status = ANY (ARRAY['clicked'::text, 'quiz_started'::text, 'quiz_completed'::text, 'converted'::text, 'churned'::text]));
ALTER TABLE public."referrals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public."referrals" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);
CREATE INDEX idx_referrals_ambassador_id ON public.referrals USING btree (ambassador_id);
CREATE INDEX idx_referrals_commission_status ON public.referrals USING btree (commission_status);
CREATE INDEX idx_referrals_referral_code ON public.referrals USING btree (referral_code);
CREATE INDEX idx_referrals_referred_email ON public.referrals USING btree (referred_email);
CREATE INDEX idx_referrals_status ON public.referrals USING btree (status);
CREATE UNIQUE INDEX referrals_pkey ON public.referrals USING btree (id);
-- NON-EXECUTABLE trigger definition: CREATE TRIGGER set_updated_at_referrals BEFORE UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION update_updated_at()
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."referrals" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."referrals" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."referrals" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."referrals" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."referrals" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."referrals" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."referrals" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."referrals" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."referrals" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."referrals" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."referrals" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."referrals" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."referrals" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."referrals" TO "service_role";

-- Table: public."rhythm_assessments" | relkind=r | force_rls=false
CREATE TABLE public."rhythm_assessments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "member_email" text NOT NULL,
  "member_id" bigint,
  "chronotype" text,
  "rmeq_score" integer,
  "wake_time" time without time zone,
  "sleep_time" time without time zone,
  "work_shape" jsonb DEFAULT '{}'::jsonb,
  "non_negotiables" jsonb DEFAULT '[]'::jsonb,
  "family_anchors" jsonb DEFAULT '[]'::jsonb,
  "accountability_pref" text,
  "fasting_pref" jsonb DEFAULT '{}'::jsonb,
  "archetype_snapshot" jsonb DEFAULT '{}'::jsonb,
  "is_current" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."rhythm_assessments" ADD CONSTRAINT "rhythm_assessments_pkey" PRIMARY KEY (id);
ALTER TABLE public."rhythm_assessments" ENABLE ROW LEVEL SECURITY;
CREATE INDEX rhythm_assess_email_idx ON public.rhythm_assessments USING btree (member_email, is_current);
CREATE UNIQUE INDEX rhythm_assessments_pkey ON public.rhythm_assessments USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."rhythm_assessments" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."rhythm_assessments" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."rhythm_assessments" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."rhythm_assessments" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."rhythm_assessments" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."rhythm_assessments" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."rhythm_assessments" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."rhythm_assessments" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."rhythm_assessments" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."rhythm_assessments" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."rhythm_assessments" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."rhythm_assessments" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."rhythm_assessments" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."rhythm_assessments" TO "service_role";

-- Table: public."rhythm_checkins" | relkind=r | force_rls=false
CREATE TABLE public."rhythm_checkins" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "slot_id" uuid NOT NULL,
  "plan_id" uuid,
  "member_email" text NOT NULL,
  "check_date" date NOT NULL,
  "status" text NOT NULL,
  "source" text DEFAULT 'manual'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."rhythm_checkins" ADD CONSTRAINT "rhythm_checkins_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."rhythm_checkins" ADD CONSTRAINT "rhythm_checkins_slot_id_check_date_key" UNIQUE (slot_id, check_date);
ALTER TABLE ONLY public."rhythm_checkins" ADD CONSTRAINT "rhythm_checkins_slot_id_fkey" FOREIGN KEY (slot_id) REFERENCES rhythm_slots(id) ON DELETE CASCADE;
ALTER TABLE public."rhythm_checkins" ENABLE ROW LEVEL SECURITY;
CREATE INDEX rhythm_checkins_member_idx ON public.rhythm_checkins USING btree (member_email, check_date);
CREATE UNIQUE INDEX rhythm_checkins_pkey ON public.rhythm_checkins USING btree (id);
CREATE UNIQUE INDEX rhythm_checkins_slot_id_check_date_key ON public.rhythm_checkins USING btree (slot_id, check_date);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."rhythm_checkins" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."rhythm_checkins" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."rhythm_checkins" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."rhythm_checkins" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."rhythm_checkins" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."rhythm_checkins" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."rhythm_checkins" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."rhythm_checkins" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."rhythm_checkins" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."rhythm_checkins" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."rhythm_checkins" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."rhythm_checkins" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."rhythm_checkins" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."rhythm_checkins" TO "service_role";

-- Table: public."rhythm_nudges" | relkind=r | force_rls=false
CREATE TABLE public."rhythm_nudges" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "member_email" text NOT NULL,
  "slot_id" uuid,
  "kind" text NOT NULL,
  "channel" text DEFAULT 'in_app'::text NOT NULL,
  "shown_at" timestamp with time zone DEFAULT now() NOT NULL,
  "acted" boolean DEFAULT false NOT NULL
);
ALTER TABLE ONLY public."rhythm_nudges" ADD CONSTRAINT "rhythm_nudges_pkey" PRIMARY KEY (id);
ALTER TABLE public."rhythm_nudges" ENABLE ROW LEVEL SECURITY;
CREATE INDEX rhythm_nudges_member_idx ON public.rhythm_nudges USING btree (member_email, shown_at);
CREATE UNIQUE INDEX rhythm_nudges_pkey ON public.rhythm_nudges USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."rhythm_nudges" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."rhythm_nudges" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."rhythm_nudges" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."rhythm_nudges" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."rhythm_nudges" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."rhythm_nudges" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."rhythm_nudges" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."rhythm_nudges" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."rhythm_nudges" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."rhythm_nudges" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."rhythm_nudges" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."rhythm_nudges" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."rhythm_nudges" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."rhythm_nudges" TO "service_role";

-- Table: public."rhythm_plans" | relkind=r | force_rls=false
CREATE TABLE public."rhythm_plans" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "member_email" text NOT NULL,
  "member_id" bigint,
  "name" text DEFAULT 'My Rhythm'::text NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "source_assessment_id" uuid,
  "ics_token" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "activated_at" timestamp with time zone,
  "season_days" integer,
  "season_start" date,
  "season_ended_at" timestamp with time zone
);
ALTER TABLE ONLY public."rhythm_plans" ADD CONSTRAINT "rhythm_plans_pkey" PRIMARY KEY (id);
ALTER TABLE public."rhythm_plans" ENABLE ROW LEVEL SECURITY;
CREATE INDEX rhythm_plans_email_idx ON public.rhythm_plans USING btree (member_email, status);
CREATE INDEX rhythm_plans_ics_idx ON public.rhythm_plans USING btree (ics_token);
CREATE UNIQUE INDEX rhythm_plans_one_active ON public.rhythm_plans USING btree (member_email) WHERE (status = 'active'::text);
CREATE UNIQUE INDEX rhythm_plans_pkey ON public.rhythm_plans USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."rhythm_plans" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."rhythm_plans" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."rhythm_plans" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."rhythm_plans" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."rhythm_plans" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."rhythm_plans" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."rhythm_plans" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."rhythm_plans" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."rhythm_plans" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."rhythm_plans" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."rhythm_plans" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."rhythm_plans" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."rhythm_plans" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."rhythm_plans" TO "service_role";

-- Table: public."rhythm_slots" | relkind=r | force_rls=false
CREATE TABLE public."rhythm_slots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL,
  "member_email" text NOT NULL,
  "domain" text NOT NULL,
  "title" text NOT NULL,
  "product_key" text,
  "cue_type" text DEFAULT 'time'::text NOT NULL,
  "cue_value" text,
  "if_then_text" text,
  "day_mask" integer DEFAULT 127 NOT NULL,
  "time_window" text,
  "duration_min" integer DEFAULT 10 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "why" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "origin" text DEFAULT 'engine'::text NOT NULL
);
ALTER TABLE ONLY public."rhythm_slots" ADD CONSTRAINT "rhythm_slots_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."rhythm_slots" ADD CONSTRAINT "rhythm_slots_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES rhythm_plans(id) ON DELETE CASCADE;
ALTER TABLE public."rhythm_slots" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX rhythm_slots_pkey ON public.rhythm_slots USING btree (id);
CREATE INDEX rhythm_slots_plan_idx ON public.rhythm_slots USING btree (plan_id, active);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."rhythm_slots" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."rhythm_slots" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."rhythm_slots" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."rhythm_slots" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."rhythm_slots" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."rhythm_slots" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."rhythm_slots" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."rhythm_slots" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."rhythm_slots" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."rhythm_slots" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."rhythm_slots" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."rhythm_slots" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."rhythm_slots" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."rhythm_slots" TO "service_role";

-- Table: public."site_settings" | relkind=r | force_rls=false
CREATE TABLE public."site_settings" (
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."site_settings" ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY (key);
ALTER TABLE public."site_settings" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX site_settings_pkey ON public.site_settings USING btree (key);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."site_settings" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."site_settings" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."site_settings" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."site_settings" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."site_settings" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."site_settings" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."site_settings" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."site_settings" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."site_settings" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."site_settings" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."site_settings" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."site_settings" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."site_settings" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."site_settings" TO "service_role";

-- Table: public."skool_members" | relkind=r | force_rls=false
CREATE TABLE public."skool_members" (
  "skool_user_id" text NOT NULL,
  "handle" text NOT NULL,
  "first_name" text,
  "last_name" text,
  "full_name" text,
  "email" text,
  "avatar_url" text,
  "role" text,
  "bio" text,
  "synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."skool_members" ADD CONSTRAINT "skool_members_pkey" PRIMARY KEY (skool_user_id);
ALTER TABLE public."skool_members" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX skool_members_handle_uidx ON public.skool_members USING btree (handle);
CREATE UNIQUE INDEX skool_members_pkey ON public.skool_members USING btree (skool_user_id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."skool_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."skool_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."skool_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."skool_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."skool_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."skool_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."skool_members" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."skool_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."skool_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."skool_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."skool_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."skool_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."skool_members" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."skool_members" TO "service_role";

-- Table: public."skool_posts" | relkind=r | force_rls=false
CREATE TABLE public."skool_posts" (
  "id" text NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "excerpt" text,
  "author_name" text,
  "likes" integer DEFAULT 0,
  "comments" integer DEFAULT 0,
  "posted_at" timestamp with time zone,
  "synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."skool_posts" ADD CONSTRAINT "skool_posts_pkey" PRIMARY KEY (id);
ALTER TABLE public."skool_posts" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX skool_posts_pkey ON public.skool_posts USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."skool_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."skool_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."skool_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."skool_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."skool_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."skool_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."skool_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."skool_posts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."skool_posts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."skool_posts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."skool_posts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."skool_posts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."skool_posts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."skool_posts" TO "service_role";

-- Table: public."try_orders" | relkind=r | force_rls=false
-- One-time Try product orders from Baknd checkout, pushed to Shopify for Supliful fulfillment.
CREATE TABLE public."try_orders" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "email" text NOT NULL,
  "customer_name" text,
  "product_key" text NOT NULL,
  "product_title" text,
  "price" text,
  "ship_name" text,
  "ship_phone" text,
  "ship_address1" text,
  "ship_address2" text,
  "ship_city" text,
  "ship_state" text,
  "ship_zip" text,
  "ship_country" text DEFAULT 'US'::text,
  "shopify_order_id" bigint,
  "referral_code" text,
  "status" text DEFAULT 'confirmed'::text,
  "source" text DEFAULT 'baknd_try_checkout'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public."try_orders" ADD CONSTRAINT "try_orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."try_orders" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_try_orders_email ON public.try_orders USING btree (email);
CREATE INDEX idx_try_orders_product ON public.try_orders USING btree (product_key);
CREATE INDEX idx_try_orders_ref ON public.try_orders USING btree (referral_code) WHERE (referral_code IS NOT NULL);
CREATE INDEX idx_try_orders_status ON public.try_orders USING btree (status);
CREATE UNIQUE INDEX try_orders_pkey ON public.try_orders USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."try_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."try_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."try_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."try_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."try_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."try_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."try_orders" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."try_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."try_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."try_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."try_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."try_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."try_orders" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."try_orders" TO "service_role";

-- Table: public."wall_amens" | relkind=r | force_rls=false
CREATE TABLE public."wall_amens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL,
  "member_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."wall_amens" ADD CONSTRAINT "wall_amens_member_id_fkey" FOREIGN KEY (member_id) REFERENCES approved_members(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."wall_amens" ADD CONSTRAINT "wall_amens_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."wall_amens" ADD CONSTRAINT "wall_amens_post_id_fkey" FOREIGN KEY (post_id) REFERENCES wall_posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."wall_amens" ADD CONSTRAINT "wall_amens_post_id_member_id_key" UNIQUE (post_id, member_id);
ALTER TABLE public."wall_amens" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX wall_amens_pkey ON public.wall_amens USING btree (id);
CREATE INDEX wall_amens_post_created_idx ON public.wall_amens USING btree (post_id, created_at DESC);
CREATE UNIQUE INDEX wall_amens_post_id_member_id_key ON public.wall_amens USING btree (post_id, member_id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."wall_amens" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."wall_amens" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."wall_amens" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."wall_amens" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."wall_amens" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."wall_amens" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."wall_amens" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."wall_amens" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."wall_amens" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."wall_amens" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."wall_amens" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."wall_amens" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."wall_amens" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."wall_amens" TO "service_role";

-- Table: public."wall_posts" | relkind=r | force_rls=false
CREATE TABLE public."wall_posts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "member_id" bigint NOT NULL,
  "source" text NOT NULL,
  "body" text NOT NULL,
  "display_mode" text DEFAULT 'anonymous'::text NOT NULL,
  "status" text DEFAULT 'live'::text NOT NULL,
  "pray_count" integer DEFAULT 0 NOT NULL,
  "last_prayed_at" timestamp with time zone,
  "answered_at" timestamp with time zone,
  "answered_note" text,
  "answered_note_locked_at" timestamp with time zone,
  "amen_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."wall_posts" ADD CONSTRAINT "wall_posts_amen_count_check" CHECK (amen_count >= 0);
ALTER TABLE ONLY public."wall_posts" ADD CONSTRAINT "wall_posts_answered_note_check" CHECK (answered_note IS NULL OR char_length(TRIM(BOTH FROM answered_note)) >= 1 AND char_length(TRIM(BOTH FROM answered_note)) <= 1000);
ALTER TABLE ONLY public."wall_posts" ADD CONSTRAINT "wall_posts_body_check" CHECK (char_length(TRIM(BOTH FROM body)) >= 1 AND char_length(TRIM(BOTH FROM body)) <= 1000);
ALTER TABLE ONLY public."wall_posts" ADD CONSTRAINT "wall_posts_display_mode_check" CHECK (display_mode = ANY (ARRAY['signed'::text, 'anonymous'::text]));
ALTER TABLE ONLY public."wall_posts" ADD CONSTRAINT "wall_posts_member_id_fkey" FOREIGN KEY (member_id) REFERENCES approved_members(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."wall_posts" ADD CONSTRAINT "wall_posts_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."wall_posts" ADD CONSTRAINT "wall_posts_pray_count_check" CHECK (pray_count >= 0);
ALTER TABLE ONLY public."wall_posts" ADD CONSTRAINT "wall_posts_source_check" CHECK (source = ANY (ARRAY['bible365'::text, 'wall'::text]));
ALTER TABLE ONLY public."wall_posts" ADD CONSTRAINT "wall_posts_status_check" CHECK (status = ANY (ARRAY['live'::text, 'archived'::text, 'answered'::text, 'held'::text]));
ALTER TABLE public."wall_posts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_visible_wall_posts" ON public."wall_posts" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((status = ANY (ARRAY['live'::text, 'answered'::text])));
CREATE INDEX wall_posts_answered_idx ON public.wall_posts USING btree (status, answered_at DESC) WHERE (status = 'answered'::text);
CREATE INDEX wall_posts_created_idx ON public.wall_posts USING btree (status, created_at DESC);
CREATE INDEX wall_posts_live_idx ON public.wall_posts USING btree (status, last_prayed_at DESC NULLS LAST) WHERE (status = 'live'::text);
CREATE INDEX wall_posts_member_idx ON public.wall_posts USING btree (member_id, created_at DESC);
CREATE INDEX wall_posts_needs_idx ON public.wall_posts USING btree (status, pray_count, created_at DESC) WHERE (status = 'live'::text);
CREATE UNIQUE INDEX wall_posts_pkey ON public.wall_posts USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."wall_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."wall_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."wall_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."wall_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."wall_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."wall_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."wall_posts" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."wall_posts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."wall_posts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."wall_posts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."wall_posts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."wall_posts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."wall_posts" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."wall_posts" TO "service_role";

-- Table: public."wall_prays" | relkind=r | force_rls=false
CREATE TABLE public."wall_prays" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL,
  "member_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "seen_answered_at" timestamp with time zone
);
ALTER TABLE ONLY public."wall_prays" ADD CONSTRAINT "wall_prays_member_id_fkey" FOREIGN KEY (member_id) REFERENCES approved_members(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."wall_prays" ADD CONSTRAINT "wall_prays_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."wall_prays" ADD CONSTRAINT "wall_prays_post_id_fkey" FOREIGN KEY (post_id) REFERENCES wall_posts(id) ON DELETE CASCADE;
ALTER TABLE public."wall_prays" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_wall_pray_score_inputs" ON public."wall_prays" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);
CREATE INDEX wall_prays_member_idx ON public.wall_prays USING btree (member_id, created_at DESC);
CREATE UNIQUE INDEX wall_prays_pkey ON public.wall_prays USING btree (id);
CREATE INDEX wall_prays_window_idx ON public.wall_prays USING btree (post_id, member_id, created_at DESC);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."wall_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."wall_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."wall_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."wall_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."wall_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."wall_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."wall_prays" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."wall_prays" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."wall_prays" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."wall_prays" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."wall_prays" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."wall_prays" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."wall_prays" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."wall_prays" TO "service_role";

-- Table: public."wall_reports" | relkind=r | force_rls=false
CREATE TABLE public."wall_reports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL,
  "reporter_id" bigint NOT NULL,
  "reason" text,
  "status" text DEFAULT 'open'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);
ALTER TABLE ONLY public."wall_reports" ADD CONSTRAINT "wall_reports_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."wall_reports" ADD CONSTRAINT "wall_reports_post_id_fkey" FOREIGN KEY (post_id) REFERENCES wall_posts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."wall_reports" ADD CONSTRAINT "wall_reports_post_id_reporter_id_key" UNIQUE (post_id, reporter_id);
ALTER TABLE ONLY public."wall_reports" ADD CONSTRAINT "wall_reports_reason_check" CHECK (reason IS NULL OR char_length(reason) <= 500);
ALTER TABLE ONLY public."wall_reports" ADD CONSTRAINT "wall_reports_reporter_id_fkey" FOREIGN KEY (reporter_id) REFERENCES approved_members(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."wall_reports" ADD CONSTRAINT "wall_reports_status_check" CHECK (status = ANY (ARRAY['open'::text, 'dismissed'::text, 'upheld'::text]));
ALTER TABLE public."wall_reports" ENABLE ROW LEVEL SECURITY;
CREATE INDEX wall_reports_open_idx ON public.wall_reports USING btree (status, created_at DESC) WHERE (status = 'open'::text);
CREATE UNIQUE INDEX wall_reports_pkey ON public.wall_reports USING btree (id);
CREATE UNIQUE INDEX wall_reports_post_id_reporter_id_key ON public.wall_reports USING btree (post_id, reporter_id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."wall_reports" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."wall_reports" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."wall_reports" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."wall_reports" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."wall_reports" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."wall_reports" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."wall_reports" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."wall_reports" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."wall_reports" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."wall_reports" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."wall_reports" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."wall_reports" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."wall_reports" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."wall_reports" TO "service_role";

-- Table: public."webhook_log" | relkind=r | force_rls=false
CREATE TABLE public."webhook_log" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "source" text NOT NULL,
  "event_type" text,
  "idempotency_key" text,
  "payload" jsonb,
  "status" text DEFAULT 'received'::text NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public."webhook_log" ADD CONSTRAINT "webhook_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."webhook_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_log_service_role_all" ON public."webhook_log" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX webhook_log_idempotency_key_uniq ON public.webhook_log USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE UNIQUE INDEX webhook_log_pkey ON public.webhook_log USING btree (id);
CREATE INDEX webhook_log_source_created_idx ON public.webhook_log USING btree (source, created_at DESC);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."webhook_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."webhook_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."webhook_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."webhook_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."webhook_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."webhook_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."webhook_log" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."webhook_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."webhook_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."webhook_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."webhook_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."webhook_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."webhook_log" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."webhook_log" TO "service_role";

-- Table: public."whealthy_users" | relkind=r | force_rls=false
CREATE TABLE public."whealthy_users" (
  "id" uuid NOT NULL,
  "stripe_customer_id" text,
  "archetype" text,
  "skool_joined" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE ONLY public."whealthy_users" ADD CONSTRAINT "whealthy_users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."whealthy_users" ADD CONSTRAINT "whealthy_users_pkey" PRIMARY KEY (id);
ALTER TABLE public."whealthy_users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_own_profile" ON public."whealthy_users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = id));
CREATE POLICY "authenticated_update_own_profile" ON public."whealthy_users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));
CREATE UNIQUE INDEX whealthy_users_pkey ON public.whealthy_users USING btree (id);
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."whealthy_users" TO "authenticated";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."whealthy_users" TO "authenticated";
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."whealthy_users" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."whealthy_users" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."whealthy_users" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."whealthy_users" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."whealthy_users" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."whealthy_users" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."whealthy_users" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."whealthy_users" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."whealthy_users" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."whealthy_users" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."whealthy_users" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."whealthy_users" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."whealthy_users" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."whealthy_users" TO "service_role";

-- Table: public."word_bank" | relkind=r | force_rls=false
-- Rhythm Mechanics Page 4: archetype-keyed scripture references for The Word That Arrives. Text pulled verbatim from bible_verses at delivery. Service-role only.
CREATE TABLE public."word_bank" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "archetype" text NOT NULL,
  "ref" text NOT NULL,
  "weight" integer DEFAULT 1 NOT NULL
);
ALTER TABLE ONLY public."word_bank" ADD CONSTRAINT "word_bank_archetype_ref_key" UNIQUE (archetype, ref);
ALTER TABLE ONLY public."word_bank" ADD CONSTRAINT "word_bank_pkey" PRIMARY KEY (id);
ALTER TABLE public."word_bank" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX word_bank_archetype_ref_key ON public.word_bank USING btree (archetype, ref);
CREATE UNIQUE INDEX word_bank_pkey ON public.word_bank USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."word_bank" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."word_bank" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."word_bank" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."word_bank" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."word_bank" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."word_bank" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."word_bank" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."word_bank" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."word_bank" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."word_bank" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."word_bank" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."word_bank" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."word_bank" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."word_bank" TO "service_role";

-- Table: public."word_deliveries" | relkind=r | force_rls=false
-- One row per member per day a word was delivered. Enforces cap and no-repeat. Service-role only.
CREATE TABLE public."word_deliveries" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "member_id" bigint NOT NULL,
  "ref" text NOT NULL,
  "delivered_on" date NOT NULL
);
ALTER TABLE ONLY public."word_deliveries" ADD CONSTRAINT "word_deliveries_member_id_delivered_on_key" UNIQUE (member_id, delivered_on);
ALTER TABLE ONLY public."word_deliveries" ADD CONSTRAINT "word_deliveries_pkey" PRIMARY KEY (id);
ALTER TABLE public."word_deliveries" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX word_deliveries_member_id_delivered_on_key ON public.word_deliveries USING btree (member_id, delivered_on);
CREATE INDEX word_deliveries_member_idx ON public.word_deliveries USING btree (member_id, delivered_on);
CREATE UNIQUE INDEX word_deliveries_pkey ON public.word_deliveries USING btree (id);
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."word_deliveries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."word_deliveries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."word_deliveries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."word_deliveries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."word_deliveries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."word_deliveries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."word_deliveries" TO "postgres" WITH GRANT OPTION;
-- NON-EXECUTABLE grant: GRANT DELETE ON TABLE public."word_deliveries" TO "service_role";
-- NON-EXECUTABLE grant: GRANT INSERT ON TABLE public."word_deliveries" TO "service_role";
-- NON-EXECUTABLE grant: GRANT REFERENCES ON TABLE public."word_deliveries" TO "service_role";
-- NON-EXECUTABLE grant: GRANT SELECT ON TABLE public."word_deliveries" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRIGGER ON TABLE public."word_deliveries" TO "service_role";
-- NON-EXECUTABLE grant: GRANT TRUNCATE ON TABLE public."word_deliveries" TO "service_role";
-- NON-EXECUTABLE grant: GRANT UPDATE ON TABLE public."word_deliveries" TO "service_role";

-- === VIEWS (NON-EXECUTABLE CATALOG DEFINITIONS) ===

-- VIEW public."member_profile_display"
--  SELECT m.id AS member_id,
--     m.email,
--     m.name,
--     u.raw_user_meta_data ->> 'skool_avatar_url'::text AS avatar_url
--    FROM approved_members m
--      LEFT JOIN auth.users u ON u.email::text = m.email;

-- VIEW public."public_affiliates"
--  SELECT name,
--     ref_id
--    FROM affiliates;

-- VIEW public."wall_posts_with_score"
--  SELECT id,
--     member_id,
--     source,
--     body,
--     display_mode,
--     status,
--     pray_count,
--     last_prayed_at,
--     answered_at,
--     answered_note,
--     answered_note_locked_at,
--     amen_count,
--     created_at,
--     wall_prayed_score(id) AS score
--    FROM wall_posts p;

-- === FUNCTIONS (NON-EXECUTABLE CATALOG METADATA; BODIES OMITTED) ===
-- Function bodies are deliberately omitted so this review artifact cannot contain data-writing SQL or embedded credentials.
-- Use a controlled, reviewed export before attempting any replay.

-- FUNCTION public."enqueue_member_onboarding"() RETURNS trigger; language=plpgsql; security_definer=true; volatility=v; leakproof=false
-- config=["search_path=pg_catalog, public"]
-- FUNCTION public."get_my_praying_for_posts"(p_member_id bigint, p_limit integer, p_offset integer) RETURNS json; language=plpgsql; security_definer=true; volatility=v; leakproof=false
-- config=["search_path=pg_catalog, public"]
-- FUNCTION public."get_wall_top_testimonies_json"(p_limit integer) RETURNS json; language=plpgsql; security_definer=true; volatility=v; leakproof=false
-- config=["search_path=pg_catalog, public"]
-- FUNCTION public."get_whealthy_leaderboard"(days_limit integer) RETURNS TABLE(user_id uuid, name text, level integer, streak integer, score integer); language=plpgsql; security_definer=false; volatility=v; leakproof=false
-- config=["search_path=pg_catalog, public"]
-- FUNCTION public."handle_new_user"() RETURNS trigger; language=plpgsql; security_definer=true; volatility=v; leakproof=false
-- config=["search_path=pg_catalog, public"]
-- FUNCTION public."log_quiz_history_fn"() RETURNS trigger; language=plpgsql; security_definer=false; volatility=v; leakproof=false
-- config=["search_path=pg_catalog, public"]
-- FUNCTION public."tour_state_update"(p_email text, p_done boolean, p_steps jsonb) RETURNS TABLE(tour_done_at timestamp with time zone, first_steps jsonb); language=sql; security_definer=true; volatility=v; leakproof=false
-- config=["search_path=pg_catalog, public"]
-- FUNCTION public."update_updated_at"() RETURNS trigger; language=plpgsql; security_definer=false; volatility=v; leakproof=false
-- config=["search_path=\"\""]
-- FUNCTION public."wall_amen_transaction"(p_post_id uuid, p_member_id bigint) RETURNS json; language=plpgsql; security_definer=true; volatility=v; leakproof=false
-- config=["search_path=pg_catalog, public"]
-- FUNCTION public."wall_pray_transaction"(p_post_id uuid, p_member_id bigint) RETURNS json; language=plpgsql; security_definer=true; volatility=v; leakproof=false
-- config=["search_path=pg_catalog, public"]
-- FUNCTION public."wall_prayed_score"(p_post_id uuid) RETURNS numeric; language=sql; security_definer=false; volatility=s; leakproof=false
-- config=["search_path=pg_catalog, public"]
-- FUNCTION public."wall_report_transaction"(p_post_id uuid, p_reporter_id bigint, p_reason text) RETURNS json; language=plpgsql; security_definer=true; volatility=v; leakproof=false
-- config=["search_path=pg_catalog, public"]
-- FUNCTION public."wall_top_testimonies"(p_limit integer) RETURNS SETOF wall_posts; language=sql; security_definer=false; volatility=s; leakproof=false
-- config=["search_path=pg_catalog, public"]

-- === VIEW GRANTS (NON-EXECUTABLE CATALOG RECORDS) ===
-- Follow-up SELECT-only catalog verification: 842 total relation grants = 796 base-table grants + 46 view grants.

-- GRANT DELETE ON VIEW public."member_profile_display" TO "postgres" WITH GRANT OPTION;
-- GRANT INSERT ON VIEW public."member_profile_display" TO "postgres" WITH GRANT OPTION;
-- GRANT REFERENCES ON VIEW public."member_profile_display" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT ON VIEW public."member_profile_display" TO "postgres" WITH GRANT OPTION;
-- GRANT TRIGGER ON VIEW public."member_profile_display" TO "postgres" WITH GRANT OPTION;
-- GRANT TRUNCATE ON VIEW public."member_profile_display" TO "postgres" WITH GRANT OPTION;
-- GRANT UPDATE ON VIEW public."member_profile_display" TO "postgres" WITH GRANT OPTION;
-- GRANT DELETE ON VIEW public."member_profile_display" TO "service_role";
-- GRANT INSERT ON VIEW public."member_profile_display" TO "service_role";
-- GRANT REFERENCES ON VIEW public."member_profile_display" TO "service_role";
-- GRANT SELECT ON VIEW public."member_profile_display" TO "service_role";
-- GRANT TRIGGER ON VIEW public."member_profile_display" TO "service_role";
-- GRANT TRUNCATE ON VIEW public."member_profile_display" TO "service_role";
-- GRANT UPDATE ON VIEW public."member_profile_display" TO "service_role";
-- GRANT SELECT ON VIEW public."public_affiliates" TO "anon";
-- GRANT SELECT ON VIEW public."public_affiliates" TO "authenticated";
-- GRANT DELETE ON VIEW public."public_affiliates" TO "postgres" WITH GRANT OPTION;
-- GRANT INSERT ON VIEW public."public_affiliates" TO "postgres" WITH GRANT OPTION;
-- GRANT REFERENCES ON VIEW public."public_affiliates" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT ON VIEW public."public_affiliates" TO "postgres" WITH GRANT OPTION;
-- GRANT TRIGGER ON VIEW public."public_affiliates" TO "postgres" WITH GRANT OPTION;
-- GRANT TRUNCATE ON VIEW public."public_affiliates" TO "postgres" WITH GRANT OPTION;
-- GRANT UPDATE ON VIEW public."public_affiliates" TO "postgres" WITH GRANT OPTION;
-- GRANT DELETE ON VIEW public."public_affiliates" TO "service_role";
-- GRANT INSERT ON VIEW public."public_affiliates" TO "service_role";
-- GRANT REFERENCES ON VIEW public."public_affiliates" TO "service_role";
-- GRANT SELECT ON VIEW public."public_affiliates" TO "service_role";
-- GRANT TRIGGER ON VIEW public."public_affiliates" TO "service_role";
-- GRANT TRUNCATE ON VIEW public."public_affiliates" TO "service_role";
-- GRANT UPDATE ON VIEW public."public_affiliates" TO "service_role";
-- GRANT SELECT ON VIEW public."wall_posts_with_score" TO "anon";
-- GRANT SELECT ON VIEW public."wall_posts_with_score" TO "authenticated";
-- GRANT DELETE ON VIEW public."wall_posts_with_score" TO "postgres" WITH GRANT OPTION;
-- GRANT INSERT ON VIEW public."wall_posts_with_score" TO "postgres" WITH GRANT OPTION;
-- GRANT REFERENCES ON VIEW public."wall_posts_with_score" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT ON VIEW public."wall_posts_with_score" TO "postgres" WITH GRANT OPTION;
-- GRANT TRIGGER ON VIEW public."wall_posts_with_score" TO "postgres" WITH GRANT OPTION;
-- GRANT TRUNCATE ON VIEW public."wall_posts_with_score" TO "postgres" WITH GRANT OPTION;
-- GRANT UPDATE ON VIEW public."wall_posts_with_score" TO "postgres" WITH GRANT OPTION;
-- GRANT DELETE ON VIEW public."wall_posts_with_score" TO "service_role";
-- GRANT INSERT ON VIEW public."wall_posts_with_score" TO "service_role";
-- GRANT REFERENCES ON VIEW public."wall_posts_with_score" TO "service_role";
-- GRANT SELECT ON VIEW public."wall_posts_with_score" TO "service_role";
-- GRANT TRIGGER ON VIEW public."wall_posts_with_score" TO "service_role";
-- GRANT TRUNCATE ON VIEW public."wall_posts_with_score" TO "service_role";
-- GRANT UPDATE ON VIEW public."wall_posts_with_score" TO "service_role";


-- === ROUTINE GRANTS (NON-EXECUTABLE CATALOG RECORDS) ===

-- GRANT EXECUTE ON FUNCTION public."enqueue_member_onboarding" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."enqueue_member_onboarding" TO "service_role";
-- GRANT EXECUTE ON FUNCTION public."get_my_praying_for_posts" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."get_my_praying_for_posts" TO "service_role";
-- GRANT EXECUTE ON FUNCTION public."get_wall_top_testimonies_json" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."get_wall_top_testimonies_json" TO "service_role";
-- GRANT EXECUTE ON FUNCTION public."get_whealthy_leaderboard" TO "PUBLIC";
-- GRANT EXECUTE ON FUNCTION public."get_whealthy_leaderboard" TO "anon";
-- GRANT EXECUTE ON FUNCTION public."get_whealthy_leaderboard" TO "authenticated";
-- GRANT EXECUTE ON FUNCTION public."get_whealthy_leaderboard" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."get_whealthy_leaderboard" TO "service_role";
-- GRANT EXECUTE ON FUNCTION public."handle_new_user" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."handle_new_user" TO "service_role";
-- GRANT EXECUTE ON FUNCTION public."log_quiz_history_fn" TO "PUBLIC";
-- GRANT EXECUTE ON FUNCTION public."log_quiz_history_fn" TO "anon";
-- GRANT EXECUTE ON FUNCTION public."log_quiz_history_fn" TO "authenticated";
-- GRANT EXECUTE ON FUNCTION public."log_quiz_history_fn" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."log_quiz_history_fn" TO "service_role";
-- GRANT EXECUTE ON FUNCTION public."tour_state_update" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."tour_state_update" TO "service_role";
-- GRANT EXECUTE ON FUNCTION public."update_updated_at" TO "PUBLIC";
-- GRANT EXECUTE ON FUNCTION public."update_updated_at" TO "anon";
-- GRANT EXECUTE ON FUNCTION public."update_updated_at" TO "authenticated";
-- GRANT EXECUTE ON FUNCTION public."update_updated_at" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."update_updated_at" TO "service_role";
-- GRANT EXECUTE ON FUNCTION public."wall_amen_transaction" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."wall_amen_transaction" TO "service_role";
-- GRANT EXECUTE ON FUNCTION public."wall_pray_transaction" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."wall_pray_transaction" TO "service_role";
-- GRANT EXECUTE ON FUNCTION public."wall_prayed_score" TO "PUBLIC";
-- GRANT EXECUTE ON FUNCTION public."wall_prayed_score" TO "anon";
-- GRANT EXECUTE ON FUNCTION public."wall_prayed_score" TO "authenticated";
-- GRANT EXECUTE ON FUNCTION public."wall_prayed_score" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."wall_prayed_score" TO "service_role";
-- GRANT EXECUTE ON FUNCTION public."wall_report_transaction" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."wall_report_transaction" TO "service_role";
-- GRANT EXECUTE ON FUNCTION public."wall_top_testimonies" TO "PUBLIC";
-- GRANT EXECUTE ON FUNCTION public."wall_top_testimonies" TO "anon";
-- GRANT EXECUTE ON FUNCTION public."wall_top_testimonies" TO "authenticated";
-- GRANT EXECUTE ON FUNCTION public."wall_top_testimonies" TO "postgres" WITH GRANT OPTION;
-- GRANT EXECUTE ON FUNCTION public."wall_top_testimonies" TO "service_role";
