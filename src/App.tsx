import AppRouter from "./router/AppRouter";
import { StudentsProvider } from "./context/StudentsContext";

function App() {
  return (
    <StudentsProvider>
      <AppRouter />
    </StudentsProvider>
  );
}

export default App;