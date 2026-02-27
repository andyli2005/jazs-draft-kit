import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import { getLoggedIn, login, logout, register } from "./auth/requests";
import LoggedInHomePage from "./pages/LoggedInHomePage";
import LoginPage from "./pages/LoginPage";
import PublicHomePage from "./pages/PublicHomePage";
import RegisterPage from "./pages/RegisterPage";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function bootstrapAuth() {
      try {
        const response = await getLoggedIn();
        setIsLoggedIn(Boolean(response.loggedIn));
        setUser(response.user || null);
      } catch {
        setIsLoggedIn(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    bootstrapAuth();
  }, []);

  async function handleLogin(payload) {
    const response = await login(payload);
    setIsLoggedIn(true);
    setUser(response.user || null);
    return response;
  }

  async function handleRegister(payload) {
    const response = await register(payload);
    setIsLoggedIn(true);
    setUser(response.user || null);
    return response;
  }

  async function handleLogout() {
    await logout();
    setIsLoggedIn(false);
    setUser(null);
  }

  const homeElement = useMemo(() => {
    if (isLoggedIn) {
      return <LoggedInHomePage user={user} onLogout={handleLogout} />;
    }
    return <PublicHomePage />;
  }, [isLoggedIn, user]);

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
        element={isLoggedIn ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />}
      />
      <Route
        path="/register"
        element={isLoggedIn ? <Navigate to="/" replace /> : <RegisterPage onRegister={handleRegister} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
