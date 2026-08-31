import React from "react";
import { useSignedPhoto } from "@/hooks/useSignedPhoto";

interface Props {
  /** Percorso dentro il bucket `foto-atleti` (colonna atleti.foto_path). */
  foto_path?: string | null;
  nome?: string | null;
  cognome?: string | null;
  /** Classi applicate all'immagine (e al segnaposto predefinito). */
  className?: string;
  /** Classi aggiuntive solo per il segnaposto predefinito. */
  fallback_className?: string;
  /** Segnaposto personalizzato mostrato quando non c'è foto. */
  fallback?: React.ReactNode;
  alt?: string;
}

/** Avatar atleta: firma il percorso al volo, con segnaposto finché/se manca la foto. */
const FotoAtleta: React.FC<Props> = ({
  foto_path,
  nome,
  cognome,
  className = "",
  fallback_className = "",
  fallback,
  alt,
}) => {
  const url = useSignedPhoto(foto_path);
  const iniziali = `${nome?.[0] ?? ""}${cognome?.[0] ?? ""}`.toUpperCase() || "?";

  if (url) {
    return <img src={url} alt={alt ?? `${nome ?? ""} ${cognome ?? ""}`.trim()} className={`object-cover ${className}`} />;
  }
  if (fallback !== undefined) return <>{fallback}</>;
  return (
    <div className={`bg-accent/10 text-accent flex items-center justify-center font-bold ${className} ${fallback_className}`}>
      {iniziali}
    </div>
  );
};

export default FotoAtleta;
