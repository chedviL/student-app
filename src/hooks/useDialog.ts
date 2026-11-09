import { useEffect, useRef } from "react";

/**
 * Accessible behaviour for a modal dialog:
 *  - Escape closes it (only the top-most dialog when they are stacked)
 *  - focus moves into the dialog and Tab stays inside it
 *  - focus returns to the element that opened it
 *  - the page behind it does not scroll
 *
 * Attach the returned ref to the dialog card (not the backdrop).
 */
const openDialogs: symbol[] = [];
let savedBodyOverflow = "";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void, open = true) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const id = Symbol("dialog");
    if (openDialogs.length === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openDialogs.push(id);

    const opener = document.activeElement as HTMLElement | null;
    const el = ref.current;
    if (el) {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      if (!el.hasAttribute("role")) el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      if (!el.contains(document.activeElement)) el.focus({ preventScroll: true });
    }

    const onKey = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== id) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key === "Tab" && ref.current) {
        const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (n) => n.offsetParent !== null,
        );
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      const i = openDialogs.indexOf(id);
      if (i >= 0) openDialogs.splice(i, 1);
      if (openDialogs.length === 0) document.body.style.overflow = savedBodyOverflow;
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open]);

  return ref;
}
