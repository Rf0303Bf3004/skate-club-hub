# Ritorno alla procedura guidata e nome unificato

## Modifiche
- Rendere il titolo della barra un collegamento a `/avvio`, salvo quando la pagina corrente è già `/avvio`.
- Mostrare lo stesso collegamento anche durante caricamento o errore, usando la nuova etichetta `procedura.vedi_passi` come suggerimento.
- Rinominare il titolo della pagina in «Procedura guidata» e sostituire le tre scritte manuali del menu con `common.menu.avvio_club`.
- Lasciare invariati il pulsante finale `avvio.vai_alla_lista`, gli altri comandi della barra e il resto del menu superadmin.

## Lingue e dati
- Aggiornare italiano, tedesco, francese e inglese; creare i file romanci mancanti con le sole chiavi necessarie.
- Allineare le tre chiavi in `traduzioni_ui` per tutte e cinque le lingue, senza altre modifiche al database.

## Verifica
- Rileggere integralmente tutti i file modificati e controllare che non restino le tre scritte manuali.
- Verificare in anteprima il collegamento da `/setup-club`, `/utenti` e `/stagioni`, il testo semplice su `/avvio`, e il menu per presidente e superadmin quando gli accessi sono disponibili.
- Controllare che `traduzioni_ui` restituisca cinque righe per ciascuna delle tre chiavi e che il controllo dei tipi passi.
