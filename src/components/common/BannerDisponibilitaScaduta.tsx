import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { use_club } from "@/hooks/use-supabase-data";

function oggi_iso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Banner non bloccante: appare quando `clubs.disponibilita_valida_fino_al`
 * è impostata ed è già passata. Sparisce da solo appena la data viene
 * aggiornata (o svuotata) in Setup del Club.
 */
const BannerDisponibilitaScaduta: React.FC = () => {
  const { data: club } = use_club();
  const valida_fino_al: string | null = (club as any)?.disponibilita_valida_fino_al ?? null;
  if (!valida_fino_al) return null;
  if (valida_fino_al >= oggi_iso()) return null;

  const label = new Date(`${valida_fino_al}T00:00:00`).toLocaleDateString("it-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 flex items-start gap-3 shadow-sm">
      <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" />
      <p className="text-sm text-amber-900">
        <strong>La disponibilità ghiaccio/palestra di questo club non è più aggiornata</strong> (scaduta il {label}) —{" "}
        <Link to="/setup-club" className="underline font-semibold">
          vai in Setup per rivederla
        </Link>
        .
      </p>
    </div>
  );
};

export default BannerDisponibilitaScaduta;
