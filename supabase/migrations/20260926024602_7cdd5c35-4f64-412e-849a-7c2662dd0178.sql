insert into public.traduzioni_ui(namespace, chiave, it, de, fr, en, rm) values
  (
    'istruttori',
    'modal.avviso_dopo_creazione',
    'Dopo il salvataggio si aprirà la scheda della persona, dove potrai aggiungere disponibilità settimanale, compenso e accesso all''app.',
    'Nach dem Speichern öffnet sich das Profil der Person. Dort kannst du die wöchentliche Verfügbarkeit, die Vergütung und den App-Zugang ergänzen.',
    'Après l''enregistrement, la fiche de la personne s''ouvrira. Vous pourrez y ajouter les disponibilités hebdomadaires, la rémunération et l''accès à l''application.',
    'After saving, the person''s record will open. There you can add weekly availability, compensation and app access.',
    'Suenter avair memorisà s''avra la fitgha da la persuna. Là pos ti agiuntar la disponibilitad emnila, l''indemnisaziun e l''access a l''app.'
  ),
  ('istruttori', 'dettaglio.costo_lezioni', 'Costo club lezioni private', 'Clubkosten Privatlektionen', 'Coût du club pour les leçons privées', 'Club cost for private lessons', 'Custs dal club per lecziuns privatas'),
  ('istruttori', 'dettaglio.costo_lezioni_ora_min', 'Costo club lezioni private (ora · minuto)', 'Clubkosten Privatlektionen (Stunde · Minute)', 'Coût du club pour les leçons privées (heure · minute)', 'Club cost for private lessons (hour · minute)', 'Custs dal club per lecziuns privatas (ura · minuta)'),
  ('istruttori', 'dettaglio.contratto_compenso_fisso', 'Contratto a compenso fisso', 'Vertrag mit fixer Vergütung', 'Contrat à rémunération fixe', 'Fixed-compensation contract', 'Contract cun indemnisaziun fixa'),
  ('istruttori', 'dettaglio.margine_minuto_sul_prezzo', 'Margine/min (% sul prezzo di vendita)', 'Marge/Min. (% des Verkaufspreises)', 'Marge/min (% du prix de vente)', 'Margin/min (% of selling price)', 'Marge/min (% dal pretsch da vendita)')
on conflict (namespace, chiave) do update set
  it = excluded.it,
  de = excluded.de,
  fr = excluded.fr,
  en = excluded.en,
  rm = excluded.rm;