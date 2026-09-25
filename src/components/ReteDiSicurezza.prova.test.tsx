import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
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
  it("lascia in piedi il menu e si sblocca cambiando pagina", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => {
      root.render(
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
    });
    expect(div.querySelector("[role=alert]")?.textContent).toContain("ERRORE FINTO");
    expect(div.querySelector("nav a")?.textContent).toBe("MENU-ALTRA");
    expect(segnala_errore).toHaveBeenCalledTimes(1);
    await act(async () => {
      (div.querySelector("nav a") as HTMLAnchorElement).click();
    });
    expect(div.querySelector("[role=alert]")).toBeNull();
    expect(div.textContent).toContain("PAGINA-ALTRA");
    expect(segnala_errore).toHaveBeenCalledTimes(1);
  });
});
