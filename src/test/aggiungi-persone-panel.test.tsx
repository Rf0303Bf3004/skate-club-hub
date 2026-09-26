import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@/i18n";
import AggiungiPersonePanel, { type VocePannello } from "@/components/griglia/AggiungiPersonePanel";

const voci: VocePannello[] = [
  { chiave: "gruppo:club:Pulcini", tipo: "gruppo", etichetta: "Pulcini", sezione: "Club", active_id: "gruppo:club:Pulcini", data: { tipo: "gruppo", atleta_ids: ["a1"], livello: "Pulcini", box_id: "club" } },
  { chiave: "istruttore:i1", tipo: "istruttore", etichetta: "Anna Rossi", sezione: "Istruttori", stato: { tipo: "occupato", testo: "Già impegnato in: Freestyle" }, active_id: "istruttore:i1", data: null },
  { chiave: "istruttore:i2", tipo: "istruttore", etichetta: "Bea Verdi", sezione: "Istruttori", stato: { tipo: "libero", testo: "" }, active_id: "istruttore:i2", data: null },
];

describe("AggiungiPersonePanel", () => {
  it("si usa da tastiera: ricerca a fuoco, caselle tabulabili, conferma unica con voci identiche", () => {
    const on_conferma = vi.fn();
    render(<AggiungiPersonePanel open on_close={() => {}} titolo_sessione="17:00–18:00" voci={voci} on_conferma={on_conferma} esiti={null} in_corso={false} />);
    const ricerca = screen.getByRole("textbox");
    expect(document.activeElement).toBe(ricerca);
    const caselle = screen.getAllByRole("checkbox");
    expect(caselle).toHaveLength(3);
    caselle.forEach((c) => expect(c.tabIndex).not.toBe(-1));
    // liberi in cima: Bea (libera) prima di Anna (occupata)
    const testo = document.body.textContent ?? "";
    expect(testo.indexOf("Bea Verdi")).toBeLessThan(testo.indexOf("Anna Rossi"));
    expect(testo).toContain("Già impegnato in: Freestyle");
    fireEvent.click(caselle[0]);
    fireEvent.click(caselle[1]);
    fireEvent.click(screen.getByRole("button", { name: /2/ }));
    expect(on_conferma).toHaveBeenCalledTimes(1);
    const scelte = on_conferma.mock.calls[0][0] as VocePannello[];
    expect(scelte.map((v) => v.active_id)).toEqual(["gruppo:club:Pulcini", "istruttore:i2"]);
    expect(scelte[0].data).toEqual(voci[0].data);
  });
});
