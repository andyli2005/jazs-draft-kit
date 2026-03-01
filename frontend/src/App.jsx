import { useMemo } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { useAuth } from "./auth/index.jsx";
import LoggedInHomePage from "./pages/LoggedInHomePage";
import LoginPage from "./pages/LoginPage";
import PublicHomePage from "./pages/PublicHomePage";
import RegisterPage from "./pages/RegisterPage";

function App() {
  const { isLoading, isLoggedIn } = useAuth();

  const homeElement = useMemo(() => {
    if (isLoggedIn) {
      return <LoggedInHomePage />;
    }
    return <PublicHomePage />;
  }, [isLoggedIn]);

  if (isLoading) {
    return (
      <main className="page">
        <section className="card loading">Checking session...</section>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/" element={homeElement} />
      <Route
        path="/login"
        element={isLoggedIn ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isLoggedIn ? <Navigate to="/" replace /> : <RegisterPage />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
