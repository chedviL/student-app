import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * useState that survives leaving the page and coming back (and a refresh),
 * for the current browser tab only (sessionStorage). Supports Set values.
 * Used for list filters/sort/search so "back" from a card keeps the view.
 */
type Stored = { t: "set"; v: unknown[] } | { t: "val"; v: unknown };

function read<T>(key: string, initial: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null) return initial;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.t === "set") return new Set(parsed.v) as T;
    return parsed.v as T;
  } catch {
    return initial;
  }
}

export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => read(key, initial));
  useEffect(() => {
    try {
      const stored: Stored = value instanceof Set ? { t: "set", v: [...value] } : { t: "val", v: value };
      sessionStorage.setItem(key, JSON.stringify(stored));
    } catch {
      /* storage unavailable — keep in-memory state only */
    }
  }, [key, value]);
  return [value, setValue];
}

/** Clears every persisted view state (called on logout). */
export function clearPersistentState() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("view:"))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
