import { useSyncExternalStore } from "react";

type State = {
  pending: number;
  last_saved_at: Date | null;
  just_saved: boolean;
  error: string | null;
};

let state: State = { pending: 0, last_saved_at: null, just_saved: false, error: null };
const listeners = new Set<() => void>();
let saved_timer: any = null;

function emit() {
  listeners.forEach((l) => l());
}

function set(partial: Partial<State>) {
  state = { ...state, ...partial };
  emit();
}

export const saving_store = {
  begin() {
    set({ pending: state.pending + 1, error: null });
  },
  success() {
    const next_pending = Math.max(0, state.pending - 1);
    set({ pending: next_pending, last_saved_at: new Date(), just_saved: true });
    if (saved_timer) clearTimeout(saved_timer);
    saved_timer = setTimeout(() => set({ just_saved: false }), 2000);
  },
  error(message: string) {
    set({ pending: Math.max(0, state.pending - 1), error: message, just_saved: false });
  },
  clear_error() {
    set({ error: null });
  },
  get(): State {
    return state;
  },
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useSavingState(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
