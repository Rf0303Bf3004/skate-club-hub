
-- ============================================================
-- DEMO PRESIDENTE: schema + seed coerente per Stella del Ghiaccio
-- ============================================================

-- Costanti club
-- club: 00030001-0000-0000-0000-000000000001
-- stagione corrente: 00030001-0000-0000-0000-000000000010 (2025/26)

-- ---------- 0) Stagioni storiche ----------
INSERT INTO public.stagioni (id, club_id, nome, tipo, data_inizio, data_fine, attiva, stato) VALUES
  ('00030001-0000-0000-0000-000000000011','00030001-0000-0000-0000-000000000001','2024/2025','Regolare','2024-09-01','2025-08-31',false,'archiviata'),
  ('00030001-0000-0000-0000-000000000012','00030001-0000-0000-0000-000000000001','2023/2024','Regolare','2023-09-01','2024-08-31',false,'archiviata'),
  ('00030001-0000-0000-0000-000000000013','00030001-0000-0000-0000-000000000001','2022/2023','Regolare','2022-09-01','2023-08-31',false,'archiviata')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- (A) DOMANDA & CAPACITA' GHIACCIO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.capacita_corsi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  corso_id uuid NOT NULL,
  capacita_max int NOT NULL DEFAULT 20,
  ore_settimanali_dedicate numeric(5,2) NOT NULL DEFAULT 0,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(corso_id)
);
ALTER TABLE public.capacita_corsi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.capacita_corsi FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_capacita_corsi_club ON public.capacita_corsi(club_id);

CREATE TABLE IF NOT EXISTS public.richieste_iscrizione_storiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid,
  corso_id uuid,
  n_richieste_ricevute int NOT NULL DEFAULT 0,
  n_iscritti_accettati int NOT NULL DEFAULT 0,
  n_in_lista_attesa int NOT NULL DEFAULT 0,
  periodo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.richieste_iscrizione_storiche ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.richieste_iscrizione_storiche FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_rich_isc_st_club ON public.richieste_iscrizione_storiche(club_id, stagione_id);

CREATE TABLE IF NOT EXISTS public.ore_pista_disponibili (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid,
  ore_settimanali_totali numeric(6,2) NOT NULL DEFAULT 0,
  ore_settimanali_utilizzate numeric(6,2) NOT NULL DEFAULT 0,
  ore_richieste_se_accettassimo_tutti numeric(6,2) NOT NULL DEFAULT 0,
  costo_orario_pista numeric(8,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, stagione_id)
);
ALTER TABLE public.ore_pista_disponibili ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.ore_pista_disponibili FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed capacita_corsi e richieste storiche (corsi attivi del club demo)
INSERT INTO public.capacita_corsi (club_id, corso_id, capacita_max, ore_settimanali_dedicate, note)
SELECT '00030001-0000-0000-0000-000000000001', c.id,
  CASE c.nome WHEN 'Stellina 2' THEN 30 WHEN 'Stellina 3' THEN 28 WHEN 'Stellina 4' THEN 22 WHEN 'Stretching' THEN 20 ELSE 24 END,
  CASE c.nome WHEN 'Stellina 2' THEN 3.0 WHEN 'Stellina 3' THEN 3.0 WHEN 'Stellina 4' THEN 2.5 WHEN 'Stretching' THEN 1.5 ELSE 2.0 END,
  'Capacità calibrata su disponibilità ghiaccio'
FROM public.corsi c
WHERE c.club_id='00030001-0000-0000-0000-000000000001' AND c.attivo=true
ON CONFLICT (corso_id) DO NOTHING;

-- Richieste storiche: lista d'attesa concentrata su Stellina 2 (livello base più richiesto)
INSERT INTO public.richieste_iscrizione_storiche (club_id, stagione_id, corso_id, n_richieste_ricevute, n_iscritti_accettati, n_in_lista_attesa, periodo)
SELECT '00030001-0000-0000-0000-000000000001', s.id, c.id,
  CASE c.nome WHEN 'Stellina 2' THEN 65 WHEN 'Stellina 3' THEN 32 WHEN 'Stellina 4' THEN 24 WHEN 'Stretching' THEN 22 ELSE 20 END,
  CASE c.nome WHEN 'Stellina 2' THEN 30 WHEN 'Stellina 3' THEN 28 WHEN 'Stellina 4' THEN 22 WHEN 'Stretching' THEN 20 ELSE 18 END,
  CASE c.nome WHEN 'Stellina 2' THEN 35 WHEN 'Stellina 3' THEN 4 WHEN 'Stellina 4' THEN 2 WHEN 'Stretching' THEN 2 ELSE 2 END,
  'settembre'
