import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { useEffect } from "react";
import Navbar from "../components/common/Navbar";
import HomePage from "../pages/HomePage";
import SearchStudentPage from "../pages/SearchStudentPage";
import DatabasePage from "../pages/DatabasePage";
import StudentCardPage from "../pages/StudentCardPage";
import EditPage from "../pages/EditPage";

// אנימציה עדינה — fade בלבד, ללא תזוזת y שגורמת לקפיצות
const trans: Transition = { duration: 0.2, ease: "easeInOut" };
const pageTransition = {
  initial:    { opacity: 0 },
  animate:    { opacity: 1 },
  exit:       { opacity: 0 },
  transition: trans,
};

// גלילה לראש העמוד בכל מעבר ניווט
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={<motion.div {...pageTransition}><HomePage /></motion.div>}
        />
        <Route
          path="/search"
          element={<motion.div {...pageTransition}><SearchStudentPage /></motion.div>}
        />
        <Route
          path="/database"
          element={<motion.div {...pageTransition}><DatabasePage /></motion.div>}
        />
        <Route
          path="/edit"
          element={<motion.div {...pageTransition}><EditPage /></motion.div>}
        />
        <Route
          path="/student/:studentId"
          element={<motion.div {...pageTransition}><StudentCardPage /></motion.div>}
        />
      </Routes>
    </AnimatePresence>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Navbar />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
