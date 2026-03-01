import { useMemo } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { useAuth } from "./auth/index.jsx";
import AllTeamsPage from "./pages/AllTeamsPage";
import ApiDashboardPage from "./pages/ApiDashboardPage";
import LoggedInHomePage from "./pages/LoggedInHomePage";
import LoginPage from "./pages/LoginPage";
import MyTeamPage from "./pages/MyTeamPage";
import PlayerSearchPage from "./pages/PlayerSearchPage";
import PublicHomePage from "./pages/PublicHomePage";
import RegisterPage from "./pages/RegisterPage";
import RostersPage from "./pages/RostersPage";
import SettingsPage from "./pages/SettingsPage";
import TransactionsPage from "./pages/TransactionsPage";

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
        path="/all-teams"
        element={isLoggedIn ? <AllTeamsPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/my-team"
        element={isLoggedIn ? <MyTeamPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/player-search"
        element={isLoggedIn ? <PlayerSearchPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/rosters"
        element={isLoggedIn ? <RostersPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/transactions"
        element={isLoggedIn ? <TransactionsPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/api-dashboard"
        element={isLoggedIn ? <ApiDashboardPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/settings"
        element={isLoggedIn ? <SettingsPage /> : <Navigate to="/" replace />}
      />
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
