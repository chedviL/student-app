import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import "./Toast.css";

type ToastKind = "success" | "error";
interface ToastItem { id: number; kind: ToastKind; text: string }

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** One consistent "saved ✓ / failed ✗" notice at the bottom of the screen. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-2), { id, kind, text }]);
    window.setTimeout(() => dismiss(id), kind === "error" ? 6000 : 2800);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (text) => push("success", text),
    error: (text) => push("error", text),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              className={`toast toast--${t.kind}`}
              role={t.kind === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              {t.kind === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span className="toast-text">{t.text}</span>
              <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="סגירה">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const noop: ToastApi = { success: () => {}, error: () => {} };

// eslint-disable-next-line react-refresh/only-export-components -- hook lives next to its provider, like the other contexts
export function useToast(): ToastApi {
  // Fallback keeps components usable in isolation (e.g. unit tests without the provider)
  return useContext(ToastContext) ?? noop;
}
