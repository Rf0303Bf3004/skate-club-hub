# Fase 6 — Viste Settimana / Mese / Stagione nella Griglia Ghiaccio

Obiettivo: un quadro completo di ciò che succede su piste e palestre, unendo in lettura le sessioni della Griglia e le occorrenze del Planning classico. Nessuna modifica al Planning classico, nessun nuovo campo in database.

## Perimetro

- Tocchiamo solo: `GrigliaGhiaccioPage.tsx`, nuovi componenti in `src/components/griglia/`, un nuovo hook di lettura.
- Non tocchiamo: `PlanningPage.tsx`, `CorsoWizard`, `PosizionamentoWizard`, la vista giorno esistente (impilata/tableau), regole di forzatura disponibilità, fatturazione.
- Le occorrenze Planning classico sono in sola lettura ovunque nelle nuove viste.

## Dati e query

Fonte A — Griglia (già esistente, oggi caricata un giorno alla volta):
- `griglia_blocchi` (club_id, data, risorsa_id, ora_inizio/fine) + `griglia_sessioni` con atleti/gruppi/istruttori.
- Serve una variante a intervallo del fetch già presente in `use-griglia-ghiaccio.ts`: `use_griglia_blocchi_intervallo(da_iso, a_iso)`, stessa forma di dati di `use_griglia_blocchi_giorno` ma con `gte/lte` su `data`. Per le viste settimana/mese carichiamo una versione "leggera" (senza atleti, solo conteggi + istruttori) per non fare query pesanti su 42 giorni.

