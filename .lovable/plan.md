# Conferma tablet e campagna rinnovi

## Risultato
- Rendere la conferma di scollegamento grande, severa e sicura, con «Annulla» preselezionato.
- Trasformare «Rinnovi» in un tabellone di monitoraggio, lasciando le azioni manuali come eccezione.
- Portare la risposta al rinnovo nella home delle famiglie.

## Interventi
1. **Tablet bordo pista**
   - Ampliare la conferma esistente, aumentare gerarchia e spaziatura, adattare i pulsanti agli schermi stretti.
   - Usare la nuova chiave `pista.esci_domanda`; mantenere invariata la chiamata a `esci_dalla_pista()`.
   - Impostare esplicitamente il focus iniziale su «Annulla».

2. **Tabellone rinnovi della segreteria**
   - Usare lo stato campagna già disponibile per riepilogo, scadenza e avanzamento.
   - Mostrare per impostazione predefinita solo chi è in attesa, spiegando che rispondono le famiglie.
   - Conservare conferma/rifiuto manuali come eccezioni dichiarate.
   - Riusare l'invio esistente agli atleti invitati per «Sollecita chi non ha risposto».
   - Chiudere la campagna tramite la funzione esistente, con conferma esplicita del numero coinvolto e dell'archiviazione.

3. **Home famiglie**
   - Leggere `rinnovo_da_confermare()` distinguendo caricamento, errore, assenza e successo.
   - Mostrare la richiesta solo quando la campagna è aperta e la risposta è ancora pendente.
   - Confermare entrambe le scelte prima della scrittura; dopo il successo mostrare l'esito registrato.

4. **Testi e verifica**
   - Aggiungere tutti i nuovi testi nei quattro file lingua, senza testo scritto direttamente nelle pagine.
   - Verificare compilazione e comportamento su schermo stretto; provare i flussi autenticati disponibili senza creare dati permanenti.

## Vincoli tecnici
- Nessuna modifica a database, policy, funzioni, trigger, Setup o pista oltre alla finestra richiesta.
- Ogni lettura controlla l'errore; ogni scrittura resta bloccata finché le letture necessarie non sono riuscite.
- Le chiamate esistenti mantengono isolamento per club e controlli lato server.