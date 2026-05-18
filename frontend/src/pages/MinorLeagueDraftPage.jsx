import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { useLeague } from "../leagues";
import { draftMinorLeaguePlayer, getPlayers, moveMinorLeaguePlayer } from "../leagues/requests";

const TABLE_COLUMNS = [
  { label: "Name", key: "name" },
  { label: "Status", key: "status" },
  { label: "Positions", key: "positions" },
  { label: "Team", key: "team" },
  { label: "Fantasy Points", key: "fantasyPoints" },
];

const MINOR_LEAGUE_SIZE = 9;

function renderValue(value) {
  if (value == null || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isDateLike(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

function renderCellValue(key, value) {
  if ((key === "createdAt" || key === "updatedAt") && isDateLike(value)) {
    return new Date(value).toLocaleString();
  }

  if (key === "fantasyPoints" && (value == null || value === "")) {
    return "0";
  }

  return renderValue(value);
}

function isStatusActive(status) {
  return String(status || "").trim().toLowerCase() === "active";
}

function buildPlayersQuery({ sortBy, sortOrder, search, selectedLeagueId }) {
  return {
    rankBy: sortBy,
    order: sortOrder,
    name: search,
    leagueId: selectedLeagueId,
    playerLevel: "minor",
  };
}

function getMinorLeagueEligiblePlayers(players) {
  return players.filter((player) => !player.isDrafted && !player.isTaxiDrafted && !player.isMinorLeagueDrafted);
}

function MinorLeagueDraftPage() {
  const { selectedLeagueId, selectedLeague, refreshLeagues } = useLeague();
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [sortBy, setSortBy] = useState("fantasyPoints");
  const [sortOrder, setSortOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedMinorLeagueRosterId, setSelectedMinorLeagueRosterId] = useState("");
  const [isSubmittingMinorLeagueDraft, setIsSubmittingMinorLeagueDraft] = useState(false);
  const [moveDestinations, setMoveDestinations] = useState({});
  const [movingPlayerId, setMovingPlayerId] = useState("");

  const rosters = useMemo(
    () => (Array.isArray(selectedLeague?.rosterIds) ? selectedLeague.rosterIds : []),
    [selectedLeague?.rosterIds]
  );
  const minorLeagueRosterOptions = useMemo(() => {
    return rosters
      .filter((roster) => (roster.minorLeaguePlayers?.length || 0) < MINOR_LEAGUE_SIZE)
      .map((roster) => ({
        ...roster,
        display: `${roster.name || "Unknown Team"} (${roster.minorLeaguePlayers?.length || 0}/${MINOR_LEAGUE_SIZE})`,
      }));
  }, [rosters]);

  const currentMinorLeaguePlayers = useMemo(
    () => rosters.flatMap((roster) =>
      (roster.minorLeaguePlayers || []).map((player) => ({
        ...player,
        currentRosterId: roster._id,
        currentRosterName: roster.name || "Unknown Team",
      }))
    ),
    [rosters]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadPlayers() {
      setIsLoading(true);
      setErrorMessage("");

      if (!selectedLeagueId) {
        setIsLoading(false);
        setErrorMessage("Select a league first.");
        return;
      }

      try {
        const data = await getPlayers(buildPlayersQuery({ sortBy, sortOrder, search, selectedLeagueId }));

        if (!isMounted) return;
        const nextPlayers = Array.isArray(data.players) ? data.players : [];
        const minorLeaguePlayers = getMinorLeagueEligiblePlayers(nextPlayers);
        setPlayers(minorLeaguePlayers);
        setSelectedPlayer((prev) => {
          if (!prev?.APIplayerId) return prev;
          return minorLeaguePlayers.find((player) => player.APIplayerId === prev.APIplayerId) || null;
        });
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err.message || "Unable to load minor league players.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPlayers();
    return () => {
      isMounted = false;
    };
  }, [sortBy, sortOrder, search, selectedLeagueId]);

  useEffect(() => {
    if (!selectedMinorLeagueRosterId) return;
    const rosterStillExists = minorLeagueRosterOptions.some(
      (roster) => String(roster._id) === String(selectedMinorLeagueRosterId)
    );
    if (!rosterStillExists) {
      setSelectedMinorLeagueRosterId("");
    }
  }, [selectedMinorLeagueRosterId, minorLeagueRosterOptions]);

  const hasPlayers = players.length > 0;

  function handleSort(columnKey) {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(columnKey);
    setSortOrder("asc");
  }

  function sortIndicator(columnKey) {
    if (sortBy !== columnKey) return "";
    return sortOrder === "asc" ? " ▲" : " ▼";
  }

  async function reloadPlayers() {
    const data = await getPlayers(buildPlayersQuery({ sortBy, sortOrder, search, selectedLeagueId }));
    const nextPlayers = Array.isArray(data.players) ? data.players : [];
    const minorLeaguePlayers = getMinorLeagueEligiblePlayers(nextPlayers);
    setPlayers(minorLeaguePlayers);
    setSelectedPlayer((prev) => {
      if (!prev?.APIplayerId) return prev;
      return minorLeaguePlayers.find((player) => player.APIplayerId === prev.APIplayerId) || null;
    });
  }

  async function handleMinorLeagueDraftClick() {
    if (!selectedLeagueId || !selectedPlayer?.APIplayerId || !selectedMinorLeagueRosterId) return;

    try {
      setIsSubmittingMinorLeagueDraft(true);
      setErrorMessage("");
      setActionMessage("");

      const inactiveOverrideAccepted = isStatusActive(selectedPlayer.status)
        ? false
        : window.confirm(
            `${selectedPlayer.name || "This player"} is listed as ${selectedPlayer.status || "inactive"}. Add them to a minor league roster anyway?`
          );

      if (!isStatusActive(selectedPlayer.status) && !inactiveOverrideAccepted) {
        setIsSubmittingMinorLeagueDraft(false);
        return;
      }

      await draftMinorLeaguePlayer(selectedPlayer.APIplayerId, {
        leagueId: selectedLeagueId,
        rosterId: selectedMinorLeagueRosterId,
        inactiveOverrideAccepted,
      });

      const rosterName =
        minorLeagueRosterOptions.find((roster) => String(roster._id) === String(selectedMinorLeagueRosterId))?.name ||
        "selected minor league roster";
      setActionMessage(`${selectedPlayer.name || "Player"} was added to ${rosterName}.`);
      setSelectedPlayer(null);
      await refreshLeagues();
      await reloadPlayers();
    } catch (err) {
      setErrorMessage(err.message || "Failed to add player to minor league roster.");
    } finally {
      setIsSubmittingMinorLeagueDraft(false);
    }
  }

  async function handleMoveMinorLeaguePlayer(player) {
    const playerKey = player._id || player.APIplayerId;
    const destinationRosterId = moveDestinations[playerKey];
    if (!selectedLeagueId || !playerKey || !player?.currentRosterId || !destinationRosterId) return;

    try {
      setMovingPlayerId(String(player._id));
      setErrorMessage("");
      setActionMessage("");

      await moveMinorLeaguePlayer(player.APIplayerId || player._id, {
        leagueId: selectedLeagueId,
        fromRosterId: player.currentRosterId,
        toRosterId: destinationRosterId,
      });

      const rosterName =
        rosters.find((roster) => String(roster._id) === String(destinationRosterId))?.name ||
        "selected team";
      setActionMessage(`${player.name || "Player"} was moved to ${rosterName}.`);
      setMoveDestinations((prev) => ({ ...prev, [playerKey]: "" }));
      await refreshLeagues();
      await reloadPlayers();
    } catch (err) {
      setErrorMessage(err.message || "Failed to move minor league player.");
    } finally {
      setMovingPlayerId("");
    }
  }

  return (
    <main className="app-shell page-private">
      <Header />
      <div className={`app-body${selectedPlayer ? " app-body-with-panel" : ""}`}>
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">Minor League Draft</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
            <h1 style={{ margin: 0 }}>Minor League Players</h1>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for player..."
              style={{
                border: "1px solid #c8d2e9",
                borderRadius: "10px",
                padding: "0.65rem 0.75rem",
                font: "inherit",
                fontSize: "1rem",
                width: "280px",
              }}
            />
          </div>
          <p className="muted">Pick up to 9 minor league players for each team.</p>

          {isLoading ? <p className="muted">Loading minor league players...</p> : null}
          {!isLoading && errorMessage ? <p className="error">{errorMessage}</p> : null}
          {!isLoading && actionMessage ? <p className="success">{actionMessage}</p> : null}
          {!isLoading && !errorMessage && !hasPlayers ? (
            <p className="muted">No minor league players found.</p>
          ) : null}

          {!isLoading && !errorMessage && hasPlayers ? (
            <div className="players-table-wrap minor-league-table-wrap">
              <div className="players-table-inner">
                <table className="players-table">
                  <thead>
                    <tr>
                      {TABLE_COLUMNS.map((column) => (
                        <th key={column.key} scope="col">
                          <button
                            className="table-sort-button"
                            type="button"
                            onClick={() => handleSort(column.key)}
                          >
                            {column.label}
                            {sortIndicator(column.key)}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => {
                      const rowKey = player.APIplayerId || `${player.name || "player"}-${index}`;
                      const isSelected =
                        selectedPlayer &&
                        (selectedPlayer.APIplayerId
                          ? selectedPlayer.APIplayerId === player.APIplayerId
                          : selectedPlayer.name === player.name && index === players.indexOf(selectedPlayer));
                      return (
                        <tr
                          key={rowKey}
                          className={`${isSelected ? " selected-row" : ""}${player.isDrafted || player.isTaxiDrafted || player.isMinorLeagueDrafted ? " drafted-row" : ""}`.trim()}
                          onClick={() => setSelectedPlayer(player)}
                        >
                          {TABLE_COLUMNS.map((column) => (
                            <td key={`${rowKey}-${column.key}`}>
                              {renderCellValue(column.key, player[column.key])}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {currentMinorLeaguePlayers.length > 0 ? (
            <div className="minor-league-current-rosters">
              <h2 style={{ fontSize: "1.2rem", marginBottom: "0.75rem" }}>Current Minor League Rosters</h2>
              <div className="minor-league-move-list">
                {currentMinorLeaguePlayers.map((player, index) => {
                  const playerKey = player._id || `minor-current-${index}`;
                  const destinationValue = moveDestinations[playerKey] || "";
                  const destinationOptions = rosters.filter(
                    (roster) =>
                      String(roster._id) !== String(player.currentRosterId) &&
                      (roster.minorLeaguePlayers?.length || 0) < MINOR_LEAGUE_SIZE
                  );
                  return (
                    <div className="minor-league-move-row" key={playerKey}>
                      <div className="minor-league-move-player">
                        <span className="minor-league-move-name">{renderValue(player.name)}</span>
                        <span className="muted">{renderValue(player.currentRosterName)}</span>
                      </div>
                      <div className="minor-league-move-controls">
                        <select
                          className="minor-league-move-select"
                          value={destinationValue}
                          onChange={(event) => setMoveDestinations((prev) => ({ ...prev, [playerKey]: event.target.value }))}
                        >
                          <option value="">Select team...</option>
                          {destinationOptions.map((roster) => (
                            <option key={roster._id} value={roster._id}>
                              {roster.name || "Unknown Team"} ({roster.minorLeaguePlayers?.length || 0}/{MINOR_LEAGUE_SIZE})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-primary minor-league-confirm-btn"
                          onClick={() => handleMoveMinorLeaguePlayer(player)}
                          disabled={!destinationValue || movingPlayerId === String(playerKey)}
                        >
                          {movingPlayerId === String(playerKey) ? "Moving..." : "Confirm Move"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        {selectedPlayer && (
          <aside
            className="card"
            style={{
              width: "320px",
              alignSelf: "flex-start",
              position: "sticky",
              top: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start" }}>
              <div>
                <p className="eyebrow">Selected Player</p>
                <h2 style={{ marginTop: 0 }}>{selectedPlayer.name || "Unnamed Player"}</h2>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedPlayer(null)}>
                Close
              </button>
            </div>

            <dl style={{ display: "grid", gap: "0.5rem", margin: "0 0 1rem" }}>
              <div>
                <dt className="muted">Status</dt>
                <dd style={{ margin: 0 }}>{renderValue(selectedPlayer.status)}</dd>
              </div>
              <div>
                <dt className="muted">Positions</dt>
                <dd style={{ margin: 0 }}>{renderValue(selectedPlayer.positions)}</dd>
              </div>
              <div>
                <dt className="muted">MLB Team</dt>
                <dd style={{ margin: 0 }}>{renderValue(selectedPlayer.team)}</dd>
              </div>
              <div>
                <dt className="muted">Minor League Cost</dt>
                <dd style={{ margin: 0 }}>$0</dd>
              </div>
            </dl>

            <label style={{ display: "grid", gap: "0.4rem", marginBottom: "1rem" }}>
              <span>Minor League Roster</span>
              <select
                value={selectedMinorLeagueRosterId}
                onChange={(event) => setSelectedMinorLeagueRosterId(event.target.value)}
                style={{
                  border: "1px solid #c8d2e9",
                  borderRadius: "10px",
                  padding: "0.65rem 0.75rem",
                  font: "inherit",
                }}
              >
                <option value="">Select team...</option>
                {minorLeagueRosterOptions.map((roster, index) => (
                  <option key={roster._id || `minor-league-roster-${index}`} value={roster._id}>
                    {roster.display}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleMinorLeagueDraftClick}
              disabled={!selectedMinorLeagueRosterId || isSubmittingMinorLeagueDraft}
              style={{ width: "100%" }}
            >
              {isSubmittingMinorLeagueDraft ? "Adding..." : "Add to Minor League"}
            </button>
          </aside>
        )}
      </div>
    </main>
  );
}

export default MinorLeagueDraftPage;