FROM public.corsi c
CROSS JOIN public.stagioni s
WHERE c.club_id='00030001-0000-0000-0000-000000000001' AND c.attivo=true
  AND s.id IN ('00030001-0000-0000-0000-000000000010','00030001-0000-0000-0000-000000000011','00030001-0000-0000-0000-000000000012','00030001-0000-0000-0000-000000000013');

-- Ore pista: 12 totali, 10 utilizzate, 14 servirebbero, CHF 180/h
INSERT INTO public.ore_pista_disponibili (club_id, stagione_id, ore_settimanali_totali, ore_settimanali_utilizzate, ore_richieste_se_accettassimo_tutti, costo_orario_pista) VALUES
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010', 12, 10, 14, 180),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011', 12, 9.5, 13, 175),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012', 11, 8.5, 12, 170),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013', 10, 8, 11, 165)
ON CONFLICT (club_id, stagione_id) DO NOTHING;

-- ============================================================
-- (B) ATLETI & COMPOSIZIONE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.atleti_storici_stagioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  atleta_id uuid,
  status text NOT NULL DEFAULT 'attivo',  -- attivo | abbandonato | nuovo
  motivo_abbandono text DEFAULT '',
  data_iscrizione date,
  data_abbandono date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.atleti_storici_stagioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.atleti_storici_stagioni FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_atleti_stor_club_stag ON public.atleti_storici_stagioni(club_id, stagione_id);

CREATE TABLE IF NOT EXISTS public.motivi_abbandono_aggregati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  motivo text NOT NULL,
  count int NOT NULL DEFAULT 0,
  UNIQUE(club_id, stagione_id, motivo)
);
ALTER TABLE public.motivi_abbandono_aggregati ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.motivi_abbandono_aggregati FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed: stagione corrente = tutti gli atleti del club come "attivo" (147 righe)
-- + 12 abbandoni placeholder con motivi
INSERT INTO public.atleti_storici_stagioni (club_id, stagione_id, atleta_id, status, data_iscrizione)
SELECT '00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010', a.id, 'attivo', '2025-09-01'
FROM public.atleti a WHERE a.club_id='00030001-0000-0000-0000-000000000001';

-- Stagioni storiche: aggregato + alcuni record sample
-- 2024/25: ~134 attivi, 14 abbandoni
-- 2023/24: ~122 attivi, 13 abbandoni
-- 2022/23: ~111 attivi, 11 abbandoni
INSERT INTO public.atleti_storici_stagioni (club_id, stagione_id, atleta_id, status, motivo_abbandono, data_iscrizione, data_abbandono)
SELECT '00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011', NULL,
  CASE WHEN g.n <= 134 THEN 'attivo' ELSE 'abbandonato' END,
  CASE WHEN g.n > 134 THEN (ARRAY['cambio attività','trasferimento','costi','infortunio','mancanza tempo'])[1 + (g.n % 5)] ELSE '' END,
  '2024-09-01',
  CASE WHEN g.n > 134 THEN '2025-03-15'::date ELSE NULL END
FROM generate_series(1,148) g(n);

INSERT INTO public.atleti_storici_stagioni (club_id, stagione_id, atleta_id, status, motivo_abbandono, data_iscrizione, data_abbandono)
SELECT '00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012', NULL,
  CASE WHEN g.n <= 122 THEN 'attivo' ELSE 'abbandonato' END,
  CASE WHEN g.n > 122 THEN (ARRAY['cambio attività','trasferimento','costi','infortunio','mancanza tempo'])[1 + (g.n % 5)] ELSE '' END,
  '2023-09-01',
  CASE WHEN g.n > 122 THEN '2024-03-15'::date ELSE NULL END
FROM generate_series(1,135) g(n);

