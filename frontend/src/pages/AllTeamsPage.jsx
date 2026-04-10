import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import "./AllTeamsPage.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const ROSTER_SLOTS = [
  { key: "catcher1", label: "C1" },
  { key: "catcher2", label: "C2" },
  { key: "firstBase", label: "1B" },
  { key: "secondBase", label: "2B" },
  { key: "thirdBase", label: "3B" },
  { key: "shortStop", label: "SS" },
  { key: "inField", label: "IF" },
  { key: "middleInField", label: "MIF" },
  { key: "utility", label: "UTIL" },
  { key: "outfielder1", label: "OF1" },
  { key: "outfielder2", label: "OF2" },
  { key: "outfielder3", label: "OF3" },
  { key: "outfielder4", label: "OF4" },
  { key: "outfielder5", label: "OF5" },
  { key: "pitcher1", label: "P1" },
  { key: "pitcher2", label: "P2" },
  { key: "pitcher3", label: "P3" },
  { key: "pitcher4", label: "P4" },
  { key: "pitcher5", label: "P5" },
  { key: "pitcher6", label: "P6" },
  { key: "pitcher7", label: "P7" },
  { key: "pitcher8", label: "P8" },
  { key: "pitcher9", label: "P9" },
];

function playerLabel(player) {
  if (!player) {
    return "Open Slot";
  }

  const bits = [player.name, player.team].filter(Boolean);
  return bits.length > 0 ? bits.join(" • ") : "Rostered Player";
}

function AllTeamsPage() {
  const [leagues, setLeagues] = useState([]);
  const [activeLeagueId, setActiveLeagueId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadLeagues() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch(`${API_BASE}/api/leagues`, {
          method: "GET",
          credentials: "include",
        });

        let data = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }

        if (!response.ok) {
          throw new Error(data.errorMessage || data.message || "Failed to load leagues.");
        }

        if (!isMounted) return;

        const nextLeagues = Array.isArray(data.leagues) ? data.leagues : [];
        setLeagues(nextLeagues);
        setActiveLeagueId((current) => current || nextLeagues[0]?._id || "");
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err.message || "Unable to load league rosters.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadLeagues();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeLeague = useMemo(() => {
    if (leagues.length === 0) return null;
    return leagues.find((league) => league._id === activeLeagueId) || leagues[0];
  }, [activeLeagueId, leagues]);

  const rosters = Array.isArray(activeLeague?.rosterIds) ? activeLeague.rosterIds : [];

  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">All Teams</p>
          <h1>League Team Summary</h1>
          <p className="muted">
            Compare every roster side by side in a draft-board style summary.
          </p>

          {leagues.length > 1 ? (
            <div className="league-tabs" role="tablist" aria-label="League selector">
              {leagues.map((league) => (
                <button
                  key={league._id}
                  type="button"
                  className={`league-tab${activeLeague?._id === league._id ? " active" : ""}`}
                  onClick={() => setActiveLeagueId(league._id)}
                >
                  {league.name}
                </button>
              ))}
            </div>
          ) : null}

          {activeLeague ? (
            <div className="league-summary-strip">
              <div className="league-summary-metric">
                <span className="league-summary-label">League</span>
                <strong>{activeLeague.name}</strong>
              </div>
              <div className="league-summary-metric">
                <span className="league-summary-label">Draft Type</span>
                <strong>{activeLeague.draftType}</strong>
              </div>
              <div className="league-summary-metric">
                <span className="league-summary-label">Teams</span>
                <strong>{activeLeague.teamCount}</strong>
              </div>
              <div className="league-summary-metric">
                <span className="league-summary-label">Budget Cap</span>
                <strong>${activeLeague.budgetCap}</strong>
              </div>
            </div>
          ) : null}

          {isLoading ? <p className="muted">Loading rosters...</p> : null}
          {!isLoading && errorMessage ? <p className="error">{errorMessage}</p> : null}
          {!isLoading && !errorMessage && !activeLeague ? (
            <p className="muted">Create a league to see all team rosters here.</p>
          ) : null}

          {!isLoading && !errorMessage && activeLeague ? (
            <div className="roster-board-wrap">
              <div className="roster-board">
                {rosters.map((roster, index) => (
                  <article className="roster-column" key={roster._id || `${roster.name}-${index}`}>
                    <div className="roster-column-head">
                      <p className="eyebrow">Owner {index + 1}</p>
                      <h2>{roster.name || `Team ${index + 1}`}</h2>
                      <p className="muted">Budget Left: ${roster.budgetLeft ?? activeLeague.budgetCap}</p>
                    </div>

                    <div className="roster-slot-list">
                      {ROSTER_SLOTS.map((slot) => {
                        const player = roster[slot.key];
                        return (
                          <div className="roster-slot-card" key={slot.key}>
                            <span className="roster-slot-label">{slot.label}</span>
                            <div className="roster-slot-content">
                              <strong>{playerLabel(player)}</strong>
                              <span className="muted">
                                {player?.positions || (player ? "Rostered" : "Waiting for draft pick")}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default AllTeamsPage;
