# Relazione del presidente: riconoscimenti e composizione semplice

## Obiettivo
- Rendere centrali i nomi delle atlete premiate, mantenendo gli altri dati personali esclusi.
- Trasformare la pagina in un documento modificabile a sinistra e un pannello essenziale a destra.
- Conservare stagione, tono, composizioni pronte, ordine, testi corretti, allegati e scaricamento.

## Interventi
1. **Nuovi moduli sportivi**
   - Aggiungere “Il podio della stagione”, acceso di default, con Atleta, Gara, Data, Livello e Medaglia.
   - Leggere soltanto le medaglie esplicite oro/argento/bronzo delle gare del club e della stagione scelta, recuperando i nomi dalla relativa anagrafica.
   - Ordinare le righe per data e mostrare “Nessun podio registrato in questa stagione” solo dopo una lettura riuscita e vuota.
   - Aggiungere “Test superati”, acceso di default, con Atleta, Livello ottenuto e Data, limitato ai test del club e della stagione scelta con esito esattamente `superato`.
   - Mantenere errori, caricamento e assenza di dati come stati distinti.

2. **Racconto sportivo**
   - Sostituire il riconoscimento alla sola atleta con più podi con l’elenco completo delle atlete salite sul podio, indicando medaglia e gara.
   - Usare gli stessi piazzamenti reali della nuova tabella, senza deduzioni dalla sola posizione.

3. **Documento modificabile**
   - Sostituire la schermata a quattro passi con una vista a due colonne: documento largo a sinistra, pannello stretto a destra.
   - Rendere il messaggio del presidente modificabile direttamente sulla prima pagina dopo la copertina, con salvataggio automatico.
   - Rendere i paragrafi dei capitoli cliccabili e modificabili direttamente nel documento; le correzioni manuali restano protette dalla rigenerazione.
   - Mostrare grafici e tabelle nello stesso ordine del PDF e rigenerare automaticamente l’anteprima del documento quando cambiano contenuti o composizione.
   - Collocare in fondo una zona di trascinamento PDF che usa lo stesso archivio privato e la stessa gestione allegati esistenti.

4. **Pannello “Cosa includere”**
   - Stato iniziale chiuso: mostrare soltanto Completa, Assemblea, Comitato e “Scegli modulo per modulo”.
   - Conservare la scelta stagione in una riga compatta nell’intestazione della pagina e il tono in una sola riga del pannello.
   - Da aperto, raggruppare le voci per area; ogni riga contiene solo casella di spunta e frecce su/giù.
   - Salvare automaticamente ogni modifica con le guardie già presenti; nessuna scrittura parte finché le letture necessarie non sono riuscite.

5. **Comandi e testi**
   - Lasciare un solo comando principale, “Scarica la relazione”, in alto a destra.
   - Eliminare dalla pagina i pulsanti separati di anteprima, salvataggio, schermo intero e download duplicato.
   - Aggiungere e allineare tutti i testi in italiano, inglese, francese e tedesco.

## Dettagli tecnici
- I nuovi moduli entrano nell’ordine canonico e nelle composizioni pronte tramite gli identificativi della composizione esistente; non richiedono modifiche al database.
- La pagina userà una rappresentazione HTML del documento per consentire modifica diretta e trascinamento; il file scaricato continuerà a essere prodotto dal generatore PDF esistente con gli stessi dati e ordine.
- Il caricamento allegati accetterà solo PDF validi e non creerà record se il caricamento del file fallisce.
- Verifica finale: controllo tipi, test mirati dei trasformatori dati, controllo visivo desktop/mobile e confronto sui dati Stella 2026/2027 (3 podi e 12 test superati).

## Limiti rispettati
- Nessuna modifica a dashboard, fatturazione, esportazione contabile, schema, funzioni o regole di accesso del database.
- Nessun dato individuale aggiunto fuori da podi e test superati; presenze, assenze e note restano aggregate o escluse.