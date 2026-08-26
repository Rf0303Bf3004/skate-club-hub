import { useEffect, useState } from "react";
import { genera_qr_data_url } from "@/lib/qr";

/** Genera in locale il data URL di un QR, in modo reattivo. */
export function use_qr_data_url(valore: string | null | undefined, size = 200): string {
  const [data_url, set_data_url] = useState("");

  useEffect(() => {
    let annullato = false;
    (async () => {
      const url = await genera_qr_data_url(valore ?? "", size);
      if (!annullato) set_data_url(url);
    })();
    return () => {
      annullato = true;
    };
  }, [valore, size]);

  return data_url;
}
