# Accorciare la Dashboard operativa

## Interventi
- Limitare a tre righe i widget richieste iscrizione, richieste lezioni private e istruttori disponibili.
- Recuperare quattro record per distinguere “tre o meno” da “altri presenti”, mostrando il numero restante e il collegamento alla pagina completa.
- Gestire caricamento, guasto e vuoto come stati separati, segnalando gli errori di lettura una sola volta tramite il gestore esistente.
- Sostituire il modulo comunicazioni sempre aperto con un riquadro compatto e un pulsante che apre lo stesso modulo in una finestra scorrevole.
- Conservare la precompilazione degli auguri: il relativo pulsante aprirà direttamente la finestra già compilata.
- Rendere ogni lezione privata odierna richiudibile, con intestazione contenente ora, istruttore e numero di atleti.
- Aggiungere i testi necessari nelle quattro lingue.

## Dettagli tecnici
- I widget useranno query delimitate al club e `.limit(4)`; le prime tre righe saranno visibili e la quarta segnalerà che esistono altri risultati.
- La riga finale porterà rispettivamente a `/richieste-iscrizione`, `/lezioni-private` e `/istruttori`.
- Il modulo comunicazioni resterà lo stesso componente `BoxComunicazione`, spostato dentro `Dialog`.
- Verifica finale con TypeScript e controllo mirato del comportamento in anteprima, senza pubblicazione.
