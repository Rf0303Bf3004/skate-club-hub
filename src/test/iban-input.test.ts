import { describe, it, expect } from "vitest";
import { compatta_iban, formatta_iban } from "@/components/forms/IbanInput";

// Replica della formula del cursore usata in IbanInput.onChange
function caret_dopo(prima: number, nuovo: string) {
  const spazi = prima === 0 ? 0 : Math.floor((prima - 1) / 4);
  return Math.min(prima + spazi, formatta_iban(nuovo).length);
}

describe("compatta_iban", () => {
  it("toglie spazi, a capo e mette in maiuscolo", () => {
    expect(compatta_iban("ch44 3199 9123\n0008 8901 2")).toBe("CH4431999123000889012");
    expect(compatta_iban("CH4431999123000889012")).toBe("CH4431999123000889012");
  });
});

describe("formatta_iban", () => {
  it("raggruppa ogni quattro caratteri", () => {
    expect(formatta_iban("CH4431999123000889012")).toBe("CH44 3199 9123 0008 8901 2");
    expect(formatta_iban("ch44")).toBe("CH44");
    expect(formatta_iban("")).toBe("");
  });
  it("incollato con spazi non li raddoppia", () => {
    expect(formatta_iban("CH44 3199 9123 0008 8901 2")).toBe("CH44 3199 9123 0008 8901 2");
  });
});

describe("cursore", () => {
  it("digitando in fondo resta in fondo", () => {
    // dopo 5 caratteri utili: "CH44 3" -> posizione 6
    expect(caret_dopo(5, "CH443")).toBe(6);
    // IBAN completo: 21 utili -> 26 (fine)
    expect(caret_dopo(21, "CH4431999123000889012")).toBe(26);
  });
  it("correggendo una cifra in mezzo il cursore non salta alla fine", () => {
    // cursore dopo il 3° carattere utile ("CH4|4 3199...") -> posizione 3, non 26
    expect(caret_dopo(3, "CH4431999123000889012")).toBe(3);
    // dopo il 4° utile: "CH44| 3199" -> posizione 4 (prima dello spazio)
    expect(caret_dopo(4, "CH4431999123000889012")).toBe(4);
    // dopo il 5° utile: "CH44 3|199" -> posizione 6
    expect(caret_dopo(5, "CH4431999123000889012")).toBe(6);
  });
  it("a inizio campo resta a zero", () => {
    expect(caret_dopo(0, "CH44")).toBe(0);
  });
});