Fonte B — Planning classico (sola lettura):
- `planning_settimane` (per trovare le settimane nell'intervallo) → `planning_corsi_settimana` (`data`, `ora_inizio`, `ora_fine`, `corso_id`, `istruttore_id`, `annullato`, `sostituisce_id`, `is_evento_extra`) → join client-side con `corsi` (nome, `usa_ghiaccio`, `risorsa_id` se valorizzata).
- Stesso schema di query già usato da `src/components/planning/MeseView.tsx`, riusato/estratto.
- Mappatura su corsia/risorsa: se `corsi.risorsa_id` è valorizzata si usa quella; altrimenti fallback su `usa_ghiaccio` → prima risorsa ghiaccio attiva, else prima palestra attiva; se nessuna corrisponde, riga "Non assegnata a una risorsa" in fondo. La regola di fallback va confermata sui dati reali prima di implementarla.
- Occorrenze con `annullato = true` mostrate barrate/attenuate, non nascoste.

Nuovo hook unico: `src/hooks/use-planning-unificato.ts`
- `use_eventi_unificati(da_iso, a_iso)` → array normalizzato `EventoUnificato { id, fonte: 'griglia' | 'planning', data, ora_inizio, ora_fine, risorsa_id | null, titolo, istruttori: string[], annullato, ref_id }`.
- Un solo punto di normalizzazione, condiviso da tutte le nuove viste.

## Nuovi componenti

1. `src/components/griglia/SettimanaView.tsx`
   - Una sezione per risorsa attiva (stesso filtro `use_risorse_strutture` + toggle "includi ospiti" già presente).
   - Dentro ogni sezione: 7 colonne (lun-dom) con gli eventi posizionati per fascia oraria, layout time-scale coerente con `TableauSchermo.tsx` (riuso della scala minuti/px e dell'impacchettamento sovrapposizioni di `impacchetta_sottorighe`).
   - Badge di provenienza: "Griglia" (colore primario) vs "Planning classico" (grigio/outline con icona lucchetto).
   - Click: evento Griglia → apre la vista Giorno su quella data (stesso dettaglio già esistente); evento Planning → naviga a `/planning` sulla data corrispondente.
   - Navigazione settimana precedente/successiva + "Oggi".

2. `src/components/griglia/MeseGrigliaView.tsx`
   - Calendario 6x7 dal lunedì, stessa impostazione di `MeseView.tsx` del Planning ma alimentato da `use_eventi_unificati`.
   - Cella giorno: conteggio compatto (n. ghiaccio / n. palestra) + pallini colorati per risorsa; piccolo indicatore separato per gli eventi Planning classico.
   - Click su un giorno → vista Settimana (con `shift+click` o pulsante secondario → vista Giorno).

3. `src/components/griglia/LegendaFonti.tsx` — piccola legenda Griglia / Planning classico, accanto a `ProvenienzaLegenda`.

## Modifiche a `GrigliaGhiaccioPage.tsx`

- Il ToggleGroup attuale ("impilata" / "tableau") viene ristrutturato in **due livelli**, perché mischiare periodo e stile di rendering in un solo gruppo diventa confuso a 5 voci:
  - Livello 1 — periodo: `Giorno | Settimana | Mese | Stagione`.
  - Livello 2 — visibile solo quando il periodo è "Giorno": `Impilata | Tableau` (invariato).
- Il selettore data resta unico e guida tutte le viste (giorno → settimana che lo contiene → mese che lo contiene), così passare da una vista all'altra non perde il contesto temporale.
- Stampa riepilogo istruttori / tableau poster restano legati alla vista Giorno.
- Le nuove viste non montano `GrigliaBuilder` né alcuna mutation: sono componenti puramente di lettura.

## Punto 4 — Proposta per la vista STAGIONE

Il modello dati è asimmetrico (Griglia per-data, Planning ricorrente per giorno-della-settimana), quindi una "vista stagione" letterale sarebbe un mese ripetuto. Due opzioni concrete:

**Opzione A — "Settimana tipo" (pattern prevalente)**
Griglia settimanale 7 colonne x risorse dove ogni slot mostra ciò che ricorre nella maggioranza delle settimane della stagione: per il Planning classico è il template `corsi` (già ricorrente per definizione); per la Griglia si aggrega su tutte le date della stagione e si mostra uno slot solo se ricorre in ≥ N% delle settimane (soglia configurabile, default 50%), con un badge "x/20 settimane" e le eccezioni evidenziate. Risponde alla domanda "com'è fatta di norma la nostra settimana?".

**Opzione B — Heatmap di occupazione**
Per ogni risorsa una matrice giorno-della-settimana x fascia oraria (slot da 30'), colorata per minuti occupati sommati su tutta la stagione, più una barra di riepilogo per settimana (occupazione totale nel tempo, per vedere buchi e picchi). Risponde a "dove stiamo sprecando ghiaccio e dove siamo saturi?" — utile per la trattativa sulle ore di pista.

Raccomandazione: **A come vista principale, B come tab secondaria dentro la vista Stagione** (sono complementari e condividono la stessa aggregazione dei dati, quindi il costo incrementale di B è basso). Da confermare prima di implementare.

## Complessità e rischio

| Voce | Stima | Rischio |
|---|---|---|
| Hook unificato + fetch a intervallo | media | basso |
| Vista Settimana | alta (layout time-scale x N risorse) | medio: performance con molte risorse/eventi — mitigata da fetch leggero e memo |
| Vista Mese | bassa/media (riuso `MeseView`) | basso |
| Mapping occorrenze Planning → risorsa | media | **medio-alto**: dipende da quanto `corsi.risorsa_id` è valorizzato nei dati reali. Da verificare con una query prima di iniziare; se è quasi sempre nullo, il fallback su `usa_ghiaccio` diventa la strada principale |
| Vista Stagione (A + B) | alta | medio, dopo conferma |
| Ristrutturazione toggle | bassa | basso |

Nessuna migrazione database prevista in Fase 6.

## Ordine di lavoro proposto

1. Verifica dati (`corsi.risorsa_id`, volumi occorrenze per stagione).
2. Hook unificato + legenda fonti.
3. Vista Settimana.
4. Vista Mese.
5. Ristrutturazione toggle e collegamenti tra viste.
6. Vista Stagione, dopo conferma dell'opzione scelta al punto 4.
