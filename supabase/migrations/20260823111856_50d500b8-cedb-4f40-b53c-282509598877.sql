CREATE TABLE IF NOT EXISTS public.traduzioni_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabella text NOT NULL,
  record_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.traduzioni_jobs TO service_role;

ALTER TABLE public.traduzioni_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.trg_traduci_comunicazione()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.titolo IS NOT DISTINCT FROM OLD.titolo
     AND NEW.testo IS NOT DISTINCT FROM OLD.testo THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.traduzioni_jobs WHERE created_at < now() - interval '1 day';

  INSERT INTO public.traduzioni_jobs (tabella, record_id)
  VALUES ('comunicazioni', NEW.id)
  RETURNING id INTO v_job_id;

  PERFORM net.http_post(
    url := 'https://mdlfhdyyzrxppamlzepd.supabase.co/functions/v1/traduci-comunicazione',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('record_id', NEW.id, 'job_id', v_job_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comunicazioni_traduci ON public.comunicazioni;
CREATE TRIGGER trg_comunicazioni_traduci
AFTER INSERT OR UPDATE OF titolo, testo ON public.comunicazioni
FOR EACH ROW EXECUTE FUNCTION public.trg_traduci_comunicazione();