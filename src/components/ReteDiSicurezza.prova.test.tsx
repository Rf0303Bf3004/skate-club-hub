import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

vi.mock("@/lib/errori", () => ({ segnala_errore: vi.fn() }));
import { segnala_errore } from "@/lib/errori";
import ReteDiSicurezza from "./ReteDiSicurezza";

const RetePagina = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  return <ReteDiSicurezza key={location.pathname} dove="App.pagina">{children}</ReteDiSicurezza>;
};
const Rotta = () => { throw new Error("ERRORE FINTO"); };

describe("rete interna", () => {
  it("lascia in piedi il menu e si sblocca cambiando pagina", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={["/rotta"]}>
        <nav><Link to="/altra">MENU-ALTRA</Link></nav>
        <RetePagina>
          <Routes>
            <Route path="/rotta" element={<Rotta />} />
            <Route path="/altra" element={<p>PAGINA-ALTRA</p>} />
          </Routes>
        </RetePagina>
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert").textContent).toContain("ERRORE FINTO");
    expect(screen.getByText("MENU-ALTRA")).toBeTruthy();
    expect(segnala_errore).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("MENU-ALTRA"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("PAGINA-ALTRA")).toBeTruthy();
  });
});
