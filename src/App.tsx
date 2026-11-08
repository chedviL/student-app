import { MotionConfig } from "framer-motion";
import AppRouter from "./router/AppRouter";
import { StudentsProvider } from "./context/StudentsContext";
import { AlumniProvider } from "./context/AlumniContext";
import { AuthProvider } from "./context/AuthContext";

function App() {
  return (
    <AuthProvider>
      <StudentsProvider>
        <AlumniProvider>
          {/* respects the OS "reduce motion" setting */}
          <MotionConfig reducedMotion="user">
            <AppRouter />
          </MotionConfig>
        </AlumniProvider>
      </StudentsProvider>
    </AuthProvider>
  );
}

export default App;