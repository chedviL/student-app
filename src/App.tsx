import AppRouter from "./router/AppRouter";
import { StudentsProvider } from "./context/StudentsContext";
import { AlumniProvider } from "./context/AlumniContext";
import { AuthProvider } from "./context/AuthContext";

function App() {
  return (
    <AuthProvider>
      <StudentsProvider>
        <AlumniProvider>
          <AppRouter />
        </AlumniProvider>
      </StudentsProvider>
    </AuthProvider>
  );
}

export default App;