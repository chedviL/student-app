import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * "Back" that never leaves the app: goes back in history when the previous
 * entry belongs to this app, otherwise navigates to `fallback`
 * (e.g. when the page was opened directly from a link or in a new tab).
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
