# Audit UX — Piano di semplificazione (4 aree)

Obiettivo: ridurre i click, eliminare i doppioni e usare un linguaggio unico in tutta l'app. Nessuna modifica al database, alle regole di calcolo o ai permessi: si interviene solo su come le cose sono presentate e raggruppate.

---

## 1. Scheda Atleta: da 10 schede a 4

Oggi la scheda ha 10 linguette (Anagrafica, Livello, Corsi, Gare, Medagliere, Genitori, Fatture, Lezioni, Calendario, Storico Test): su iPad vanno a capo e obbligano a cercare.

Nuovo raggruppamento:

| Nuova scheda | Contiene |
|---|---|
| **Profilo** | Anagrafica, Genitori, codice atleta / QR |
| **Attività** | Corsi, Lezioni private, Calendario |
| **Sportivo** | Livello, Storico test, Gare, Medagliere |
| **Amministrativo** | Fatture, adesione/quote |

Dettagli:
- Dentro ogni macro-scheda i blocchi restano separati da titoli di sezione, così nulla si perde.
- Le sottosezioni lunghe (Gare, Storico test, Fatture) diventano pannelli richiudibili, aperto il primo.
- I vecchi indirizzi diretti a una scheda continuano a funzionare: se arriva `livello` si apre "Sportivo" già posizionata sul blocco giusto.
- Nessun componente viene riscritto: si spostano solo dentro i nuovi contenitori.

## 2. Planning ghiaccio: un solo menu contestuale

Oggi convivono modalità "costruzione", elenco "da posizionare" e wizard, ognuna con un suo dialogo: la stessa azione si raggiunge in tre modi diversi.

Nuovo comportamento:
- Un click su uno slot del planning apre **un unico menu** con le azioni pertinenti a quello slot: *Posiziona corso qui*, *Sposta*, *Annulla lezione*, *Avvisa atleti*, *Dettagli*.
- Il menu mostra solo le voci valide per quello slot (slot vuoto vs. slot occupato), quindi niente pulsanti spenti.
- I dialoghi esistenti (Sposta, Annulla, Avvisa, Wizard posizionamento) restano identici: cambia solo il punto da cui si aprono.
- La modalità "costruzione" resta disponibile come interruttore per il posizionamento rapido a 2 click, ma non è più necessaria per fare le operazioni ordinarie.
- L'elenco "Da posizionare" diventa una colonna da cui si trascina/clicca il corso e poi si sceglie lo slot, senza percorso separato.

## 3. Corsi: wizard unico a 2 step

Oggi il wizard ha 4 step e la collocazione si fa spesso in un secondo momento.

Nuova struttura:
- **Step 1 — Il corso**: nome, tipo, livello, durata, capienza, costo.
- **Step 2 — Quando e con chi**: proposta automatica di slot già in evidenza (ghiaccio libero + istruttore disponibile), con possibilità di cambiare giorno/ora dalla griglia e scegliere l'istruttore nel pannello che resta sempre visibile.
- Il riepilogo finale non è più uno step: diventa una striscia di verifica in fondo allo step 2 ("Ghiaccio ok · Istruttore ok · Capienza ok").
- Resta possibile salvare senza collocare: un'unica opzione chiara "Decido dopo dove metterlo".
- La logica di validazione, completezza, capienza e conflitti resta esattamente quella attuale.

## 4. Coerenza liste e terminologia

- Tutte le liste principali (Atleti, Corsi, Istruttori, Comunicazioni, Gare, Test, Richieste iscrizione, Fatture) usano lo **stesso blocco ricerca + filtri** già presente in `SearchableListLayout`: campo con lente, X per cancellare, altezza comoda per iPad, contatore risultati.
- **Terminologia unica** in tutta l'app:
  - "Da posizionare" (mai più "Backlog" né "Da pianificare")
  - "Incompleto" solo quando manca ghiaccio o istruttore, con la ragione scritta accanto
  - "Completo" quando slot + istruttore sono validi
- Voci di menu senza contenuto reale (Livelli, Sponsor se non usate dal club) vengono nascoste invece di portare a pagine vuote.
- Stati vuoti uniformi: icona, una frase che spiega, un pulsante che porta all'azione giusta.

---

## Note tecniche

- File toccati: `src/components/AtletaDetail.tsx`, `src/pages/PlanningPage.tsx` (+ nuovo `src/components/planning/SlotMenu.tsx`), `src/components/corsi/CorsoWizard.tsx`, `src/pages/CoursesPage.tsx`, e le pagine lista per l'allineamento a `SearchableListLayout`.
- Nessuna migration, nessuna modifica a RLS, autenticazione o filtri `club_id`.
- Solo classi Tailwind e token semantici, nessuno stile inline.
- Ogni area viene consegnata separatamente, così puoi verificarla prima di passare alla successiva.

## Ordine di consegna

1. Scheda Atleta (4 schede)
2. Corsi (wizard 2 step)
3. Planning (menu contestuale)
4. Coerenza liste e terminologia