INSERT INTO public.atleti_storici_stagioni (club_id, stagione_id, atleta_id, status, motivo_abbandono, data_iscrizione, data_abbandono)
SELECT '00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013', NULL,
  CASE WHEN g.n <= 111 THEN 'attivo' ELSE 'abbandonato' END,
  CASE WHEN g.n > 111 THEN (ARRAY['cambio attività','trasferimento','costi','infortunio','mancanza tempo'])[1 + (g.n % 5)] ELSE '' END,
  '2022-09-01',
  CASE WHEN g.n > 111 THEN '2023-03-15'::date ELSE NULL END
FROM generate_series(1,122) g(n);

-- Aggregati motivi
INSERT INTO public.motivi_abbandono_aggregati (club_id, stagione_id, motivo, count) VALUES
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011','cambio attività',4),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011','trasferimento',3),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011','costi',3),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011','infortunio',2),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011','mancanza tempo',2),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012','cambio attività',4),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012','trasferimento',3),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012','costi',2),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012','infortunio',2),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012','mancanza tempo',2),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013','cambio attività',3),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013','trasferimento',3),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013','costi',2),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013','infortunio',2),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013','mancanza tempo',1)
ON CONFLICT (club_id, stagione_id, motivo) DO NOTHING;

-- ============================================================
-- (C) RICAVI & PACCHETTI
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pacchetti_opzionali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  nome text NOT NULL,
  descrizione text DEFAULT '',
  prezzo numeric(10,2) NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'altro', -- preparazione_atletica|stretching|preparazione_gara|seminario|altro|off_ice
  durata_settimane int DEFAULT 0,
  max_partecipanti int DEFAULT 0,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pacchetti_opzionali ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.pacchetti_opzionali FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_pacc_opz_club ON public.pacchetti_opzionali(club_id);

CREATE TABLE IF NOT EXISTS public.iscrizioni_pacchetti_storiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid,
  atleta_id uuid,
  pacchetto_id uuid NOT NULL,
  prezzo_pagato numeric(10,2) NOT NULL DEFAULT 0,
  data_iscrizione date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.iscrizioni_pacchetti_storiche ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.iscrizioni_pacchetti_storiche FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_isc_pacc_stor ON public.iscrizioni_pacchetti_storiche(club_id, stagione_id);

CREATE TABLE IF NOT EXISTS public.ricavi_per_fonte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  fonte text NOT NULL, -- quote_corsi|pacchetti_opzionali|lezioni_private|eventi|sponsor|altro
  importo numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, stagione_id, fonte)
);
ALTER TABLE public.ricavi_per_fonte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.ricavi_per_fonte FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed pacchetti opzionali
INSERT INTO public.pacchetti_opzionali (id, club_id, nome, descrizione, prezzo, tipo, durata_settimane, max_partecipanti) VALUES
  ('00030001-0000-0000-0000-0000000a0001','00030001-0000-0000-0000-000000000001','Preparazione atletica','Preparazione atletica off-ice con coach dedicato', 200, 'preparazione_atletica', 4, 16),
  ('00030001-0000-0000-0000-0000000a0002','00030001-0000-0000-0000-000000000001','Stretching avanzato','Sessioni di stretching e mobilità', 80, 'stretching', 4, 20),
  ('00030001-0000-0000-0000-0000000a0003','00030001-0000-0000-0000-000000000001','Preparazione gara','Pacchetto stagionale di preparazione alle gare', 350, 'preparazione_gara', 36, 12),
  ('00030001-0000-0000-0000-0000000a0004','00030001-0000-0000-0000-000000000001','Seminario tecnico','Workshop tecnico una tantum con guest coach', 150, 'seminario', 1, 25),
  ('00030001-0000-0000-0000-0000000a0005','00030001-0000-0000-0000-000000000001','Off-ice','Allenamento off-ice settimanale', 120, 'off_ice', 4, 18)
ON CONFLICT (id) DO NOTHING;

-- Iscrizioni storiche pacchetti — distribuzione realistica (~40% atleti aderiscono)
-- Per stagione corrente: usa atleti reali. Per storiche: ghost rows.
INSERT INTO public.iscrizioni_pacchetti_storiche (club_id, stagione_id, atleta_id, pacchetto_id, prezzo_pagato, data_iscrizione)
SELECT
  '00030001-0000-0000-0000-000000000001',
  '00030001-0000-0000-0000-000000000010',
  a.id,
  p.id,
  p.prezzo,
  '2025-09-15'::date
