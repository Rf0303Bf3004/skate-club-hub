// Il documento della fattura vive in un punto solo, condiviso col server:
// supabase/functions/_shared/fattura-documento.tsx
// Così il PDF generato dal browser e quello generato dall'automatismo notturno
// non possono divergere. Questo file resta per non cambiare gli import esistenti.
export type {
  FatturaAtletaRiga,
  FatturaQrData,
  FatturaAtletaData,
} from "../../supabase/functions/_shared/fattura-documento";
export {
  FatturaAtletaDocument,
  genera_fattura_atleta_blob,
} from "../../supabase/functions/_shared/fattura-documento";
