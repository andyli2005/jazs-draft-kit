import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const SORT_OPTIONS = [
  { key: "fill", label: "Roster Fill" },
  { key: "totalValue", label: "Est. Value" },
  { key: "budgetLeft", label: "Budget Left" },
  { key: "spent", label: "Budget Spent" },
  { key: "name", label: "Team Name" },
];

function rosterFill(roster) {
  return ROSTER_SLOTS.filter((slot) => roster[slot.key]).length;
}

function rosterTotalValue(roster) {
  return ROSTER_SLOTS.reduce((sum, slot) => sum + (roster[slot.key]?.price || 0), 0);
}

function AllTeamsPage() {
  const navigate = useNavigate();
  const { leagues, selectedLeagueId, isLoadingLeagues, setMyTeam } = useLeague();
  const [isSavingMyTeam, setIsSavingMyTeam] = useState(false);
  const [saveMyTeamError, setSaveMyTeamError] = useState("");
  const [sortKey, setSortKey] = useState("fill");
  const [sortDir, setSortDir] = useState("desc");
  const [hiddenIds, setHiddenIds] = useState(new Set());

  const activeLeague = useMemo(() => {
    if (leagues.length === 0) return null;
    return leagues.find((league) => league._id === selectedLeagueId) || null;
  }, [leagues, selectedLeagueId]);

  const rosters = Array.isArray(activeLeague?.rosterIds) ? activeLeague.rosterIds : [];

  function toggleTeam(id) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllTeams() {
    if (hiddenIds.size === 0) {
      setHiddenIds(new Set(rosters.map((r) => r._id)));
    } else {
      setHiddenIds(new Set());
    }
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sortedRosters = useMemo(() => {
    const copy = [...rosters];
    copy.sort((a, b) => {
      if (sortKey === "name") {
        const av = (a.name || "").toLowerCase();
        const bv = (b.name || "").toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      let av, bv;
      if (sortKey === "budgetLeft") {
        av = a.budgetLeft ?? activeLeague?.budgetCap ?? 0;
        bv = b.budgetLeft ?? activeLeague?.budgetCap ?? 0;
      } else if (sortKey === "spent") {
        const cap = activeLeague?.budgetCap ?? 0;
        av = cap - (a.budgetLeft ?? cap);
        bv = cap - (b.budgetLeft ?? cap);
      } else if (sortKey === "totalValue") {
        av = rosterTotalValue(a);
        bv = rosterTotalValue(b);
      } else {
        av = rosterFill(a);
        bv = rosterFill(b);
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [rosters, sortKey, sortDir, activeLeague]);

  const visibleRosters = useMemo(
    () => sortedRosters.filter((r) => !hiddenIds.has(r._id)),
    [sortedRosters, hiddenIds]
  );

  async function handleMyTeamChange(event) {
    const nextMyTeamId = event.target.value;
    if (!activeLeague || !nextMyTeamId) return;
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
          <p className="muted">Compare every roster side by side in a draft-board style summary.</p>

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
                  <option value="" disabled>-- Select a team --</option>
                  {rosters.map((roster, index) => (
                    <option key={roster._id || `my-team-option-${index}`} value={roster._id}>
                      {roster.name || `Team ${index + 1}`}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-primary draft-btn"
                  onClick={() => navigate("/player-search")}
                >
                  Draft
                </button>
              </div>
              {saveMyTeamError ? <p className="error">{saveMyTeamError}</p> : null}

              <div className="sort-controls">
                <span className="league-summary-label">Sort by</span>
                {SORT_OPTIONS.map((opt) => {
                  const active = sortKey === opt.key;
                  return (
                    <button
                      key={opt.key}
                      className={`sort-btn${active ? " sort-btn-active" : ""}`}
                      onClick={() => handleSort(opt.key)}
                    >
                      {opt.label}
                      {active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                    </button>
                  );
                })}
              </div>

              <div className="team-filter-row">
                <span className="league-summary-label">Show Teams</span>
                <button
                  className={`sort-btn${hiddenIds.size === 0 ? " sort-btn-active" : ""}`}
                  onClick={toggleAllTeams}
                >
                  All
                </button>
                {rosters.map((roster, index) => {
                  const visible = !hiddenIds.has(roster._id);
                  return (
                    <button
                      key={roster._id || index}
                      className={`sort-btn team-filter-btn${visible ? " sort-btn-active" : ""}`}
                      onClick={() => toggleTeam(roster._id)}
                      title={roster.name || `Team ${index + 1}`}
                    >
                      {roster.name || `Team ${index + 1}`}
                    </button>
                  );
                })}
              </div>

              <div className="roster-board-wrap">
                <div className="roster-board">
                  {visibleRosters.length === 0 ? (
                    <p className="muted" style={{ padding: "1rem" }}>No teams selected. Toggle teams above to show them.</p>
                  ) : null}
                  {visibleRosters.map((roster, index) => {
                    const isMyTeam = Boolean(activeLeague.myTeam) && String(activeLeague.myTeam) === String(roster._id);
                    const fill = rosterFill(roster);
                    const budgetLeft = roster.budgetLeft ?? activeLeague.budgetCap;
                    const spent = activeLeague.budgetCap - budgetLeft;
                    const estValue = rosterTotalValue(roster);
                    return (
                      <article className={`roster-column${isMyTeam ? " roster-column-mine" : ""}`} key={roster._id || `${roster.name}-${index}`}>
                        <div className="roster-column-head">
                          <div className="roster-column-head-top">
                            <h2>{roster.name || `Team ${index + 1}`}</h2>
                            {isMyTeam ? <span className="my-team-badge">My Team</span> : null}
                          </div>
                          <div className="roster-head-stats">
                            <span><span className="stat-label">Left</span> ${budgetLeft}</span>
                            <span><span className="stat-label">Spent</span> ${spent}</span>
                            <span><span className="stat-label">Val</span> ${estValue}</span>
                            <span><span className="stat-label">Fill</span> {fill}/{ROSTER_SLOTS.length}</span>
                          </div>
                        </div>

                        <div className="roster-slot-list">
                          {ROSTER_SLOTS.map((slot) => {
                            const player = roster[slot.key];
                            return (
                              <div className={`roster-slot-card${!player ? " roster-slot-empty" : ""}`} key={slot.key}>
                                <span className="roster-slot-label">{slot.label}</span>
                                {player ? (
                                  <div className="roster-slot-content">
                                    <span className="slot-name" title={player.name}>{player.name}</span>
                                    <span className="slot-meta">
                                      {[player.team, player.positions, player.price != null ? `$${player.price}` : null].filter(Boolean).join(" · ")}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="slot-empty-label">Open</span>
                                )}
                              </div>
                            );
                          })}

                          {Array.isArray(roster.taxiPlayers) && roster.taxiPlayers.length > 0 && (
                            <div className="taxi-squad-divider">
                              <span className="eyebrow">Taxi Squad</span>
                            </div>
                          )}
                          {Array.isArray(roster.taxiPlayers) && roster.taxiPlayers.map((player, i) => (
                            <div className="roster-slot-card" key={`taxi-${player._id || i}`}>
                              <span className="roster-slot-label taxi-label">TAXI</span>
                              <div className="roster-slot-content">
                                <span className="slot-name" title={player.name}>{player.name}</span>
                                <span className="slot-meta">
                                  {[player.team, player.positions].filter(Boolean).join(" · ")}
                                </span>
                              </div>
                            </div>
                          ))}

                          {Array.isArray(roster.minorLeaguePlayers) && roster.minorLeaguePlayers.length > 0 && (
                            <div className="taxi-squad-divider">
                              <span className="eyebrow">Minor League</span>
                            </div>
                          )}
                          {Array.isArray(roster.minorLeaguePlayers) && roster.minorLeaguePlayers.map((player, i) => (
                            <div className="roster-slot-card" key={`minor-league-${player._id || i}`}>
                              <span className="roster-slot-label taxi-label">MIN</span>
                              <div className="roster-slot-content">
                                <span className="slot-name" title={player.name}>{player.name}</span>
                                <span className="slot-meta">
                                  {[player.team, player.positions].filter(Boolean).join(" · ")}
                                </span>
                              </div>
                            </div>
                          ))}
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