FROM (SELECT id, row_number() OVER (ORDER BY id) rn FROM public.atleti WHERE club_id='00030001-0000-0000-0000-000000000001') a
CROSS JOIN LATERAL (
  SELECT id, prezzo FROM public.pacchetti_opzionali
  WHERE id = (ARRAY[
    '00030001-0000-0000-0000-0000000a0001'::uuid,
    '00030001-0000-0000-0000-0000000a0002'::uuid,
    '00030001-0000-0000-0000-0000000a0003'::uuid,
    '00030001-0000-0000-0000-0000000a0004'::uuid,
    '00030001-0000-0000-0000-0000000a0005'::uuid
  ])[1 + (a.rn % 5)]
) p
WHERE a.rn % 5 < 2;  -- ~40% degli atleti

-- Ghost iscrizioni stagioni storiche
INSERT INTO public.iscrizioni_pacchetti_storiche (club_id, stagione_id, atleta_id, pacchetto_id, prezzo_pagato, data_iscrizione)
SELECT '00030001-0000-0000-0000-000000000001', stag.sid, NULL, p.pid, p.prezzo, stag.data_isc
FROM (VALUES
  ('00030001-0000-0000-0000-000000000011'::uuid, 55, '2024-09-15'::date),
  ('00030001-0000-0000-0000-000000000012'::uuid, 48, '2023-09-15'::date),
  ('00030001-0000-0000-0000-000000000013'::uuid, 42, '2022-09-15'::date)
) stag(sid, n_iscrizioni, data_isc)
CROSS JOIN LATERAL generate_series(1, stag.n_iscrizioni) g(n)
CROSS JOIN LATERAL (
  SELECT
    (ARRAY[
      '00030001-0000-0000-0000-0000000a0001'::uuid,
      '00030001-0000-0000-0000-0000000a0002'::uuid,
      '00030001-0000-0000-0000-0000000a0003'::uuid,
      '00030001-0000-0000-0000-0000000a0004'::uuid,
      '00030001-0000-0000-0000-0000000a0005'::uuid
    ])[1 + (g.n % 5)] AS pid,
    (ARRAY[200,80,350,150,120])[1 + (g.n % 5)]::numeric AS prezzo
) p;

-- Ricavi per fonte (CHF). Trend ~+10% YoY.
INSERT INTO public.ricavi_per_fonte (club_id, stagione_id, fonte, importo) VALUES
  -- 2025/26 (stima a regime)
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010','quote_corsi', 132300),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010','pacchetti_opzionali', 21800),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010','lezioni_private', 19500),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010','eventi', 8200),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010','sponsor', 12000),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010','altro', 3400),
  -- 2024/25
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011','quote_corsi', 119500),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011','pacchetti_opzionali', 18900),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011','lezioni_private', 17400),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011','eventi', 7300),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011','sponsor', 11000),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011','altro', 2900),
  -- 2023/24
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012','quote_corsi', 108100),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012','pacchetti_opzionali', 16800),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012','lezioni_private', 15200),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012','eventi', 6500),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012','sponsor', 10000),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012','altro', 2400),
  -- 2022/23
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013','quote_corsi', 97600),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013','pacchetti_opzionali', 14700),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013','lezioni_private', 13600),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013','eventi', 5800),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013','sponsor', 9000),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013','altro', 2100)
ON CONFLICT (club_id, stagione_id, fonte) DO NOTHING;

-- ============================================================
-- (D) COSTI & EFFICIENZA ISTRUTTORI
-- ============================================================

CREATE TABLE IF NOT EXISTS public.costi_istruttori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  istruttore_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  tariffa_oraria numeric(8,2) NOT NULL DEFAULT 0,
  contratto_tipo text NOT NULL DEFAULT 'orario', -- orario|forfait|mix
  ore_concordate_settimanali numeric(5,2) DEFAULT 0,
  costo_fisso_mensile numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(istruttore_id, stagione_id)
);
ALTER TABLE public.costi_istruttori ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.costi_istruttori FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ore_lavorate_istruttori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  istruttore_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  periodo text NOT NULL, -- YYYY-MM
  ore_corsi numeric(6,2) DEFAULT 0,
  ore_lezioni_private numeric(6,2) DEFAULT 0,
  ore_eventi numeric(6,2) DEFAULT 0,
  ore_amministrative numeric(6,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(istruttore_id, stagione_id, periodo)
);
ALTER TABLE public.ore_lavorate_istruttori ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.ore_lavorate_istruttori FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ore_lav_club ON public.ore_lavorate_istruttori(club_id, stagione_id);

