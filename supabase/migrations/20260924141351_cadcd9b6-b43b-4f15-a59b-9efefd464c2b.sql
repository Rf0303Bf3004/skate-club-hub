insert into public.traduzioni_ui(namespace,chiave,it,de,fr,en,rm) values
('onboarding','procedura.titolo','Procedura guidata','Geführter Start','Procédure guidée','Guided setup','Procedura guidada'),
('onboarding','procedura.passo','Passo {{n}} di {{m}}','Schritt {{n}} von {{m}}','Étape {{n}} sur {{m}}','Step {{n}} of {{m}}','Pass {{n}} da {{m}}'),
('onboarding','procedura.vai','Vai','Los','Y aller','Go','Ir'),
('onboarding','procedura.esci','Esci dalla procedura guidata','Geführten Start beenden','Quitter la procédure guidée','Leave guided setup','Sortir da la procedura guidada'),
('onboarding','procedura.riprendi','Riprendi la procedura guidata','Geführten Start fortsetzen','Reprendre la procédure guidée','Resume guided setup','Cuntinuar la procedura guidada'),
('onboarding','procedura.pronto','Il club è pronto: tutti i controlli bloccanti sono a posto.','Der Club ist bereit: Alle blockierenden Prüfungen sind erledigt.','Le club est prêt : tous les contrôles bloquants sont en ordre.','The club is ready: all blocking checks are done.','Il club è pront: tut las controllas che blocheschan èn en urden.'),
('onboarding','procedura.chiudi','Chiudi','Schliessen','Fermer','Close','Serrar'),
('onboarding','procedura.errore','Non riesco a leggere i passi','Die Schritte können nicht gelesen werden','Impossible de lire les étapes','The steps can''t be read','Ils pass na pon betg vegnir legids'),
('onboarding','procedura.caricamento','Leggo i passi…','Schritte werden gelesen…','Lecture des étapes…','Reading the steps…','Jau leg ils pass…'),
('onboarding','procedura.riprova','Riprova','Erneut versuchen','Réessayer','Try again','Empruvar anc ina giada')
on conflict (namespace,chiave) do update set it=excluded.it,de=excluded.de,fr=excluded.fr,en=excluded.en,rm=excluded.rm;