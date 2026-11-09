import { MotionConfig } from "framer-motion";
import AppRouter from "./router/AppRouter";
import { StudentsProvider } from "./context/StudentsContext";
import { AlumniProvider } from "./context/AlumniContext";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";

function App() {
  return (
    <AuthProvider>
      <StudentsProvider>
        <AlumniProvider>
          {/* respects the OS "reduce motion" setting */}
          <MotionConfig reducedMotion="user">
            <ToastProvider>
              <AppRouter />
            </ToastProvider>
          </MotionConfig>
        </AlumniProvider>
      </StudentsProvider>
    </AuthProvider>
  );
}

export default App;