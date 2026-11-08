import { BrowserRouter, Route, Routes, useLocation, Navigate, Outlet } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
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
      <ScrollToTop />
      <AppRoutes />
    </BrowserRouter>
  );
}
