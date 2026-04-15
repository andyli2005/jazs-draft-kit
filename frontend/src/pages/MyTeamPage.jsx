import { useState } from "react";
import Header from "../components/Header";
import PlayerStatsPanel from "../components/PlayerStatsPanel";
import Sidebar from "../components/Sidebar";
import { Link } from "react-router-dom";
import { useLeague } from "../leagues";
import RosterPageContent from "./RosterPageContent";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function MyTeamPage() {
  const { selectedLeague, selectedLeagueId, refreshLeagues } = useLeague();
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [actionError, setActionError] = useState("");
  const leagueRosters = Array.isArray(selectedLeague?.rosterIds) ? selectedLeague.rosterIds : [];
  const myTeamRoster = selectedLeague?.myTeam
    ? leagueRosters.find((roster) => String(roster._id) === String(selectedLeague.myTeam)) || null
    : null;

  async function handleDropClick(player) {
    if (!selectedLeagueId || !myTeamRoster?._id || !player?.APIplayerId) return;
    const didConfirm = window.confirm(`Drop ${player.name || "this player"} from ${myTeamRoster.name || "My Team"}?`);
    if (!didConfirm) return;

    setActionError("");
    try {
      const response = await fetch(`${API_BASE}/api/players/${player.APIplayerId}/drop`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: selectedLeagueId,
          rosterId: myTeamRoster._id,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.errorMessage || "Failed to drop player.");
      }
      await refreshLeagues();
      setSelectedPlayer(null);
    } catch (err) {
      setActionError(err.message || "Failed to drop player.");
    }
  }

  return (
    <main className="app-shell page-private">
      <Header />
      <div className={`app-body${selectedPlayer ? " app-body-with-panel" : ""}`}>
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">My Team</p>
          <h1>{myTeamRoster?.name || "My Team"}</h1>
          {!selectedLeague?.myTeam ? (
            <p className="muted">No team designated yet. Go to All Teams to select your team.</p>
          ) : null}
          {selectedLeague?.myTeam && !myTeamRoster ? (
            <p className="error">Unable to find the selected My Team roster in this league.</p>
          ) : null}
          {actionError ? <p className="error">{actionError}</p> : null}
          {myTeamRoster ? (
            <>
              <div className="my-team-toolbar">
                <p className="muted my-team-budget">Budget Left: ${myTeamRoster.budgetLeft ?? selectedLeague?.budgetCap ?? 0}</p>
                <Link className="btn btn-primary" to="/player-search">
                  Draft
                </Link>
              </div>
              <div className="my-team-roster-box">
                <RosterPageContent
                  roster={myTeamRoster}
                  budgetCap={selectedLeague?.budgetCap}
                  showBudget={false}
                  onPlayerSelect={setSelectedPlayer}
                />
              </div>
            </>
          ) : null}
        </section>
        {selectedPlayer ? (
          <PlayerStatsPanel
            player={selectedPlayer}
            fantasyPoints={selectedPlayer?.currentStats?.fantasyPoints ?? 0}
            cost={selectedPlayer?.price ?? 0}
            activeLeagueId={selectedLeagueId}
            onDropClick={handleDropClick}
            scrollWithPage
            onClose={() => setSelectedPlayer(null)}
          />
        ) : null}
      </div>
    </main>
  );
}

export default MyTeamPage;
