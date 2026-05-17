import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { useLeague } from "../leagues";
import { draftTaxiPlayer, getPlayers } from "../leagues/requests";
import { SLOT_DEFS } from "../leagues/rosterSlots";

// Taxi-draft most, if not all, stats don't matter 
const TABLE_COLUMNS = [
  { label: "Name", key: "name" },
  { label: "Status", key: "status" },
  { label: "Positions", key: "positions" },
  { label: "Team", key: "team" },
  { label: "Fantasy Points", key: "fantasyPoints" },
];

const TAXI_SQUAD_SIZE = 9;

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

  if (key === "cost") {
    if (value == null) return "...";
    return value;
  }

  if (key === "fantasyPoints" && (value == null || value === "")) {
    return "0";
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
  };
}

function getTaxiPlayers(players) {
  return players.filter((player) => !player.isDrafted && !player.isTaxiDrafted);
}

function areRostersFull(rosters) {
  return rosters.length > 0 &&
    rosters.every((roster) => SLOT_DEFS.every(({ key }) => roster?.[key] != null));
}

function TaxiDraftPage() {
  const { selectedLeagueId, selectedLeague, refreshLeagues } = useLeague();
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [sortBy, setSortBy] = useState("fantasyPoints");
  const [sortOrder, setSortOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedTaxiRosterId, setSelectedTaxiRosterId] = useState("");
  const [isSubmittingTaxiDraft, setIsSubmittingTaxiDraft] = useState(false);

  const taxiRosterOptions = useMemo(() => {
      const rosters = Array.isArray(selectedLeague?.rosterIds) ? selectedLeague.rosterIds : [];
      return rosters
        .filter((roster) => (roster.taxiPlayers?.length || 0) < TAXI_SQUAD_SIZE)
        .map((roster) => ({
          ...roster,
          display: `${roster.name || "Unknown Team"} (${roster.taxiPlayers?.length || 0}/${TAXI_SQUAD_SIZE})`}));
    }, [selectedLeague?.rosterIds]);

  const testTaxi = import.meta.env.VITE_TEST_TAXI === "true";
  const allRostersFull = testTaxi || areRostersFull(Array.isArray(selectedLeague?.rosterIds) ? selectedLeague.rosterIds : []);

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

      if (!allRostersFull) {
        setPlayers([]);
        setSelectedPlayer(null);
        setIsLoading(false);
        return;
      }

      try {
        const data = await getPlayers(buildPlayersQuery({ sortBy, sortOrder, search, selectedLeagueId }));

        if (!isMounted) return;
        const nextPlayers = Array.isArray(data.players) ? data.players : [];
        const taxiPlayers = getTaxiPlayers(nextPlayers);
        setPlayers(taxiPlayers);
        setSelectedPlayer((prev) => {
          if (!prev?.APIplayerId) return prev;
          return taxiPlayers.find((player) => player.APIplayerId === prev.APIplayerId) || null;
        });
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err.message || "Unable to load players.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPlayers();
    return () => {
      isMounted = false;
    };
  }, [sortBy, sortOrder, search, selectedLeagueId, allRostersFull]);

  useEffect(() => {
    if (!selectedTaxiRosterId) return;
    const rosterStillExists = taxiRosterOptions.some(
      (roster) => String(roster._id) === String(selectedTaxiRosterId)
    );
    if (!rosterStillExists) {
      setSelectedTaxiRosterId("");
    }
  }, [selectedTaxiRosterId, taxiRosterOptions]);

  const hasPlayers = players.length > 0;

  function handleSort(columnKey) {
    if (columnKey === "cost") {
      const order = sortBy === "cost" && sortOrder === "asc" ? "desc" : "asc";
      setSortBy(columnKey);
      setSortOrder(order);
      return;
    }
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
    if (!allRostersFull) {
      setPlayers([]);
      setSelectedPlayer(null);
      return;
    }

    const data = await getPlayers(buildPlayersQuery({ sortBy, sortOrder, search, selectedLeagueId }));
    const nextPlayers = Array.isArray(data.players) ? data.players : [];
    const taxiPlayers = getTaxiPlayers(nextPlayers);
    setPlayers(taxiPlayers);
    setSelectedPlayer((prev) => {
      if (!prev?.APIplayerId) return prev;
      return taxiPlayers.find((player) => player.APIplayerId === prev.APIplayerId) || null;
    });
  }

  async function handleTaxiDraftClick() {
    if (!allRostersFull || !selectedLeagueId || !selectedPlayer?.APIplayerId || !selectedTaxiRosterId) return;

    try {
      setIsSubmittingTaxiDraft(true);
      setErrorMessage("");
      setActionMessage("");

      const inactiveOverrideAccepted = isStatusActive(selectedPlayer.status)
        ? false
        : window.confirm(
            `${selectedPlayer.name || "This player"} is listed as ${selectedPlayer.status || "inactive"}. Add them to a taxi roster anyway?`
          );

      if (!isStatusActive(selectedPlayer.status) && !inactiveOverrideAccepted) {
        setIsSubmittingTaxiDraft(false);
        return;
      }

      await draftTaxiPlayer(selectedPlayer.APIplayerId, {
        leagueId: selectedLeagueId,
        rosterId: selectedTaxiRosterId,
        inactiveOverrideAccepted,
      });

      const rosterName =
        taxiRosterOptions.find((roster) => String(roster._id) === String(selectedTaxiRosterId))?.name ||
        "selected taxi roster";
      setActionMessage(`${selectedPlayer.name || "Player"} was added to ${rosterName}.`);
      setSelectedPlayer(null);
      await refreshLeagues();
      await reloadPlayers();
    } catch (err) {
      setErrorMessage(err.message || "Failed to add player to taxi roster.");
    } finally {
      setIsSubmittingTaxiDraft(false);
    }
  }

  return (
    <main className="app-shell page-private">
      <Header />
      <div className={`app-body${selectedPlayer ? " app-body-with-panel" : ""}`}>
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">Taxi Draft</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
            <h1 style={{ margin: 0 }}>Remaining Players</h1>
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
          <p className="muted">Pick 9 players to be in Taxi Roster.</p>

          {!allRostersFull ? (
            <p className="muted">
              Taxi Draft unlocks after every roster slot is filled for every team.
            </p>
          ) : null}

          {allRostersFull && isLoading ? <p className="muted">Loading players...</p> : null}
          {!isLoading && errorMessage ? <p className="error">{errorMessage}</p> : null}
          {allRostersFull && !isLoading && actionMessage ? <p className="success">{actionMessage}</p> : null}
          {allRostersFull && !isLoading && !errorMessage && !hasPlayers ? (
            <p className="muted">No taxi-eligible players found.</p>
          ) : null}

          {allRostersFull && !isLoading && !errorMessage && hasPlayers ? (
            <div className="players-table-wrap">
              <div className="players-table-inner">
                <table className="players-table">
                  <thead>
                    <tr>
                      {TABLE_COLUMNS.map((column) => (
                        column.key !== "pictureURL" ?
                          <th key={column.key} scope="col">
                            <button
                              className="table-sort-button"
                              type="button"
                              onClick={() => handleSort(column.key)}
                            >
                              {column.label}
                              {sortIndicator(column.key)}
                            </button>
                          </th> :
                          <th key={column.key} scope="col">
                            {column.label}
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
                          className={`${isSelected ? " selected-row" : ""}${player.isDrafted || player.isTaxiDrafted ? " drafted-row" : ""}`.trim()}
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
        </section>

        {allRostersFull && selectedPlayer && (
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
                <dt className="muted">Fantasy Points</dt>
                <dd style={{ margin: 0 }}>{renderValue(selectedPlayer.fantasyPoints)}</dd>
              </div>
              <div>
                <dt className="muted">Taxi Cost</dt>
                <dd style={{ margin: 0 }}>$1</dd>
              </div>
            </dl>

            <label style={{ display: "grid", gap: "0.4rem", marginBottom: "1rem" }}>
              <span>Taxi Roster</span>
              <select
                value={selectedTaxiRosterId}
                onChange={(event) => setSelectedTaxiRosterId(event.target.value)}
                style={{
                  border: "1px solid #c8d2e9",
                  borderRadius: "10px",
                  padding: "0.65rem 0.75rem",
                  font: "inherit",
                }}
              >
                <option value="">Select team...</option>
                {taxiRosterOptions.map((roster, index) => (
                  <option key={roster._id || `taxi-roster-${index}`} value={roster._id}>
                    {roster.display}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleTaxiDraftClick}
              disabled={!allRostersFull || !selectedTaxiRosterId || isSubmittingTaxiDraft}
              style={{ width: "100%" }}
            >
              {isSubmittingTaxiDraft ? "Adding..." : "Add to Taxi"}
            </button>
          </aside>
        )}
      </div>
    </main>
  );
}

export default TaxiDraftPage;
