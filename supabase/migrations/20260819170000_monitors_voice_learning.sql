-- Proactive monitors, voice inbound, process learning insights

CREATE TABLE IF NOT EXISTS public.business_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  kind text NOT NULL DEFAULT 'manual_metric'
    CHECK (kind IN ('manual_metric', 'failed_executions', 'rejected_approvals')),
  metric_value numeric NOT NULL DEFAULT 0,
  operator text NOT NULL DEFAULT 'gte'
    CHECK (operator IN ('gt', 'gte', 'lt', 'lte', 'eq')),
  threshold numeric NOT NULL DEFAULT 1,
  window_hours integer NOT NULL DEFAULT 168,
  check_every_minutes integer NOT NULL DEFAULT 60,
  workflow_id uuid REFERENCES public.workflows (id) ON DELETE SET NULL,
  notify_message text,
  last_checked_at timestamptz,
  last_triggered_at timestamptz,
  last_value numeric,
  last_error text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_monitors_org_idx
  ON public.business_monitors (org_id, enabled);

CREATE INDEX IF NOT EXISTS business_monitors_due_idx
  ON public.business_monitors (enabled, last_checked_at);

ALTER TABLE public.business_monitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_monitors_select ON public.business_monitors;
CREATE POLICY business_monitors_select ON public.business_monitors
  FOR SELECT TO authenticated USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS business_monitors_insert ON public.business_monitors;
CREATE POLICY business_monitors_insert ON public.business_monitors
  FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS business_monitors_update ON public.business_monitors;
CREATE POLICY business_monitors_update ON public.business_monitors
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS business_monitors_delete ON public.business_monitors;
CREATE POLICY business_monitors_delete ON public.business_monitors
  FOR DELETE TO authenticated USING (org_id = public.current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_monitors TO authenticated;
GRANT ALL ON public.business_monitors TO service_role;

CREATE OR REPLACE FUNCTION public.claim_due_monitors(p_limit integer DEFAULT 25)
RETURNS TABLE (id uuid, org_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT m.id
    FROM public.business_monitors m
    WHERE m.enabled = true
      AND m.workflow_id IS NOT NULL
      AND m.check_every_minutes >= 5
      AND (
        m.last_checked_at IS NULL
        OR m.last_checked_at
          <= now() - make_interval(mins => m.check_every_minutes)
      )
    ORDER BY m.last_checked_at ASC NULLS FIRST
    FOR UPDATE OF m SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 100))
  )
  UPDATE public.business_monitors m
  SET last_checked_at = now(), updated_at = now()
  FROM due
  WHERE m.id = due.id
  RETURNING m.id, m.org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_monitors(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_monitors(integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.process_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.workflows (id) ON DELETE SET NULL,
  approval_id uuid REFERENCES public.approvals (id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'approval_feedback',
  title text NOT NULL,
  suggestion text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dismissed', 'applied')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS process_insights_org_idx
  ON public.process_insights (org_id, status, created_at DESC);

ALTER TABLE public.process_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_insights_select ON public.process_insights;
CREATE POLICY process_insights_select ON public.process_insights
  FOR SELECT TO authenticated USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS process_insights_update ON public.process_insights;
CREATE POLICY process_insights_update ON public.process_insights
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

GRANT SELECT, UPDATE ON public.process_insights TO authenticated;
GRANT ALL ON public.process_insights TO service_role;

CREATE TABLE IF NOT EXISTS public.voice_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  display_name text NOT NULL DEFAULT 'Voice inbound',
  inbound_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  default_workflow_id uuid REFERENCES public.workflows (id) ON DELETE SET NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_connections_org_idx
  ON public.voice_connections (org_id);

ALTER TABLE public.voice_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS voice_connections_select ON public.voice_connections;
CREATE POLICY voice_connections_select ON public.voice_connections
  FOR SELECT TO authenticated USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS voice_connections_insert ON public.voice_connections;
CREATE POLICY voice_connections_insert ON public.voice_connections
  FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS voice_connections_update ON public.voice_connections;
CREATE POLICY voice_connections_update ON public.voice_connections
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS voice_connections_delete ON public.voice_connections;
CREATE POLICY voice_connections_delete ON public.voice_connections
  FOR DELETE TO authenticated USING (org_id = public.current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_connections TO authenticated;
GRANT ALL ON public.voice_connections TO service_role;

CREATE TABLE IF NOT EXISTS public.voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.voice_connections (id) ON DELETE SET NULL,
  execution_id uuid REFERENCES public.workflow_executions (id) ON DELETE SET NULL,
  from_phone text,
  call_sid text,
  transcript text,
  status text NOT NULL DEFAULT 'received',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_calls_org_idx
  ON public.voice_calls (org_id, created_at DESC);

ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS voice_calls_select ON public.voice_calls;
CREATE POLICY voice_calls_select ON public.voice_calls
  FOR SELECT TO authenticated USING (org_id = public.current_org_id());

GRANT SELECT ON public.voice_calls TO authenticated;
GRANT ALL ON public.voice_calls TO service_role;
