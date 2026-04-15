import { useMemo, useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { useLeague } from "../leagues";
import "./AllTeamsPage.css";

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
  const { leagues, selectedLeagueId, isLoadingLeagues, setMyTeam } = useLeague();
  const [isSavingMyTeam, setIsSavingMyTeam] = useState(false);
  const [saveMyTeamError, setSaveMyTeamError] = useState("");

  const activeLeague = useMemo(() => {
    if (leagues.length === 0) return null;
    return leagues.find((league) => league._id === selectedLeagueId) || null;
  }, [leagues, selectedLeagueId]);

  const rosters = Array.isArray(activeLeague?.rosterIds) ? activeLeague.rosterIds : [];

  async function handleMyTeamChange(event) {
    const nextMyTeamId = event.target.value;
    if (!activeLeague || !nextMyTeamId) {
      return;
    }

    setIsSavingMyTeam(true);
    setSaveMyTeamError("");

    try {
      await setMyTeam(activeLeague._id, nextMyTeamId);
    } catch (err) {
      setSaveMyTeamError(err.message || "Unable to save My Team.");
    } finally {
      setIsSavingMyTeam(false);
    }
  }

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

          {isLoadingLeagues ? <p className="muted">Loading rosters...</p> : null}
          {!isLoadingLeagues && !activeLeague ? (
            <p className="muted">Select a league on the dashboard to see its team rosters here.</p>
          ) : null}

          {!isLoadingLeagues && activeLeague ? (
            <>
              <div className="my-team-selector-row">
                <label className="league-summary-label" htmlFor="my-team-selector">
                  Designate My Team
                </label>
                <select
                  id="my-team-selector"
                  className="my-team-select"
                  value={activeLeague.myTeam || ""}
                  onChange={handleMyTeamChange}
                  disabled={isSavingMyTeam}
                >
                  <option value="" disabled>
                    -- Select a team --
                  </option>
                  {rosters.map((roster, index) => (
                    <option key={roster._id || `my-team-option-${index}`} value={roster._id}>
                      {roster.name || `Team ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              {saveMyTeamError ? <p className="error">{saveMyTeamError}</p> : null}

              <div className="roster-board-wrap">
                <div className="roster-board">
                  {rosters.map((roster, index) => {
                    const isMyTeam = Boolean(activeLeague.myTeam) && String(activeLeague.myTeam) === String(roster._id);
                    return (
                      <article className="roster-column" key={roster._id || `${roster.name}-${index}`}>
                        <div className="roster-column-head">
                          <h2>{roster.name || `Team ${index + 1}`}</h2>
                          {isMyTeam ? <span className="my-team-badge">My Team</span> : null}
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
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default AllTeamsPage;
