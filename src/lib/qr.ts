import QRCode from "qrcode";

/**
 * Genera un QR come data URL locale (nessuna chiamata di rete, nessun dato
 * inviato a servizi di terzi). Ritorna stringa vuota se il valore è vuoto
 * o la generazione fallisce.
 */
export async function genera_qr_data_url(valore: string, size = 200): Promise<string> {
  const testo = (valore ?? "").trim();
  if (!testo) return "";
  try {
    return await QRCode.toDataURL(testo, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
    });
  } catch {
    return "";
  }
}
