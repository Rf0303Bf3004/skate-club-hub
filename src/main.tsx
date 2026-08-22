import { createRoot } from "react-dom/client";
import "@/i18n"; // inizializza react-i18next prima di qualunque componente
import { carica_traduzioni_db } from "@/i18n/db-loader";
import App from "./App.tsx";
import "./index.css";

// Le traduzioni gestite dal superadmin (tabella `traduzioni_ui`) hanno priorità
// sui file statici. Caricamento non bloccante: se fallisce restano i JSON bundlati.
void carica_traduzioni_db();

createRoot(document.getElementById("root")!).render(<App />);

