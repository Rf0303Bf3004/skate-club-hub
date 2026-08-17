import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { risolvi_coordinata, scosta_coordinata, type coordinate } from "@/lib/convenzioni-geo";

// Fix icone default di Leaflet con i bundler
const default_icon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = default_icon;

export interface PuntoConvenzione {
  id: string;
  azienda: string;
  titolo: string;
  provincia?: string | null;
  citta?: string | null;
  regione?: string | null;
  nazione?: string | null;
}

interface Props<T extends PuntoConvenzione> {
  elementi: T[];
  on_open: (elemento: T) => void;
  height?: number;
}

export function MappaConvenzioni<T extends PuntoConvenzione>({ elementi, on_open, height = 460 }: Props<T>) {
  const gruppi = useMemo(() => {
    const map = new Map<string, { coord: coordinate; etichetta: string; voci: T[] }>();
    elementi.forEach((e) => {
      const coord = risolvi_coordinata({
        provincia: e.provincia,
        citta: e.citta,
        regione: e.regione,
        nazione: e.nazione,
      });
      if (!coord) return;
      const etichetta = e.provincia || e.citta || e.regione || e.nazione || "—";
      const key = `${etichetta}|${coord.lat.toFixed(3)}|${coord.lng.toFixed(3)}`;
      const entry = map.get(key) ?? { coord: scosta_coordinata(coord, key), etichetta, voci: [] as T[] };
      entry.voci.push(e);
      map.set(key, entry);
    });
    return [...map.values()];
  }, [elementi]);

  const centro = useMemo<coordinate>(() => {
    if (gruppi.length === 0) return { lat: 46.4, lng: 9.0 };
    const lat = gruppi.reduce((s, g) => s + g.coord.lat, 0) / gruppi.length;
    const lng = gruppi.reduce((s, g) => s + g.coord.lng, 0) / gruppi.length;
    return { lat, lng };
  }, [gruppi]);

  const senza_posizione = elementi.length - gruppi.reduce((n, g) => n + g.voci.length, 0);

  return (
    <div className="space-y-2">
      <div className="rounded-2xl overflow-hidden border border-border" style={{ height }}>
        <MapContainer
          center={[centro.lat, centro.lng]}
          zoom={gruppi.length > 1 ? 6 : 8}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {gruppi.map((g, i) => (
            <Marker key={i} position={[g.coord.lat, g.coord.lng]}>
              <Popup>
                <div className="min-w-[180px]">
                  <p className="font-semibold text-sm mb-1">{g.etichetta}</p>
                  <ul className="space-y-1">
                    {g.voci.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => on_open(v)}
                          className="text-left text-sm text-primary hover:underline"
                        >
                          {v.azienda} — <span className="text-muted-foreground">{v.titolo}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {senza_posizione > 0 && (
        <p className="text-xs text-muted-foreground">
          {senza_posizione} {senza_posizione === 1 ? "convenzione senza" : "convenzioni senza"} posizione geografica
          nota (aggiungi regione o provincia per vederle sulla mappa).
        </p>
      )}
    </div>
  );
}

export default MappaConvenzioni;
