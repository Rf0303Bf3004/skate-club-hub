CREATE OR REPLACE FUNCTION public.trg_traduci_contenuto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job_id uuid;
BEGIN
  DELETE FROM public.traduzioni_jobs WHERE created_at < now() - interval '1 day';

  INSERT INTO public.traduzioni_jobs (tabella, record_id)
  VALUES (TG_TABLE_NAME, NEW.id)
  RETURNING id INTO v_job_id;

  PERFORM net.http_post(
    url := 'https://mdlfhdyyzrxppamlzepd.supabase.co/functions/v1/traduci-contenuto',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('tabella', TG_TABLE_NAME, 'record_id', NEW.id, 'job_id', v_job_id)
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_traduci_convenzioni ON public.convenzioni;
CREATE TRIGGER trg_traduci_convenzioni
AFTER INSERT OR UPDATE OF titolo, descrizione, valore_proposta ON public.convenzioni
FOR EACH ROW EXECUTE FUNCTION public.trg_traduci_contenuto();

DROP TRIGGER IF EXISTS trg_traduci_convenzioni_aree ON public.convenzioni_aree;
CREATE TRIGGER trg_traduci_convenzioni_aree
AFTER INSERT OR UPDATE OF nome ON public.convenzioni_aree
FOR EACH ROW EXECUTE FUNCTION public.trg_traduci_contenuto();

DROP TRIGGER IF EXISTS trg_traduci_corsi ON public.corsi;
CREATE TRIGGER trg_traduci_corsi
AFTER INSERT OR UPDATE OF note ON public.corsi
FOR EACH ROW
WHEN (NEW.note IS NOT NULL AND NEW.note <> '')
EXECUTE FUNCTION public.trg_traduci_contenuto();

DROP TRIGGER IF EXISTS trg_traduci_campi_allenamento ON public.campi_allenamento;
CREATE TRIGGER trg_traduci_campi_allenamento
AFTER INSERT OR UPDATE OF nome, note ON public.campi_allenamento
FOR EACH ROW
WHEN (COALESCE(NEW.nome, '') <> '' OR COALESCE(NEW.note, '') <> '')
EXECUTE FUNCTION public.trg_traduci_contenuto();