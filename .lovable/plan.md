## Contesto

La struttura del form esiste già: `GrigliaFasceGhiaccio` (src/pages/CoursesPage.tsx) mostra le fasce ghiaccio del giorno, calcola slot per durata (45/60/90/custom), e usa `calcola_status_istruttori_per_slot` per filtrare gli istruttori disponibili. La completezza è calcolata da `check_corso_completo` in `src/hooks/use-supabase-data.ts`.

Mancano: (a) mostrare anche gli istruttori NON disponibili come selezionabili con badge di avviso, (b) verifica istruttore nella regola di completezza.

## Modifiche

### 1. `src/hooks/use-supabase-data.ts` — `check_corso_completo`

Estendere la firma per accettare anche `disp_istruttori` e la lista istruttori:

```ts
export function check_corso_completo(
  corso: any,
  disp_ghiaccio: any[],
  disp_istruttori?: any[],   // righe disponibilita_istruttori del club
): CorsoCompletoResult
```

Logica nuova:
- Off-Ice (tipo ≠ "ghiaccio"): invariato, completo se giorno+orari definiti.
- Ghiaccio:
  1. Verifica fascia ghiaccio (logica attuale, **non toccata**: `norm_giorno` + contenimento orario).
  2. Verifica istruttore: deve esistere almeno una voce in `corso.istruttori_ids`. Se vuoto → `incompleto: "Nessun istruttore assegnato"`.
  3. Per ognuno degli istruttori assegnati, cercare in `disp_istruttori` una riga con `norm_giorno(d.giorno) === norm_giorno(corso.giorno)` AND `d.ora_inizio ≤ corso.ora_inizio` AND `d.ora_fine ≥ corso.ora_fine`. Basta che **almeno uno** copra lo slot → completo. Se nessuno copre → `incompleto: "Istruttore fuori dalla disponibilità dichiarata"`.

Il parametro `disp_istruttori` è opzionale per non rompere chiamanti esistenti (se assente → si comporta come oggi sulla parte istruttore: completo se fascia OK).

### 2. `use_corsi_completi` (stesso file)

Caricare anche `disponibilita_istruttori` (già letta in `use_meta_planning` ma serve qui locale): aggiungere un piccolo hook `use_disponibilita_istruttori()` o riutilizzare la query esistente. Passarla a `check_corso_completo`.

### 3. `src/pages/CoursesPage.tsx` — chiamanti di `check_corso_completo`

Tre callsite (1286, 2627, 2684): leggere `disponibilita_istruttori` del club (query React Query) e passarla come terzo argomento.

### 4. `GrigliaFasceGhiaccio` — mostrare anche istruttori fuori disponibilità

Oggi `istruttori_status` filtra via `.filter((s) => s.disponibile)`. Cambio: mostrare TUTTI gli istruttori attivi del club, distinguendo tre stati visivi:

- **Disponibile + libero**: pill cliccabile, stile attuale.
- **Fuori disponibilità dichiarata** (`motivo_ko === "no_disponibilita"`): pill cliccabile ma con bordo tratteggiato ambra + icona ⚠ + tooltip "Fuori dalla disponibilità dichiarata — il corso resterà segnalato come incompleto". **Cliccabile** (selezione permessa), non blocca il salvataggio.
- **Conflitto su altro corso** (`motivo_ko === "conflitto_planning"`): resta non cliccabile (come oggi), perché è un vincolo hard di sovrapposizione, non di disponibilità.

Nessuna modifica a `calcola_status_istruttori_per_slot` (continua a restituire lo stato; cambia solo il rendering).

### 5. Avviso completezza in `CorsoModal`

Già esiste `corso_completezza` (linea 1286). Mostrare il `motivo` in un banner sopra il form quando incompleto, così l'utente capisce subito perché. Se già mostrato, lasciare invariato.

## Cosa NON cambia

- Logica di contenimento orario ghiaccio (intatta).
- Filtro `tipo='ghiaccio'` su `disponibilita_ghiaccio` (intatto).
- Generazione slot per durata (parte 1: già esistente, intatta).
- La disponibilità istruttore viene **ricalcolata** ad ogni apertura del corso leggendo `disponibilita_istruttori` correnti: nessuna scrittura di "snapshot", nessuno spostamento automatico di corsi se in futuro un istruttore modifica la sua disponibilità — il corso esistente resterà semplicemente flaggato come incompleto.
- Off-Ice: nessun vincolo ghiaccio né istruttore-su-fascia-ghiaccio.

## File toccati

- `src/hooks/use-supabase-data.ts` — firma e logica `check_corso_completo`, hook lettura `disponibilita_istruttori`.
- `src/pages/CoursesPage.tsx` — 3 callsite + rendering pill istruttori "fuori disponibilità" cliccabile.
