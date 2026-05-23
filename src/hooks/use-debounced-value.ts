import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, set_debounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => set_debounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
