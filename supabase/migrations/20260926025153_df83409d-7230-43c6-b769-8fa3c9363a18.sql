INSERT INTO public.traduzioni_ui (namespace, chiave, it, de, fr, en, rm)
VALUES (
  'istruttori',
  'dettaglio.vendita_sotto_costo',
  'Vendita sotto costo',
  'Verkauf unter den Kosten',
  'Vente à perte',
  'Selling below cost',
  'Vendita sut ils custs'
)
ON CONFLICT (namespace, chiave) DO UPDATE SET
  it = EXCLUDED.it,
  de = EXCLUDED.de,
  fr = EXCLUDED.fr,
  en = EXCLUDED.en,
  rm = EXCLUDED.rm;