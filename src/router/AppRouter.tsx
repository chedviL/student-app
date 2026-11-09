import { BrowserRouter, Route, Routes, useLocation, useNavigationType, Navigate, Outlet } from "react-router-dom";
import { Suspense, lazy, useEffect, useLayoutEffect, useRef } from "react";
import Navbar from "../components/common/Navbar";
import Loading, { Splash } from "../components/common/Loading";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "../context/AuthContext";

const MAINTENANCE_MODE = false;

// ── Code-splitting ────────────────────────────────────────────────────────────
// Home and Login are the first screens a user sees, so they stay in the main
// bundle. Every other page is downloaded on demand — and prefetched while the
// browser is idle right after login, so navigating still feels instant.
const pageImports = {
  search:      () => import("../pages/SearchStudentPage"),
  database:    () => import("../pages/DatabasePage"),
  edit:        () => import("../pages/EditPage"),
  studentCard: () => import("../pages/StudentCardPage"),
  tuition:     () => import("../pages/TuitionPage"),
  alumni:      () => import("../pages/AlumniPage"),
  alumniCard:  () => import("../pages/AlumniCardPage"),
  payments:    () => import("../pages/PaymentsPage"),
  ai:          () => import("../pages/AIAssistantPage"),
  feedback:    () => import("../pages/FeedbackPage"),
  setPassword: () => import("../pages/SetPasswordPage"),
  maintenance: () => import("../pages/MaintenancePage"),
};

const SearchStudentPage = lazy(pageImports.search);
const DatabasePage      = lazy(pageImports.database);
const EditPage          = lazy(pageImports.edit);
const StudentCardPage   = lazy(pageImports.studentCard);
const TuitionPage       = lazy(pageImports.tuition);
const AlumniPage        = lazy(pageImports.alumni);
const AlumniCardPage    = lazy(pageImports.alumniCard);
const PaymentsPage      = lazy(pageImports.payments);
const AIAssistantPage   = lazy(pageImports.ai);
const FeedbackPage      = lazy(pageImports.feedback);
const SetPasswordPage   = lazy(pageImports.setPassword);
const MaintenancePage   = lazy(pageImports.maintenance);

function prefetchPages() {
  const run = () => {
    Object.entries(pageImports).forEach(([name, load]) => {
      if (name !== "maintenance") load().catch(() => {});
    });
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 3000 });
  else window.setTimeout(run, 1500);
}

// ── Scroll restoration ────────────────────────────────────────────────────────
// New navigation → top of the page. Back/forward → the exact position the user
// left, so returning from a student card lands on the same row of the list.
const SCROLL_KEY = "scroll-positions";
function loadPositions(): Record<string, number> {
  try { return JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "{}"); } catch { return {}; }
}
const scrollPositions: Record<string, number> = loadPositions();
function persistPositions() {
  try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify(scrollPositions)); } catch { /* ignore */ }
}

function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();
  // the entry currently on screen — updated synchronously on commit so that
  // scroll events caused by the page swap are never saved under the old entry
  const activeKey = useRef(location.key);
  useLayoutEffect(() => {
    activeKey.current = location.key;
  }, [location.key]);

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  // remember positions of the window and of inner scroll areas marked with
  // data-scroll-key (e.g. the students table) while the user scrolls
  useEffect(() => {
    const key = location.key;
    let frame = 0;
    const onScroll = (e: Event) => {
      if (activeKey.current !== key) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        if (!target.dataset.scrollKey) return;
        scrollPositions[`${key}:${target.dataset.scrollKey}`] = target.scrollTop;
      } else {
        scrollPositions[key] = window.scrollY;
      }
      // writing to storage is batched to once per frame
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(persistPositions);
    };
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [location.key]);

  // restore (back/forward) or reset (new page)
  useEffect(() => {
    const key = location.key;
    const inner = Object.keys(scrollPositions).filter((k) => k.startsWith(`${key}:`));
    if (navType !== "POP" || (!scrollPositions[key] && inner.length === 0)) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    // the page (lazy code + data) may still be growing — retry for a moment
    let frame = 0;
    const started = performance.now();
    const pending = new Set(inner);
    let windowDone = !scrollPositions[key];
    const tryRestore = () => {
      const timedOut = performance.now() - started > 1500;
      if (!windowDone) {
        const target = scrollPositions[key];
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (maxScroll >= target || timedOut) {
          window.scrollTo({ top: target, behavior: "instant" });
          windowDone = true;
        }
      }
      for (const k of [...pending]) {
        const el = document.querySelector<HTMLElement>(`[data-scroll-key="${k.slice(key.length + 1)}"]`);
        const target = scrollPositions[k];
        if (el && (el.scrollHeight - el.clientHeight >= target || timedOut)) {
          el.scrollTop = target;
          pending.delete(k);
        } else if (timedOut) {
          pending.delete(k);
        }
      }
      if (!windowDone || pending.size > 0) frame = requestAnimationFrame(tryRestore);
    };
    tryRestore();
    return () => cancelAnimationFrame(frame);
  }, [location.key, navType]);

  return null;
}

/**
 * Shell for every logged-in page. The Navbar lives here, OUTSIDE the page, so it
 * is mounted once and never flickers or re-fetches on navigation. While a page's
 * code is downloading only the content area shows a loader.
 */
function AppLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    prefetchPages();
  }, []);

  return (
    <ProtectedRoute>
      <Navbar />
      <Suspense fallback={<Loading />}>
        {/* keyed fade-in: new page appears immediately, no waiting for an exit animation */}
        <div key={pathname} className="page-fade">
          <Outlet />
        </div>
      </Suspense>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) return <Splash />;

  const hash = window.location.hash;
  if (session && hash.includes("type=invite")) {
    return (
      <Suspense fallback={<Splash />}>
        <SetPasswordPage />
      </Suspense>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/set-password"
        element={
          session ? (
            <Suspense fallback={<Splash />}><SetPasswordPage /></Suspense>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchStudentPage />} />
        <Route path="/database" element={<DatabasePage />} />
        <Route path="/edit" element={<EditPage />} />
        <Route path="/student/:studentId" element={<StudentCardPage />} />
        <Route path="/student/:studentId/tuition" element={<TuitionPage />} />
        <Route path="/alumni" element={<AlumniPage />} />
        <Route path="/alumni/:alumniId" element={<AlumniCardPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/ai" element={<AIAssistantPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function AppRouter() {
  if (MAINTENANCE_MODE) {
    return (
      <Suspense fallback={<Splash />}>
        <MaintenancePage />
      </Suspense>
    );
  }

  return (
    <BrowserRouter>
      <ScrollManager />
      <AppRoutes />
    </BrowserRouter>
  );
}
