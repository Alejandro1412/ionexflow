-- Business features: SLA, audit log, overage counters, Slack approval webhook on org

ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS escalate_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS edited_output text;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ai_overage_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_ai_overage boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approval_slack_webhook text;

CREATE TABLE IF NOT EXISTS public.org_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_audit_events_org_created_idx
  ON public.org_audit_events (org_id, created_at DESC);

ALTER TABLE public.org_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_audit_events_select_org ON public.org_audit_events;
CREATE POLICY org_audit_events_select_org ON public.org_audit_events
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS org_audit_events_insert_org ON public.org_audit_events;
CREATE POLICY org_audit_events_insert_org ON public.org_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

GRANT SELECT, INSERT ON public.org_audit_events TO authenticated;
GRANT ALL ON public.org_audit_events TO service_role;

-- Claim pending approvals past SLA for escalation (atomic)
CREATE OR REPLACE FUNCTION public.claim_due_approval_escalations(p_limit integer DEFAULT 25)
RETURNS SETOF public.approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT a.id
    FROM public.approvals a
    WHERE a.status = 'pending'
      AND a.escalate_at IS NOT NULL
      AND a.escalate_at <= now()
      AND a.escalated_at IS NULL
    ORDER BY a.escalate_at ASC
    FOR UPDATE OF a SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 100))
  )
  UPDATE public.approvals a
  SET escalated_at = now()
  FROM due
  WHERE a.id = due.id
  RETURNING a.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_approval_escalations(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_approval_escalations(integer) TO service_role;