-- Seed costi istruttori (3 istruttori del club)
INSERT INTO public.costi_istruttori (club_id, istruttore_id, stagione_id, tariffa_oraria, contratto_tipo, ore_concordate_settimanali, costo_fisso_mensile) VALUES
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000101','00030001-0000-0000-0000-000000000010', 60, 'mix', 14, 1200),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000102','00030001-0000-0000-0000-000000000010', 45, 'orario', 12, 0),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000103','00030001-0000-0000-0000-000000000010', 35, 'orario', 10, 0)
ON CONFLICT (istruttore_id, stagione_id) DO NOTHING;

-- Ore lavorate stagione corrente, per mese (set 2025 → mag 2026)
INSERT INTO public.ore_lavorate_istruttori (club_id, istruttore_id, stagione_id, periodo, ore_corsi, ore_lezioni_private, ore_eventi, ore_amministrative)
SELECT '00030001-0000-0000-0000-000000000001', i.id, '00030001-0000-0000-0000-000000000010',
  to_char(d, 'YYYY-MM'),
  CASE i.cognome WHEN 'Gandini' THEN 48 WHEN 'Ponti' THEN 42 ELSE 36 END + (random()*4)::int,
  CASE i.cognome WHEN 'Gandini' THEN 14 WHEN 'Ponti' THEN 10 ELSE 6 END + (random()*3)::int,
  4 + (random()*2)::int,
  3 + (random()*2)::int
FROM public.istruttori i
CROSS JOIN generate_series('2025-09-01'::date, '2026-05-01'::date, interval '1 month') d
WHERE i.club_id='00030001-0000-0000-0000-000000000001'
ON CONFLICT (istruttore_id, stagione_id, periodo) DO NOTHING;

-- ============================================================
-- (E) LEZIONI PRIVATE STORICHE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lezioni_private_storiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  atleta_id uuid,
  istruttore_id uuid,
  data date NOT NULL,
  ore numeric(4,2) NOT NULL DEFAULT 1,
  importo_pagato numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lezioni_private_storiche ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.lezioni_private_storiche FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_lez_priv_stor ON public.lezioni_private_storiche(club_id, stagione_id);

-- Seed: 250 lezioni private stagione corrente, distribuite tra 3 istruttori,
-- concentrazione su top-12 atleti. Pomeriggio/sera (date sett-mag).
INSERT INTO public.lezioni_private_storiche (club_id, stagione_id, atleta_id, istruttore_id, data, ore, importo_pagato)
SELECT
  '00030001-0000-0000-0000-000000000001',
  '00030001-0000-0000-0000-000000000010',
  top_atleti.id,
  istr.id,
  ('2025-09-01'::date + (g.n * 365 / 250) * interval '1 day')::date,
  1.0,
  CASE istr.cognome WHEN 'Gandini' THEN 90 WHEN 'Ponti' THEN 80 ELSE 70 END
FROM generate_series(1, 250) g(n)
CROSS JOIN LATERAL (
  SELECT id FROM public.atleti WHERE club_id='00030001-0000-0000-0000-000000000001'
  ORDER BY id LIMIT 12 OFFSET (g.n % 12)
) AS picked
CROSS JOIN LATERAL (
  SELECT id FROM public.atleti WHERE club_id='00030001-0000-0000-0000-000000000001'
  ORDER BY id LIMIT 1 OFFSET (g.n % 12)
) top_atleti
CROSS JOIN LATERAL (
  SELECT id, cognome FROM public.istruttori
  WHERE club_id='00030001-0000-0000-0000-000000000001'
  ORDER BY cognome LIMIT 1 OFFSET (g.n % 3)
) istr;

