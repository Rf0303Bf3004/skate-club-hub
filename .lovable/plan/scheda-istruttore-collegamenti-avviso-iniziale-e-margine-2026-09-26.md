# Scheda istruttore: collegamenti, avviso iniziale e margine

## Verifica della diagnosi
- Confermare dal comportamento dei tab che il clic cambia davvero scheda, ma non sposta la pagina: disponibilità e compenso vengono montati sotto il riquadro «Cosa manca»; accesso apre invece una finestra e richiede un trattamento coerente.
- Riutilizzare l’animazione `animate-evidenzia-passo motion-reduce:animate-none` già impiegata dalla procedura guidata.

## Modifiche
- Aggiungere riferimenti alle tre destinazioni e una richiesta di navigazione: cambiare scheda o aprire l’accesso, attendere che il riquadro esista, scorrere al centro e applicare per pochi secondi l’evidenziazione esistente.
- Mostrare nel modulo solo in creazione una frase discreta che anticipa disponibilità, compenso e accesso dopo il salvataggio.
- Nella scheda Informazioni, lasciare sempre visibile il prezzo di vendita; solo per chi può vedere i costi mostrare costo lezioni orario e al minuto, oppure il compenso fisso. Mostrare il margine al minuto e la percentuale sul prezzo solo con contratto orario e costo positivo; evidenziare i margini negativi.
- Aggiungere tutte le nuove etichette in italiano, tedesco svizzero, francese, inglese e romancio, sia nei file sia in `traduzioni_ui`.

## Verifica
- Provare il cambio scheda e lo scorrimento/evidenziazione nel browser, compreso il mantenimento del cursore con contenuto montato dopo il clic.
- Verificare i casi economici: permesso negato, contratto fisso, costo nullo, margine positivo e negativo.
- Rileggere integralmente ogni file modificato e controllare l’anteprima dopo la compilazione automatica.
