insert into public.traduzioni_ui(namespace,chiave,it,de,fr,en,rm) values
('onboarding','procedura.fatto','Fatto: {{controllo}}','Erledigt: {{controllo}}','Fait : {{controllo}}','Done: {{controllo}}','Fatg: {{controllo}}'),
('onboarding','procedura.ricontrolla','Ricontrolla','Erneut prüfen','Revérifier','Check again','Controllar danovamain'),
('onboarding','procedura.ricontrollo_in_corso','Ricontrollo…','Wird geprüft…','Vérification…','Checking…','Jau controllesch…')
on conflict (namespace,chiave) do update set it=excluded.it,de=excluded.de,fr=excluded.fr,en=excluded.en,rm=excluded.rm;