import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import DraftPlayerModal from "../components/DraftPlayerModal";
import PlayerStatsPanel from "../components/PlayerStatsPanel";
import Sidebar from "../components/Sidebar";
import { useLeague } from "../leagues";
import { getPlayers, dropPlayer, getDepthCharts } from "../leagues/requests";
import { POSITION_OPTIONS } from "../leagues/positions";

const PAGE_SIZE = 50;

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

function isStatusActive(status) {
  return String(status || "").trim().toLowerCase() === "active";
}

function renderCellValue(key, value) {
  if (key === "status") {
    const isActive = isStatusActive(value);
    return (
      <span className={`status-pill ${isActive ? "status-pill-active" : "status-pill-inactive"}`}>
        {renderValue(value)}
      </span>
    );
  }

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

function buildPlayersQuery({ sortBy, sortOrder, search, selectedLeagueId, position, page }) {
  return {
    rankBy: sortBy,
    order: sortOrder,
    name: search,
    leagueId: selectedLeagueId,
    position,
    page,
    limit: PAGE_SIZE,
  };
}

function PlayerSearchPage() {
  const { selectedLeagueId, selectedLeague, refreshLeagues } = useLeague();
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortBy, setSortBy] = useState("fantasyPoints");
  const [sortOrder, setSortOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);
  const [positionFilter, setPositionFilter] = useState("");
  const [depthCharts, setDepthCharts] = useState(null);
  const sentinelRef = useRef(null);

  // Reset to page 1 and clear players whenever filters/sort change
  useEffect(() => {
    setPage(1);
    setPlayers([]);
    setHasMore(false);
  }, [sortBy, sortOrder, search, selectedLeagueId, positionFilter]);

  // Load players whenever page or filters change
  useEffect(() => {
    let isMounted = true;
    const isFirstPage = page === 1;

    async function loadPlayers() {
      if (isFirstPage) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setErrorMessage("");

      if (!selectedLeagueId) {
        setIsLoading(false);
        setIsLoadingMore(false);
        setErrorMessage("Select a league first.");
        return;
      }

      try {
        const data = await getPlayers(buildPlayersQuery({
          sortBy,
          sortOrder,
          search,
          selectedLeagueId,
          position: positionFilter,
          page,
        }));

        if (!isMounted) return;

        const nextPlayers = Array.isArray(data.players) ? data.players : [];
        setPlayers((prev) => isFirstPage ? nextPlayers : [...prev, ...nextPlayers]);

        const returnedPage = data.page || page;
        const returnedLimit = data.limit || PAGE_SIZE;
        const total = data.total || 0;
        setHasMore(returnedPage * returnedLimit < total);

        setSelectedPlayer((prev) => {
          if (!prev?.APIplayerId) return prev;
          const all = isFirstPage ? nextPlayers : [...players, ...nextPlayers];
          return all.find((p) => p.APIplayerId === prev.APIplayerId) || prev;
        });
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err.message || "Unable to load players.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    }

    loadPlayers();
    return () => { isMounted = false; };
  }, [page, sortBy, sortOrder, search, selectedLeagueId, positionFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver: load next page when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading]);

  // Live update handler
  useEffect(() => {
    function handleLiveUpdate(event) {
      const notice = event.detail;
      const playerUpdate = notice?.player || {};
      if (!playerUpdate.APIplayerId) return;

      const mergePlayerUpdate = (player) => {
        if (!player || String(player.APIplayerId) !== String(playerUpdate.APIplayerId)) {
          return player;
        }
        return {
          ...player,
          status: playerUpdate.status || player.status,
          injuryStatus: playerUpdate.injuryStatus || player.injuryStatus,
          latestNews: playerUpdate.latestNews || player.latestNews,
          depthChart:
            notice.type === "depthChart"
              ? { ...(player.depthChart || {}), ...(playerUpdate.depthChart || {}) }
              : player.depthChart,
        };
      };

      setPlayers((prev) => prev.map(mergePlayerUpdate));
      setSelectedPlayer((prev) => mergePlayerUpdate(prev));
      setPanelRefreshKey((prev) => prev + 1);
    }

    window.addEventListener("draft-kit:player-live-update", handleLiveUpdate);
    return () => window.removeEventListener("draft-kit:player-live-update", handleLiveUpdate);
  }, []);

  // Depth charts
  useEffect(() => {
    let isMounted = true;
    async function loadDepthCharts() {
      try {
        const data = await getDepthCharts();
        if (isMounted) setDepthCharts(data.teams ?? null);
      } catch {
        // Depth charts are supplemental — fail silently.
      }
    }
    loadDepthCharts();
    return () => { isMounted = false; };
  }, []);

  const teamDepthChart = useMemo(() => {
    if (!selectedPlayer?.team || !depthCharts) return null;
    const teamData = depthCharts[selectedPlayer.team];
    if (!teamData) return null;

    return Object.entries(teamData)
      .map(([position, posPlayers]) => ({
        position,
        players: posPlayers.map((p) => ({
          name: p.name,
          role: p.depthChart?.role,
          section: p.depthChart?.section,
          isSelected:
            p.playerId === selectedPlayer.APIplayerId ||
            p.name === selectedPlayer.name,
        })),
      }))
      .sort((a, b) => a.position.localeCompare(b.position));
  }, [selectedPlayer, depthCharts]);

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

  const reloadPlayers = useCallback(() => {
    // Reset to page 1 — the filter-change effect picks it up
    setPage(1);
    setPlayers([]);
    setHasMore(false);
    setPanelRefreshKey((prev) => prev + 1);
  }, []);

  function handleDraftClick() {
    setShowDraftModal(true);
  }

  async function handleDropClick(player) {
    if (!selectedLeagueId || !player?.APIplayerId || !player?.draftOwnerId) return;
    const didConfirm = window.confirm(`Drop ${player.name || "this player"} from their roster?`);
    if (!didConfirm) return;

    try {
      await dropPlayer(player.APIplayerId, {
        leagueId: selectedLeagueId,
        rosterId: player.draftOwnerId,
      });
      await refreshLeagues();
      reloadPlayers();
    } catch (err) {
      setErrorMessage(err.message || "Failed to drop player.");
    }
  }

  const hasPlayers = players.length > 0;

  return (
    <main className="app-shell page-private">
      <Header />
      <div className={`app-body${selectedPlayer ? " app-body-with-panel" : ""}`}>
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">Player Search</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
            <h1 style={{ margin: 0 }}>Find Players</h1>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                style={{
                  border: "1px solid #c8d2e9",
                  borderRadius: "10px",
                  padding: "0.65rem 0.75rem",
                  font: "inherit",
                  fontSize: "1rem",
                }}
              >
                <option value="">Filter by Positions</option>
                {POSITION_OPTIONS.map((pos) => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
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
          </div>
          <p className="muted">Loaded from Draft Kit backend via upstream players service.</p>

          {isLoading ? <p className="muted">Loading players...</p> : null}
          {!isLoading && errorMessage ? <p className="error">{errorMessage}</p> : null}
          {!isLoading && !errorMessage && !hasPlayers ? (
            <p className="muted">No players found.</p>
          ) : null}

          {hasPlayers ? (
            <div className="players-table-wrap">
              <div className="players-table-inner">
                <table className="players-table">
                  <thead>
                    <tr>
                      {TABLE_COLUMNS.map((column) => (
                        column.key !== "pictureURL" ? (
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
                        ) : (
                          <th key={column.key} scope="col">{column.label}</th>
                        )
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => {
                      const rowKey = player.APIplayerId || `${player.name || "player"}-${index}`;
                      const isInactive = !isStatusActive(player.status);
                      const isSelected =
                        selectedPlayer &&
                        (selectedPlayer.APIplayerId
                          ? selectedPlayer.APIplayerId === player.APIplayerId
                          : selectedPlayer.name === player.name && index === players.indexOf(selectedPlayer));
                      return (
                        <tr
                          key={rowKey}
                          className={`${isSelected ? " selected-row" : ""}${player.isDrafted ? " drafted-row" : ""}${isInactive ? " inactive-row" : ""}`.trim()}
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

              {/* Sentinel for IntersectionObserver */}
              <div ref={sentinelRef} style={{ height: 1 }} />

              {isLoadingMore ? (
                <p className="muted" style={{ textAlign: "center", padding: "1rem" }}>
                  Loading more players...
                </p>
              ) : null}
              {!isLoadingMore && !hasMore && hasPlayers ? (
                <p className="muted" style={{ textAlign: "center", padding: "0.75rem", fontSize: "0.82rem" }}>
                  All {players.length} players loaded
                </p>
              ) : null}
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
            onMoved={async () => {
              await refreshLeagues();
              reloadPlayers();
            }}
            onContractSaved={async () => {
              await refreshLeagues();
              reloadPlayers();
            }}
            refreshKey={panelRefreshKey}
            onClose={() => setSelectedPlayer(null)}
            teamDepthChart={teamDepthChart}
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
          reloadPlayers();
        }}
      />
    </main>
  );
}

export default PlayerSearchPage;
