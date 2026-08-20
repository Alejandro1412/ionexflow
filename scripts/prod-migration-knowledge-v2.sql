-- Knowledge v2: doc kinds + searchable chunks

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.document_knowledge
  ADD COLUMN IF NOT EXISTS doc_kind text NOT NULL DEFAULT 'general';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_knowledge_doc_kind_check'
  ) THEN
    ALTER TABLE public.document_knowledge
      ADD CONSTRAINT document_knowledge_doc_kind_check
      CHECK (doc_kind IN (
        'general', 'policy', 'catalog', 'contract', 'playbook', 'customer', 'faq'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.document_knowledge (id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_org_idx
  ON public.knowledge_chunks (org_id);

CREATE INDEX IF NOT EXISTS knowledge_chunks_doc_idx
  ON public.knowledge_chunks (document_id);

CREATE INDEX IF NOT EXISTS knowledge_chunks_content_trgm_idx
  ON public.knowledge_chunks USING gin (content gin_trgm_ops);

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_chunks_select ON public.knowledge_chunks;
CREATE POLICY knowledge_chunks_select ON public.knowledge_chunks
  FOR SELECT TO authenticated USING (org_id = public.current_org_id());

GRANT SELECT ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
