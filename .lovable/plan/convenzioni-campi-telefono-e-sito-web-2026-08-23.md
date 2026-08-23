# Convenzioni: campi Telefono e Sito web

## Dove si trova il form
Il form di creazione/modifica delle convenzioni è in `src/pages/SuperAdminConvenzioniPage.tsx` (pannello SuperAdmin "Convenzioni"): interfaccia `Convenzione`, payload di salvataggio (upsert) e il blocco JSX con il campo "Indirizzo". È l'unico punto in cui si scrivono le convenzioni; le altre pagine (`ConvenzioniSociPage`, `ConvenzionePubblicaPage`, `portale/profilo/ConvenzioniTab`) sono di sola lettura.

## Modifiche previste

1. Migrazione DB
   - `ALTER TABLE public.convenzioni ADD COLUMN telefono text, ADD COLUMN sito_web text;` (nullable, nessun default, nessun vincolo).

2. `src/pages/SuperAdminConvenzioniPage.tsx`
   - Aggiungere `telefono: string | null` e `sito_web: string | null` all'interfaccia `Convenzione`.
   - Aggiungere `telefono: form.telefono || null` e `sito_web: form.sito_web || null` al payload di salvataggio.
   - Aggiungere due `<Input>` opzionali ("Telefono", "Sito web") subito dopo il campo Indirizzo, nella stessa griglia.

Nessun'altra modifica: nessuna logica di pubblicazione/stato/validità toccata, nessuna altra tabella o pagina.
