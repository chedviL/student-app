import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { useEffect } from "react";
import Navbar from "../components/common/Navbar";
import HomePage from "../pages/HomePage";
import SearchStudentPage from "../pages/SearchStudentPage";
import DatabasePage from "../pages/DatabasePage";
import StudentCardPage from "../pages/StudentCardPage";
import EditPage from "../pages/EditPage";
import AlumniPage from "../pages/AlumniPage";
import AlumniCardPage from "../pages/AlumniCardPage";
import TuitionPage from "../pages/TuitionPage";
import PaymentsPage from "../pages/PaymentsPage";
import LoginPage from "../pages/LoginPage";
import SetPasswordPage from "../pages/SetPasswordPage";
import MaintenancePage from "../pages/MaintenancePage";
import AIAssistantPage from "../pages/AIAssistantPage";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "../context/AuthContext";

const MAINTENANCE_MODE = false;

const trans: Transition = { duration: 0.2, ease: "easeInOut" };
const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: trans,
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  const { session, loading } = useAuth();

  if (loading) return null;

  const hash = window.location.hash;
  if (session && hash.includes('type=invite')) {
    return <SetPasswordPage />;
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/set-password" element={session ? <SetPasswordPage /> : <Navigate to="/login" replace />} />

        <Route path="/" element={
          <ProtectedRoute>
            <motion.div {...pageTransition}><Navbar /><HomePage /></motion.div>
          </ProtectedRoute>
        } />
        <Route path="/search" element={
          <ProtectedRoute>
            <motion.div {...pageTransition}><Navbar /><SearchStudentPage /></motion.div>
          </ProtectedRoute>
        } />
        <Route path="/database" element={
          <ProtectedRoute>
            <motion.div {...pageTransition}><Navbar /><DatabasePage /></motion.div>
          </ProtectedRoute>
        } />
        <Route path="/edit" element={
          <ProtectedRoute>
            <motion.div {...pageTransition}><Navbar /><EditPage /></motion.div>
          </ProtectedRoute>
        } />
        <Route path="/student/:studentId" element={
          <ProtectedRoute>
            <motion.div {...pageTransition}><Navbar /><StudentCardPage /></motion.div>
          </ProtectedRoute>
        } />
        <Route path="/student/:studentId/tuition" element={
          <ProtectedRoute>
            <motion.div {...pageTransition}><Navbar /><TuitionPage /></motion.div>
          </ProtectedRoute>
        } />
        <Route path="/alumni" element={
          <ProtectedRoute>
            <motion.div {...pageTransition}><Navbar /><AlumniPage /></motion.div>
          </ProtectedRoute>
        } />
        <Route path="/alumni/:alumniId" element={
          <ProtectedRoute>
            <motion.div {...pageTransition}><Navbar /><AlumniCardPage /></motion.div>
          </ProtectedRoute>
        } />
        <Route path="/payments" element={
          <ProtectedRoute>
            <motion.div {...pageTransition}><Navbar /><PaymentsPage /></motion.div>
          </ProtectedRoute>
        } />
        <Route path="/ai" element={
          <ProtectedRoute>
            <motion.div {...pageTransition}><Navbar /><AIAssistantPage /></motion.div>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function AppRouter() {
  if (MAINTENANCE_MODE) {
    return <MaintenancePage />;
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