-- ============================================================
-- (G) SALUTE FINANZIARIA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cassa_movimenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  data date NOT NULL,
  tipo text NOT NULL, -- entrata|uscita
  categoria text NOT NULL, -- quote|pacchetti|lezioni_private|pista|istruttori|federazione|altro
  importo numeric(12,2) NOT NULL DEFAULT 0,
  descrizione text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cassa_movimenti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.cassa_movimenti FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_cassa_mov_club ON public.cassa_movimenti(club_id, stagione_id);

CREATE TABLE IF NOT EXISTS public.bilancio_stagione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  totale_entrate numeric(12,2) NOT NULL DEFAULT 0,
  totale_uscite numeric(12,2) NOT NULL DEFAULT 0,
  saldo numeric(12,2) NOT NULL DEFAULT 0,
  cassa_iniziale numeric(12,2) NOT NULL DEFAULT 0,
  cassa_finale numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, stagione_id)
);
ALTER TABLE public.bilancio_stagione ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.bilancio_stagione FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bilanci coerenti con ricavi_per_fonte. Costi ~85% delle entrate.
-- 2022/23: entrate 142800, uscite 128500, saldo +14300, cassa fin 24300
-- 2023/24: entrate 159000, uscite 141200, saldo +17800, cassa fin 42100
-- 2024/25: entrate 175000, uscite 152800, saldo +22200, cassa fin 64300
-- 2025/26: entrate 197200, uscite 168400, saldo +28800, cassa fin 93100
INSERT INTO public.bilancio_stagione (club_id, stagione_id, totale_entrate, totale_uscite, saldo, cassa_iniziale, cassa_finale) VALUES
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000013', 142800, 128500, 14300, 10000, 24300),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000012', 159000, 141200, 17800, 24300, 42100),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000011', 175000, 152800, 22200, 42100, 64300),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010', 197200, 168400, 28800, 64300, 93100)
ON CONFLICT (club_id, stagione_id) DO NOTHING;

-- Movimenti stagione corrente (sintesi mensile)
INSERT INTO public.cassa_movimenti (club_id, stagione_id, data, tipo, categoria, importo, descrizione)
SELECT '00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010', m.data, m.tipo, m.categoria, m.importo, m.descrizione
FROM (VALUES
  ('2025-09-15'::date, 'entrata','quote', 33075, 'Quote corsi 1° trimestre'),
  ('2025-10-15'::date, 'entrata','pacchetti', 5450, 'Pacchetti opzionali ottobre'),
  ('2025-10-30'::date, 'uscita','pista', 7920, 'Affitto pista ottobre'),
  ('2025-10-30'::date, 'uscita','istruttori', 11200, 'Compensi istruttori ottobre'),
  ('2025-11-15'::date, 'entrata','lezioni_private', 4875, 'Lezioni private novembre'),
  ('2025-11-30'::date, 'uscita','pista', 7920, 'Affitto pista novembre'),
  ('2025-11-30'::date, 'uscita','istruttori', 11800, 'Compensi istruttori novembre'),
  ('2025-12-01'::date, 'entrata','sponsor', 12000, 'Sponsor stagione'),
  ('2025-12-15'::date, 'entrata','quote', 33075, 'Quote corsi 2° trimestre'),
  ('2025-12-30'::date, 'uscita','federazione', 3400, 'Tasse federali')
) m(data, tipo, categoria, importo, descrizione);

-- ============================================================
-- REPORT
-- ============================================================
DO $$
DECLARE
  r record;
  msg text := E'\n=== SEED DEMO PRESIDENTE — REPORT ===\n';
BEGIN
  FOR r IN SELECT unnest(ARRAY[
    'capacita_corsi','richieste_iscrizione_storiche','ore_pista_disponibili',
    'atleti_storici_stagioni','motivi_abbandono_aggregati',
    'pacchetti_opzionali','iscrizioni_pacchetti_storiche','ricavi_per_fonte',
    'costi_istruttori','ore_lavorate_istruttori',
    'lezioni_private_storiche','cassa_movimenti','bilancio_stagione'
  ]) AS t
  LOOP
    EXECUTE format('SELECT count(*)::text FROM public.%I WHERE club_id IS NULL OR club_id = %L', r.t, '00030001-0000-0000-0000-000000000001'::uuid) INTO msg;
  END LOOP;
END $$;
