-- Differentiator features: WhatsApp, org knowledge, builder metadata

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'disconnected',
  display_name text NOT NULL DEFAULT 'WhatsApp Business',
  phone_number_id text,
  waba_id text,
  access_token text,
  verify_token text,
  inbound_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  default_workflow_id uuid REFERENCES public.workflows (id) ON DELETE SET NULL,
  last_error text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_connections_org_idx
  ON public.whatsapp_connections (org_id);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_connections_select ON public.whatsapp_connections;
CREATE POLICY whatsapp_connections_select ON public.whatsapp_connections
  FOR SELECT TO authenticated USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS whatsapp_connections_insert ON public.whatsapp_connections;
CREATE POLICY whatsapp_connections_insert ON public.whatsapp_connections
  FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS whatsapp_connections_update ON public.whatsapp_connections;
CREATE POLICY whatsapp_connections_update ON public.whatsapp_connections
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

GRANT SELECT, INSERT, UPDATE ON public.whatsapp_connections TO authenticated;
GRANT ALL ON public.whatsapp_connections TO service_role;

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.whatsapp_connections (id) ON DELETE SET NULL,
  execution_id uuid REFERENCES public.workflow_executions (id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'inbound',
  from_phone text,
  to_phone text,
  body_text text,
  wa_message_id text,
  status text NOT NULL DEFAULT 'received',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_messages_org_idx
  ON public.whatsapp_messages (org_id, created_at DESC);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_messages_select ON public.whatsapp_messages;
CREATE POLICY whatsapp_messages_select ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (org_id = public.current_org_id());

GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

CREATE TABLE IF NOT EXISTS public.document_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  tags text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_knowledge_org_idx
  ON public.document_knowledge (org_id, created_at DESC);

ALTER TABLE public.document_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_knowledge_select ON public.document_knowledge;
CREATE POLICY document_knowledge_select ON public.document_knowledge
  FOR SELECT TO authenticated USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS document_knowledge_insert ON public.document_knowledge;
CREATE POLICY document_knowledge_insert ON public.document_knowledge
  FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS document_knowledge_update ON public.document_knowledge;
CREATE POLICY document_knowledge_update ON public.document_knowledge
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS document_knowledge_delete ON public.document_knowledge;
CREATE POLICY document_knowledge_delete ON public.document_knowledge
  FOR DELETE TO authenticated USING (org_id = public.current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_knowledge TO authenticated;
GRANT ALL ON public.document_knowledge TO service_role;
