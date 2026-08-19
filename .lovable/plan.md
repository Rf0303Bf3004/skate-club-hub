# Convocazioni istruttori dalla Griglia Ghiaccio

## Risposte alla ricerca

**1. Collegamento utente-istruttore: OGGI NON ESISTE ed è inaffidabile.**
La tabella `istruttori` non ha nessuna colonna `user_id`. Le uniche colonne di raccordo sono:
- `linked_atleta_id` → punta ad `atleti` (serve per monitrici/aiuto-monitrici), non a `utenti_club`.
- `email` → valorizzata solo su 3 istruttori su 8 nel DB attuale (5 hanno email vuota).

Il matching per nome+cognome funziona su 1 istruttore su 8. Esiste una vecchia funzione DB (`genera_reminder_giornalieri`) che tenta il join `utenti_club.email = istruttori.email`, ma `utenti_club` **non ha nemmeno la colonna `email`**: quel ramo è codice legacy rotto.
Conclusione: **non si può derivare il destinatario in modo affidabile**. Serve un collegamento esplicito e dichiarato dall'utente.

**2. Sì, gli istruttori hanno già una casella messaggi.**
`seed_permessi_default` assegna al ruolo `istruttore` la sezione `comunicazioni`, quindi vedono la voce di menu "Comunicazioni". La pagina ha già il tab **"I miei reminder"** (`MieiReminderStaffTab`) che legge da `comunicazioni_destinatari_staff` filtrando `sotto_tipo = 'reminder_staff'`. Non serve creare una nuova pagina.

**3. Non serve toccare `comunicazioni_destinatari` né creare una tabella nuova.**
Esiste già `comunicazioni_destinatari_staff` (`comunicazione_id`, `user_id`, `club_id`, `stato`, `letto_at`, `rsvp_risposta`, `archiviato_at`), con RLS per club e indici su `user_id`. È esattamente il canale staff. Aggiungere `istruttore_id` a `comunicazioni_destinatari` (dove `atleta_id` è NOT NULL) sarebbe invasivo e rischierebbe di rompere trigger e RLS esistenti.

## Soluzione proposta (la meno rischiosa)

Riusare l'infrastruttura comunicazioni esistente, aggiungendo l'unico pezzo mancante: il link esplicito istruttore → utente.

### 1. Migrazione DB (minima)
- `ALTER TABLE public.istruttori ADD COLUMN user_id uuid NULL;` + indice.
Nessun trigger, nessuna RLS modificata. Un istruttore senza `user_id` semplicemente non riceve nulla (comportamento identico a oggi).

### 2. UI di collegamento
In `InstructorsPage.tsx`, nel form istruttore, una Select "Utente collegato (accesso app)" popolata dagli utenti `utenti_club` del club con ruolo `istruttore`/`aiuto_monitore`/`dt`, più opzione "Nessuno". Nessun matching automatico: la scelta è manuale ed esplicita.

### 3. Invio alla pubblicazione (`use_pubblica_blocco`)
Dopo l'invio delle convocazioni atleti, in aggiunta:
- Raggruppare tutte le sessioni del blocco **per istruttore** (una sola comunicazione per istruttore per giornata, non per slot).
- Comporre un testo identico al riepilogo stampabile: per ogni sessione `orario – pista – specialità – elenco atleti`.
- Inserire **una** riga in `comunicazioni` con `tipo: 'convocazione'`, `sotto_tipo: 'griglia_istruttore'`, `data_evento` = data del blocco, `tipo_destinatari: 'istruttori'`.
  Nota tecnica importante: **non** usare `tipo_destinatari = 'staff'`, perché il trigger `popola_destinatari_comunicazione` in quel caso esploderebbe la comunicazione a *tutti* gli admin/staff del club. Con un valore diverso il trigger non fa nulla e restiamo noi padroni dei destinatari.
- Inserire manualmente una riga in `comunicazioni_destinatari_staff` (`comunicazione_id`, `user_id` dell'istruttore, `club_id`, `stato: 'pending'`).
- Istruttori senza `user_id` collegato vengono saltati e conteggiati a parte.
- Se il blocco viene ripubblicato, le vecchie convocazioni istruttore dello stesso blocco/giorno vengono sostituite (evita duplicati).

### 4. Lettura lato istruttore
Estendere `MieiReminderStaffTab` (o affiancare un tab "Le mie convocazioni" nella stessa pagina Comunicazioni) per includere anche `sotto_tipo = 'griglia_istruttore'`, mostrate come card sola-lettura (senza bottoni RSVP, che restano solo per i reminder turno).

### 5. Feedback all'editor
Il toast di "Pubblica e invia convocazioni" riporta: `X convocazioni atleti · Y istruttori avvisati · Z istruttori senza utente collegato`, così è evidente chi va collegato.

## Trade-off

| Opzione | Pro | Contro |
|---|---|---|
| **Proposta: `istruttori.user_id` + `comunicazioni_destinatari_staff`** | Riusa canale, RLS, UI e indici esistenti; una sola colonna aggiunta; nessun trigger toccato | Richiede un'azione manuale una tantum per collegare ogni istruttore al suo utente |
| Tabella nuova `griglia_notifiche_istruttori` | Isolata dal resto | Duplica un canale che esiste già; serve comunque il link istruttore→utente (stesso problema); nuova RLS, nuova UI, messaggi frammentati in due caselle diverse |
| `istruttore_id` su `comunicazioni_destinatari` | Nessuna nuova tabella | `atleta_id` è NOT NULL; tocca trigger e RLS in uso in produzione: rischio alto sul percorso genitori/atleti |

## Cosa NON cambia
Il riepilogo stampabile attuale resta invariato. I club che non collegano nessun utente vedono il comportamento di oggi, identico.
