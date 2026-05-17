import { useMemo } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { useAuth } from "./auth/index.jsx";
import { useLeague } from "./leagues";
import { LiveUpdateProvider } from "./live-updates";
import LiveUpdateNoticeCenter from "./live-updates/LiveUpdateNoticeCenter";
import AllTeamsPage from "./pages/AllTeamsPage";
import ApiDashboardPage from "./pages/ApiDashboardPage";
import CustomPlayersPage from "./pages/CustomPlayersPage";
import LoggedInHomePage from "./pages/LoggedInHomePage";
import LoginPage from "./pages/LoginPage";
import MyTeamPage from "./pages/MyTeamPage";
import PlayerSearchPage from "./pages/PlayerSearchPage";
import PublicHomePage from "./pages/PublicHomePage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import RostersPage from "./pages/RostersPage";
import TaxiDraftPage from "./pages/TaxiDraftPage.jsx";
import SettingsPage from "./pages/SettingsPage";
import TransactionsPage from "./pages/TransactionsPage";

function ProtectedRoute({ isLoggedIn, children }) {
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function LeagueProtectedRoute({ isLoggedIn, hasSelectedLeague, children }) {
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  if (!hasSelectedLeague) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  const { isLoading, isLoggedIn } = useAuth();
  const { hasSelectedLeague } = useLeague();

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
    <LiveUpdateProvider key={isLoggedIn ? "live-updates-active" : "live-updates-idle"} enabled={isLoggedIn}>
      <LiveUpdateNoticeCenter />
      <Routes>
        <Route path="/" element={homeElement} />
        <Route
          path="/all-teams"
          element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <AllTeamsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-team"
          element={
            <LeagueProtectedRoute isLoggedIn={isLoggedIn} hasSelectedLeague={hasSelectedLeague}>
              <MyTeamPage />
            </LeagueProtectedRoute>
          }
        />
        <Route
          path="/player-search"
          element={
            <LeagueProtectedRoute isLoggedIn={isLoggedIn} hasSelectedLeague={hasSelectedLeague}>
              <PlayerSearchPage />
            </LeagueProtectedRoute>
          }
        />
        <Route
          path="/custom-players"
          element={
            <LeagueProtectedRoute isLoggedIn={isLoggedIn} hasSelectedLeague={hasSelectedLeague}>
              <CustomPlayersPage />
            </LeagueProtectedRoute>
          }
        />
        <Route
          path="/rosters/:rosterId"
          element={
            <LeagueProtectedRoute isLoggedIn={isLoggedIn} hasSelectedLeague={hasSelectedLeague}>
              <RostersPage />
            </LeagueProtectedRoute>
          }
        />
        <Route
          path="/taxi"
          element={
            <LeagueProtectedRoute isLoggedIn={isLoggedIn} hasSelectedLeague={hasSelectedLeague}>
              <TaxiDraftPage />
            </LeagueProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <LeagueProtectedRoute isLoggedIn={isLoggedIn} hasSelectedLeague={hasSelectedLeague}>
              <TransactionsPage />
            </LeagueProtectedRoute>
          }
        />
        <Route
          path="/api-dashboard"
          element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <ApiDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/login"
          element={isLoggedIn ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={isLoggedIn ? <Navigate to="/" replace /> : <RegisterPage />}
        />
        <Route
          path="/forgot-password"
          element={isLoggedIn ? <Navigate to="/" replace /> : <ForgotPasswordPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LiveUpdateProvider>
  );
}

export default App;
