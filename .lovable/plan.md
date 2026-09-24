# Correzione del fondo pagina su mobile

## Intervento
- Nel portale genitori userò `100vh` come ripiego e `100dvh` come altezza effettiva del contenitore.
- Aggiungerò al contenuto principale uno spazio inferiore calcolato con `safe-area-inset-bottom`.
- Applicherò la stessa protezione al menu laterale e al pulsante «Esci».
- Controllerò tutte le altre occorrenze di `min-h-screen`, correggendo soltanto le pagine mobili realmente scrollabili; `PortaleAtletaPage.tsx` resterà invariata se il suo `pb-24` risulta sufficiente.

## Verifica
- Eseguirò il controllo dei tipi.
- Aprirò `/mio-club/notizie` a 390 px, con almeno 6 messaggi, scorrerò fino in fondo e controllerò visivamente l’ultimo messaggio completo, inclusi testo e pulsanti.
- Controllerò anche il menu laterale fino al pulsante «Esci» e riferirò ciò che è stato effettivamente osservato.

## Vincoli
- Nessuna modifica al database o alla logica.
- Se l’accesso a un profilo con almeno 6 messaggi non fosse disponibile, lo dichiarerò esplicitamente senza sostituire la prova con un’ipotesi.
