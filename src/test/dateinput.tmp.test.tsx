import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import React from "react";
import DateInput from "@/components/forms/DateInput";

function digita(gg: string, mm: string, aaaa: string) {
  const onChange = vi.fn();
  render(<DateInput value="" onChange={onChange} />);
  const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
  fireEvent.change(inputs[0], { target: { value: gg } });
  fireEvent.change(inputs[1], { target: { value: mm } });
  fireEvent.change(inputs[2], { target: { value: aaaa } });
  const alert = screen.queryByRole("alert");
  return { emesso: onChange.mock.calls.map((c) => c[0]).filter(Boolean), messaggio: alert?.textContent ?? null };
}

describe("DateInput", () => {
  const casi: Array<[string, string, string]> = [
    ["31", "02", "2026"],
    ["29", "02", "2024"],
    ["29", "02", "2026"],
    ["31", "04", "2026"],
    ["00", "01", "2026"],
    ["15", "13", "2026"],
    ["01", "01", "1899"],
    ["01", "01", "2101"],
    ["14", "09", "2026"],
  ];
  it("casi", () => {
    for (const [g, m, y] of casi) {
      const r = digita(g, m, y);
      console.log(`${g}/${m}/${y} -> emesso=${JSON.stringify(r.emesso)} messaggio=${JSON.stringify(r.messaggio)}`);
    }
    expect(true).toBe(true);
  });
});
