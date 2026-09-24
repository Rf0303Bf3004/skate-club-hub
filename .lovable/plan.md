# Portale genitori mobile e installabile

## 1. Fondo pagina e zona sicura
- Userò `100vh` come ripiego e `100dvh` come altezza dinamica nel portale genitori.
- Proteggerò contenuto, menu laterale e pulsante «Esci» con `safe-area-inset-bottom`.
- Controllerò le altre pagine mobili scrollabili con `min-h-screen`; correggerò solo i casi realmente esposti e lascerò invariato `PortaleAtletaPage.tsx` se il suo `pb-24` è sufficiente.

## 2. Installazione sul telefono
- Aggiungerò manifesto, icone 192/512/maskable e icona Apple ricavate dal fiocco di neve già usato.
- Completerò i meta mobile e `viewport-fit=cover`, senza service worker.
- Mostrerò una sola volta un invito chiudibile: installazione nativa su Android, istruzione testuale su iPhone.

## 3. Navigazione mobile
- Sotto 1024 px aggiungerò la barra inferiore fissa con le cinque destinazioni esistenti, aree toccabili di almeno 44 px e stato attivo.
- Il menu laterale mobile resterà disponibile per cambio profilo e uscita; sopra 1024 px il comportamento attuale resterà invariato.
- Il contenuto avrà spazio per barra e zona sicura.

## Traduzioni e verifica
- Aggiungerò le nuove etichette in it, de, fr, en e rm, sia nei file sia in `traduzioni_ui`; questa sarà l’unica modifica ai dati.
- Controllerò i tipi e verificherò a 390 px `/mio-club/notizie` con almeno 6 messaggi, l’ultimo messaggio completo, i pulsanti, la barra inferiore, il menu e l’invito di installazione.
- Riferirò separatamente ciò che è stato realmente osservato per ciascun lavoro e dichiarerò ogni prova non eseguibile.
