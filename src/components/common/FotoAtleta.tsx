import React from "react";
import { useSignedPhoto } from "@/hooks/useSignedPhoto";

interface Props {
  /** Percorso dentro il bucket `foto-atleti` (colonna atleti.foto_path). */
  foto_path?: string | null;
  nome?: string | null;
  cognome?: string | null;
  /** Classi applicate sia all'immagine sia al segnaposto con le iniziali. */
  className?: string;
  /** Classi aggiuntive solo per il segnaposto. */
  fallback_className?: string;
  alt?: string;
}

/** Avatar atleta: firma il percorso al volo, con iniziali come segnaposto. */
const FotoAtleta: React.FC<Props> = ({ foto_path, nome, cognome, className = "", fallback_className = "", alt }) => {
  const url = useSignedPhoto(foto_path);
  const iniziali = `${nome?.[0] ?? ""}${cognome?.[0] ?? ""}`.toUpperCase() || "?";

  if (url) {
    return <img src={url} alt={alt ?? `${nome ?? ""} ${cognome ?? ""}`.trim()} className={`object-cover ${className}`} />;
  }
  return (
    <div className={`bg-accent/10 text-accent flex items-center justify-center font-bold ${className} ${fallback_className}`}>
      {iniziali}
    </div>
  );
};

export default FotoAtleta;
