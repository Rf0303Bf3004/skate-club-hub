import SlotMenu from "@/components/planning/SlotMenu";
export default function SlotProbe() {
  return (
    <div style={{ padding: 20 }}>
      <SlotMenu titolo="Stellina 2" sottotitolo="Lun 08:00" on_dettagli={() => {}} on_modifica={() => {}} on_sposta={() => {}} on_annulla={() => {}} on_avvisa={() => {}} on_rimuovi={() => {}}>
        <div data-testid="slot" style={{ width: 120, height: 40, background: "#2563eb", color: "#fff" }}>slot</div>
      </SlotMenu>
    </div>
  );
}
