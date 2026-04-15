import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/index.jsx";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import CreateLeagueModal from "../components/CreateLeagueModal";
import EditLeagueModal from "../components/EditLeagueModal";
import { useLeague } from "../leagues";

function LoggedInHomePage() {
  const { user } = useAuth();
  const { leagues, isLoadingLeagues, refreshLeagues, selectLeague, selectedLeagueId } = useLeague();
  const [showModal, setShowModal] = useState(false);
  const [editingLeague, setEditingLeague] = useState(null);

  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card hero">
          <p className="eyebrow">Welcome back</p>
          <h1>{user?.userName ? user.userName : "Draft Kit User"}</h1>
          <p className="muted">You are signed in as {user?.email}.</p>
          <div className="actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setShowModal(true)}
            >
              Start New Draft
            </button>
          </div>

          <section className="dashboard-leagues">
            <div className="dashboard-leagues-header">
              <div>
                <p className="eyebrow">Your leagues</p>
                <h2>Leagues on your dashboard</h2>
              </div>
              <span className="dashboard-league-count">
                {isLoadingLeagues ? "Loading..." : `${leagues.length} total`}
              </span>
            </div>

            {isLoadingLeagues ? <p className="muted">Loading your leagues...</p> : null}

            {!isLoadingLeagues && leagues.length === 0 ? (
              <p className="muted">
                You have not created a league yet. Start a new draft to create one.
              </p>
            ) : null}

            {!isLoadingLeagues && leagues.length > 0 ? (
              <div className="dashboard-league-grid">
                {leagues.map((league) => (
                  <article
                    className={`dashboard-league-card${selectedLeagueId === league._id ? " selected" : ""}`}
                    key={league._id}
                  >
                    <div className="dashboard-league-top">
                      <div className="dashboard-league-title-wrap">
                        <h3>{league.name}</h3>
                        <button
                          className="btn btn-secondary dashboard-league-edit-btn"
                          type="button"
                          onClick={() => setEditingLeague(league)}
                        >
                          Edit League
                        </button>
                      </div>
                      <span className="dashboard-league-sport">{league.sport}</span>
                    </div>
                    <p className="muted">
                      {league.draftType} draft with {league.teamCount} teams
                    </p>
                    <p className="dashboard-league-meta">Budget cap: ${league.budgetCap}</p>
                    <div className="dashboard-league-actions">
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => selectLeague(league)}
                      >
                        {selectedLeagueId === league._id ? "Selected League" : "Select League"}
                      </button>
                      <Link
                        className="btn btn-primary"
                        to="/player-search"
                        onClick={() => selectLeague(league)}
                      >
                        Open Draft Board
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </section>
      </div>
      <CreateLeagueModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={refreshLeagues}
      />
      <EditLeagueModal
        open={Boolean(editingLeague)}
        league={editingLeague}
        onClose={() => setEditingLeague(null)}
        onSaved={refreshLeagues}
      />
    </main>
  );
}

export default LoggedInHomePage;
