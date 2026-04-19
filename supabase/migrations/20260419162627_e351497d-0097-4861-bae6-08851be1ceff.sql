-- 1) Aggiungi colonna colore agli istruttori
ALTER TABLE public.istruttori
ADD COLUMN IF NOT EXISTS colore text;

-- 2) Popola palette istruttori (per i 7 attuali)
UPDATE public.istruttori SET colore = '#1D4ED8' WHERE nome='Elena'   AND cognome='Bianchi';
UPDATE public.istruttori SET colore = '#DC2626' WHERE nome='Marco'   AND cognome='Rossi';
UPDATE public.istruttori SET colore = '#7C3AED' WHERE nome='Sofia'   AND cognome='Ferrari';
UPDATE public.istruttori SET colore = '#15803D' WHERE nome='Luca'    AND cognome='Conti';
UPDATE public.istruttori SET colore = '#E11D48' WHERE nome='Patrick' AND cognome='Dubois';
UPDATE public.istruttori SET colore = '#0E7490' WHERE nome='Giulia'  AND cognome='Moretti';
UPDATE public.istruttori SET colore = '#A16207' WHERE nome='Paolo'   AND cognome='Ricci';

-- 3) Aggiungi flag usa_ghiaccio ai corsi
ALTER TABLE public.corsi
ADD COLUMN IF NOT EXISTS usa_ghiaccio boolean NOT NULL DEFAULT true;

-- 4) Backfill: corsi off-ice non usano ghiaccio
UPDATE public.corsi
SET usa_ghiaccio = false
WHERE tipo ILIKE '%off%ice%'
   OR tipo ILIKE '%off-ice%'
   OR tipo ILIKE '%danza%'
   OR tipo ILIKE '%fitness%'
   OR tipo ILIKE '%stretch%'
   OR tipo ILIKE '%palestra%';