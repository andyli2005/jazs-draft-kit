import { useEffect, useState } from "react";
import Header from "../components/Header";
import DraftPlayerModal from "../components/DraftPlayerModal";
import PlayerStatsPanel from "../components/PlayerStatsPanel";
import Sidebar from "../components/Sidebar";
import { useLeague } from "../leagues";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const TABLE_COLUMNS = [
  { label: "Name", key: "name" },
  { label: "Status", key: "status" },
  { label: "Picture URL", key: "pictureURL" },
  { label: "Positions", key: "positions" },
  { label: "Team", key: "team" },
  { label: "Fantasy Points", key: "fantasyPoints" },
  { label: "Cost", key: "cost" },
  { label: "At Bats", key: "atBats" },
  { label: "Base On Balls", key: "baseOnBalls" },
  { label: "Batting Average", key: "battingAverage" },
  { label: "Caught Stealing", key: "caughtStealing" },
  { label: "Doubles", key: "doubles" },
  { label: "Hits", key: "hits" },
  { label: "Home Runs", key: "homeRuns" },
  { label: "On Base Percentage", key: "onBasePercentage" },
  { label: "Runs", key: "runs" },
  { label: "Runs Batted In", key: "runsBattedIn" },
  { label: "Singles", key: "singles" },
  { label: "Slugging Percentage", key: "sluggingPercentage" },
  { label: "Stolen Bass", key: "stolenBases" },
  { label: "Strike Outs", key: "strikeOuts" },
  { label: "Triples", key: "triples" },
];

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
  if (key === "pictureURL") {
    if (!value) return "N/A";
    return (
      <img
        src={String(value)}
        alt="Player portrait"
        className="player-table-image"
        loading="lazy"
      />
    );
  }

  if ((key === "createdAt" || key === "updatedAt") && isDateLike(value)) {
    return new Date(value).toLocaleString();
  }

  if (key === "cost") {
    if (value == null) return "...";
    return value;
  }

  return renderValue(value);
}

function PlayerSearchPage() {
  const { selectedLeagueId, selectedLeague, refreshLeagues } = useLeague();
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortBy, setSortBy] = useState("fantasyPoints");
  const [sortOrder, setSortOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showDraftModal, setShowDraftModal] = useState(false);

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
        const params = new URLSearchParams();
        params.set("rankBy", sortBy);
        params.set("order", sortOrder);
        if (search) params.set("name", search);
        params.set("leagueId", selectedLeagueId);
        const response = await fetch(`${API_BASE}/api/players?${params.toString()}`, {
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
          throw new Error(data.errorMessage || data.message || "Failed to load players.");
        }

        if (!isMounted) return;
        const nextPlayers = Array.isArray(data.players) ? data.players : [];
        setPlayers(nextPlayers);
        setSelectedPlayer((prev) => {
          if (!prev?.APIplayerId) return prev;
          return nextPlayers.find((player) => player.APIplayerId === prev.APIplayerId) || prev;
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
  }, [sortBy, sortOrder, search, selectedLeagueId]);

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
    const params = new URLSearchParams();
    params.set("rankBy", sortBy);
    params.set("order", sortOrder);
    if (search) params.set("name", search);
    params.set("leagueId", selectedLeagueId);
    const response = await fetch(`${API_BASE}/api/players?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.errorMessage || data.message || "Failed to load players.");
    }
    const nextPlayers = Array.isArray(data.players) ? data.players : [];
    setPlayers(nextPlayers);
    setSelectedPlayer((prev) => {
      if (!prev?.APIplayerId) return prev;
      return nextPlayers.find((player) => player.APIplayerId === prev.APIplayerId) || prev;
    });
  }

  function handleDraftClick() {
    setShowDraftModal(true);
  }

  async function handleDropClick(player) {
    if (!selectedLeagueId || !player?.APIplayerId || !player?.draftOwnerId) return;
    const didConfirm = window.confirm(`Drop ${player.name || "this player"} from their roster?`);
    if (!didConfirm) return;

    try {
      const response = await fetch(`${API_BASE}/api/players/${player.APIplayerId}/drop`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: selectedLeagueId,
          rosterId: player.draftOwnerId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.errorMessage || "Failed to drop player.");
      }
      await refreshLeagues();
      await reloadPlayers();
    } catch (err) {
      setErrorMessage(err.message || "Failed to drop player.");
    }
  }

  return (
    <main className="app-shell page-private">
      <Header />
      <div className={`app-body${selectedPlayer ? " app-body-with-panel" : ""}`}>
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">Player Search</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
            <h1 style={{ margin: 0 }}>Find Players</h1>
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
          <p className="muted">Loaded from Draft Kit backend via upstream players service.</p>

          {isLoading ? <p className="muted">Loading players...</p> : null}
          {!isLoading && errorMessage ? <p className="error">{errorMessage}</p> : null}
          {!isLoading && !errorMessage && !hasPlayers ? (
            <p className="muted">No players found.</p>
          ) : null}

          {!isLoading && !errorMessage && hasPlayers ? (
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
                          className={`${isSelected ? "selected-row" : ""}${player.isDrafted ? " drafted-row" : ""}`}
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

        {selectedPlayer && (
          <PlayerStatsPanel
            player={selectedPlayer}
            fantasyPoints={selectedPlayer?.fantasyPoints ?? 0}
            cost={selectedPlayer?.isDrafted ? (selectedPlayer?.leaguePrice ?? selectedPlayer?.cost ?? 0) : (selectedPlayer?.cost ?? 0)}
            activeLeagueId={selectedLeagueId}
            onDraftClick={handleDraftClick}
            onDropClick={handleDropClick}
            onClose={() => setSelectedPlayer(null)}
          />
        )}
      </div>
      <DraftPlayerModal
        open={showDraftModal}
        player={selectedPlayer}
        league={selectedLeague}
        onClose={() => setShowDraftModal(false)}
        onDrafted={async () => {
          await refreshLeagues();
          await reloadPlayers();
        }}
      />
    </main>
  );
}

export default PlayerSearchPage;
