-- Apply on Supabase Cloud SQL Editor if not using `supabase db push`.
-- Mirrors supabase/migrations/20260819140000_hardening_claim_versions.sql

CREATE OR REPLACE FUNCTION public.claim_due_delay_executions(p_limit integer DEFAULT 25)
RETURNS SETOF public.workflow_executions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT e.id
    FROM public.workflow_executions e
    WHERE e.status = 'paused'
      AND e.waiting_node_id IS NOT NULL
      AND e.resume_at IS NOT NULL
      AND e.resume_at <= now()
    ORDER BY e.resume_at ASC
    FOR UPDATE OF e SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 100))
  )
  UPDATE public.workflow_executions e
  SET status = 'running'
  FROM due
  WHERE e.id = due.id
  RETURNING e.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_delay_executions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_delay_executions(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_due_schedules(p_limit integer DEFAULT 50)
RETURNS TABLE (id uuid, org_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT w.id
    FROM public.workflows w
    WHERE w.is_active = true
      AND w.schedule_enabled = true
      AND w.schedule_every_minutes IS NOT NULL
      AND w.schedule_every_minutes >= 5
      AND (
        w.last_scheduled_at IS NULL
        OR w.last_scheduled_at
          <= now() - make_interval(mins => w.schedule_every_minutes)
      )
    ORDER BY w.last_scheduled_at ASC NULLS FIRST
    FOR UPDATE OF w SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
  )
  UPDATE public.workflows w
  SET last_scheduled_at = now()
  FROM due
  WHERE w.id = due.id
  RETURNING w.id, w.org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_schedules(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_schedules(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.reap_stuck_running_executions(p_minutes integer DEFAULT 15)
RETURNS TABLE (id uuid, org_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mins integer := GREATEST(5, LEAST(COALESCE(p_minutes, 15), 1440));
BEGIN
  RETURN QUERY
  WITH stuck AS (
    SELECT e.id
    FROM public.workflow_executions e
    WHERE e.status = 'running'
      AND COALESCE(e.started_at, e.created_at) < now() - make_interval(mins => mins)
    FOR UPDATE OF e SKIP LOCKED
    LIMIT 50
  )
  UPDATE public.workflow_executions e
  SET
    status = 'failed',
    completed_at = now(),
    resume_at = null,
    waiting_node_id = null,
    logs = COALESCE(e.logs, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'nodeId', 'system',
        'level', 'error',
        'message', format(
          'Execution reaped: stuck in running longer than %s minutes (timeout or crashed worker).',
          mins
        )
      )
    )
  FROM stuck
  WHERE e.id = stuck.id
  RETURNING e.id, e.org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reap_stuck_running_executions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reap_stuck_running_executions(integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows (id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  version integer NOT NULL,
  name text NOT NULL,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  schedule_enabled boolean NOT NULL DEFAULT false,
  schedule_every_minutes integer,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, version)
);

CREATE INDEX IF NOT EXISTS workflow_versions_workflow_id_idx
  ON public.workflow_versions (workflow_id, version DESC);

ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_versions_select_org ON public.workflow_versions;
CREATE POLICY workflow_versions_select_org ON public.workflow_versions
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS workflow_versions_insert_org ON public.workflow_versions;
CREATE POLICY workflow_versions_insert_org ON public.workflow_versions
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS workflow_versions_delete_org ON public.workflow_versions;
CREATE POLICY workflow_versions_delete_org ON public.workflow_versions
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id());

GRANT SELECT, INSERT, DELETE ON public.workflow_versions TO authenticated;
GRANT ALL ON public.workflow_versions TO service_role;
