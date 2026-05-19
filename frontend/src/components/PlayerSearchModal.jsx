import { useEffect, useMemo, useRef, useState } from "react";
import DraftPlayerModal from "./DraftPlayerModal";
import PlayerStatsPanel from "./PlayerStatsPanel";
import { useLeague } from "../leagues";
import {
  dropCustomPlayer,
  dropPlayer,
  getCustomPlayers,
  getPlayers,
} from "../leagues/requests";
import {
  SLOT_DEFS,
  getEligiblePosTokensForSlot,
  parseEligiblePositions,
} from "../leagues/rosterSlots";

const PAGE_SIZE = 50;

const LICENSED_COLUMNS = [
  { label: "Name", key: "name" },
  { label: "Positions", key: "positions" },
  { label: "Team", key: "team" },
  { label: "Status", key: "status" },
  { label: "Fantasy Pts", key: "fantasyPoints" },
  { label: "Cost", key: "cost" },
];

const CUSTOM_COLUMNS = [
  { label: "Name", key: "name" },
  { label: "Positions", key: "positions" },
  { label: "Team", key: "team" },
  { label: "Status", key: "status" },
  { label: "Fantasy Pts", key: "fantasyPoints" },
  { label: "Draft Price", key: "price" },
];

function renderCellValue(key, value) {
  if (key === "cost") return value == null ? "..." : value;
  if (value == null || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isStatusActive(status) {
  return String(status || "").trim().toLowerCase() === "active";
}

function flattenCustomPlayer(doc) {
  const currentStats = doc?.currentStats || {};
  const projectedStats = doc?.projectedStats || {};
  return {
    ...doc,
    ...currentStats,
    fantasyPoints: currentStats.fantasyPoints ?? projectedStats.fantasyPoints ?? 0,
    isDrafted: Boolean(doc?.ownerId),
    draftOwnerId: doc?.ownerId ? String(doc.ownerId) : null,
    leaguePrice: doc?.price ?? 0,
  };
}

function PlayerTable({ columns, players, selectedPlayer, onSelectPlayer, sortBy, sortOrder, onSort }) {
  function sortIndicator(key) {
    if (sortBy !== key) return "";
    return sortOrder === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="players-table-wrap">
      <div className="players-table-inner">
        <table className="players-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} scope="col">
                  <button
                    className="table-sort-button"
                    type="button"
                    onClick={() => onSort(col.key)}
                  >
                    {col.label}
                    {sortIndicator(col.key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => {
              const rowKey =
                player.APIplayerId ||
                player._id ||
                `${player.name || "player"}-${index}`;
              const isInactive = !isStatusActive(player.status);
              const isSelected =
                selectedPlayer &&
                (player.APIplayerId
                  ? player.APIplayerId === selectedPlayer.APIplayerId
                  : player._id && String(player._id) === String(selectedPlayer._id));
              return (
                <tr
                  key={rowKey}
                  className={[
                    isSelected ? "selected-row" : "",
                    player.isDrafted ? "drafted-row" : "",
                    isInactive ? "inactive-row" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onSelectPlayer(player)}
                >
                  {columns.map((col) => (
                    <td key={`${rowKey}-${col.key}`}>
                      {renderCellValue(col.key, player[col.key])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerSearchModal({ open, onClose, slotKey, rosterId, onDrafted }) {
  const { selectedLeagueId, selectedLeague, refreshLeagues } = useLeague();
  const overlayRef = useRef(null);
  const sentinelRef = useRef(null);

  const [activeTab, setActiveTab] = useState("licensed");

  // Licensed player state — search/sort are sent server-side
  const [licensedSearch, setLicensedSearch] = useState("");
  const [licensedSortBy, setLicensedSortBy] = useState("fantasyPoints");
  const [licensedSortOrder, setLicensedSortOrder] = useState("desc");
  const [licensedPlayers, setLicensedPlayers] = useState([]);
  const [licensedLoading, setLicensedLoading] = useState(false);
  const [licensedLoadingMore, setLicensedLoadingMore] = useState(false);
  const [licensedHasMore, setLicensedHasMore] = useState(false);
  const [licensedPage, setLicensedPage] = useState(1);
  const [licensedError, setLicensedError] = useState("");

  // Custom player state — all loaded once, search/sort are client-side
  const [customSearch, setCustomSearch] = useState("");
  const [customSortBy, setCustomSortBy] = useState("fantasyPoints");
  const [customSortOrder, setCustomSortOrder] = useState("desc");
  const [customPlayers, setCustomPlayers] = useState([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState("");

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);
  const [positionOverride, setPositionOverride] = useState(false);

  const slotDef = SLOT_DEFS.find((s) => s.key === slotKey);
  const eligiblePosTokens = useMemo(
    () => (slotKey ? getEligiblePosTokensForSlot(slotKey) : null),
    [slotKey]
  );

  // Reset licensed pagination whenever any filter/sort/league changes so the
  // fetch effect always starts fresh from page 1.
  useEffect(() => {
    setLicensedPage(1);
    setLicensedPlayers([]);
    setLicensedHasMore(false);
  }, [open, selectedLeagueId, licensedSearch, licensedSortBy, licensedSortOrder, positionOverride]);

  // Licensed players: re-fetch whenever page or filters change.
  // Page 1 replaces the list; subsequent pages append.
  useEffect(() => {
    if (!open || !selectedLeagueId) return;
    let isMounted = true;
    const isFirstPage = licensedPage === 1;
    if (isFirstPage) {
      setLicensedLoading(true);
    } else {
      setLicensedLoadingMore(true);
    }
    setLicensedError("");
    getPlayers({
      leagueId: selectedLeagueId,
      name: licensedSearch,
      rankBy: licensedSortBy,
      order: licensedSortOrder,
      page: licensedPage,
      limit: PAGE_SIZE,
    })
      .then((data) => {
        if (!isMounted) return;
        const fetched = Array.isArray(data.players) ? data.players : [];
        setLicensedPlayers((prev) => (isFirstPage ? fetched : [...prev, ...fetched]));
        const returnedPage = data.page || licensedPage;
        const returnedLimit = data.limit || PAGE_SIZE;
        const total = data.total || 0;
        setLicensedHasMore(returnedPage * returnedLimit < total);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLicensedError(err.message || "Failed to load players.");
      })
      .finally(() => {
        if (!isMounted) return;
        if (isFirstPage) {
          setLicensedLoading(false);
        } else {
          setLicensedLoadingMore(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [open, selectedLeagueId, licensedSearch, licensedSortBy, licensedSortOrder, licensedPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !selectedLeagueId) return;
    let isMounted = true;
    setCustomLoading(true);
    setCustomError("");
    getCustomPlayers(selectedLeagueId)
      .then((data) => {
        if (!isMounted) return;
        const docs = Array.isArray(data.players) ? data.players : [];
        setCustomPlayers(docs.map(flattenCustomPlayer));
      })
      .catch((err) => {
        if (!isMounted) return;
        setCustomError(err.message || "Failed to load custom players.");
      })
      .finally(() => {
        if (isMounted) setCustomLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [open, selectedLeagueId]);

  useEffect(() => {
    if (!open) return;
    setSelectedPlayer(null);
    setShowDraftModal(false);
    setActiveTab("licensed");
    setPositionOverride(false);
    setLicensedSearch("");
    setLicensedSortBy("fantasyPoints");
    setLicensedSortOrder("desc");
    setCustomSearch("");
    setCustomSortBy("fantasyPoints");
    setCustomSortOrder("desc");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape" && !showDraftModal) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, showDraftModal]);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  function filterBySlot(players) {
    if (positionOverride || !eligiblePosTokens || eligiblePosTokens.size === 0) return players;
    return players.filter((player) => {
      const tokens = parseEligiblePositions(player.positions);
      return tokens.some((t) => eligiblePosTokens.has(t));
    });
  }

  function filterCustomBySearch(players) {
    const normalized = customSearch.trim().toLowerCase();
    if (!normalized) return players;
    return players.filter((player) =>
      [player.name, player.team, player.positions, player.status].some((v) =>
        String(v || "").toLowerCase().includes(normalized)
      )
    );
  }

  function sortCustomPlayers(players) {
    return [...players].sort((a, b) => {
      const aValue = a[customSortBy];
      const bValue = b[customSortBy];
      const aN = Number(aValue);
      const bN = Number(bValue);
      if (Number.isFinite(aN) && Number.isFinite(bN)) {
        return customSortOrder === "asc" ? aN - bN : bN - aN;
      }
      const cmp = String(aValue || "").localeCompare(String(bValue || ""), undefined, {
        sensitivity: "base",
      });
      return customSortOrder === "asc" ? cmp : -cmp;
    });
  }

  function handleLicensedSort(key) {
    if (licensedSortBy === key) {
      setLicensedSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setLicensedSortBy(key);
      setLicensedSortOrder("asc");
    }
  }

  function handleCustomSort(key) {
    if (customSortBy === key) {
      setCustomSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setCustomSortBy(key);
      setCustomSortOrder("asc");
    }
  }

  // Licensed: slot filter only (search + sort are server-side)
  const displayedLicensed = useMemo(
    () => filterBySlot(licensedPlayers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [licensedPlayers, eligiblePosTokens, positionOverride]
  );

  // Custom: slot filter + client-side search + client-side sort
  const displayedCustom = useMemo(
    () => sortCustomPlayers(filterCustomBySearch(filterBySlot(customPlayers))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customPlayers, customSearch, eligiblePosTokens, customSortBy, customSortOrder, positionOverride]
  );

  async function reloadAll() {
    if (!selectedLeagueId) return;
    const [licensedData, customData] = await Promise.all([
      getPlayers({
        leagueId: selectedLeagueId,
        name: licensedSearch,
        rankBy: licensedSortBy,
        order: licensedSortOrder,
      }),
      getCustomPlayers(selectedLeagueId),
    ]);
    setLicensedPlayers(Array.isArray(licensedData.players) ? licensedData.players : []);
    const docs = Array.isArray(customData.players) ? customData.players : [];
    setCustomPlayers(docs.map(flattenCustomPlayer));
    setPanelRefreshKey((prev) => prev + 1);
  }

  async function handleDropClick(player) {
    if (!selectedLeagueId) return;
    const isCustom = Boolean(player?._id && !player?.APIplayerId);
    if (!window.confirm(`Drop ${player.name || "this player"} from their roster?`)) return;
    try {
      if (isCustom) {
        await dropCustomPlayer(player._id, {
          leagueId: selectedLeagueId,
          rosterId: player.draftOwnerId,
        });
      } else {
        await dropPlayer(player.APIplayerId, {
          leagueId: selectedLeagueId,
          rosterId: player.draftOwnerId,
        });
      }
      await refreshLeagues();
      await reloadAll();
    } catch (err) {
      console.error("Drop failed:", err);
    }
  }

  if (!open) return null;

  const isLicensedTab = activeTab === "licensed";
  const isLoading = isLicensedTab ? licensedLoading : customLoading;
  const listError = isLicensedTab ? licensedError : customError;
  const players = isLicensedTab ? displayedLicensed : displayedCustom;
  const columns = isLicensedTab ? LICENSED_COLUMNS : CUSTOM_COLUMNS;
  const hasPlayers = players.length > 0;
  const isCustomPlayer = Boolean(selectedPlayer?._id && !selectedPlayer?.APIplayerId);
  const activeSearch = isLicensedTab ? licensedSearch : customSearch;
  const setActiveSearch = isLicensedTab ? setLicensedSearch : setCustomSearch;
  const handleSort = isLicensedTab ? handleLicensedSort : handleCustomSort;
  const activeSortBy = isLicensedTab ? licensedSortBy : customSortBy;
  const activeSortOrder = isLicensedTab ? licensedSortOrder : customSortOrder;

  return (
    <>
      <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
        <div className="modal-panel card player-search-modal-panel">
          <div className="modal-header">
            <h2>Add Player{slotDef ? ` — ${slotDef.label}` : ""}</h2>
            <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>

          <div className="player-search-modal-tabs">
            <button
              className={`tab-btn${isLicensedTab ? " tab-btn-active" : ""}`}
              type="button"
              onClick={() => {
                setActiveTab("licensed");
                setSelectedPlayer(null);
              }}
            >
              Licensed Players
            </button>
            <button
              className={`tab-btn${!isLicensedTab ? " tab-btn-active" : ""}`}
              type="button"
              onClick={() => {
                setActiveTab("custom");
                setSelectedPlayer(null);
              }}
            >
              Custom Players
            </button>

            {slotDef ? (
              <div className="player-search-override-wrap">
                <span className="player-search-override-label">Position filter</span>
                <button
                  className={`player-search-override-btn${positionOverride ? " override-on" : " override-off"}`}
                  type="button"
                  onClick={() => setPositionOverride((prev) => !prev)}
                  aria-pressed={positionOverride}
                >
                  <span className="override-track">
                    <span className="override-thumb" />
                  </span>
                  <span className="override-state-label">
                    {positionOverride ? "All players" : `${slotDef.label} eligible only`}
                  </span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="player-search-modal-body">
            <div className="player-search-modal-list">
              <div className="player-search-modal-search">
                <input
                  type="text"
                  value={activeSearch}
                  onChange={(e) => setActiveSearch(e.target.value)}
                  placeholder="Search players..."
                  className="modal-search-input"
                />
              </div>

              {isLoading ? <p className="muted">Loading...</p> : null}
              {!isLoading && listError ? <p className="error">{listError}</p> : null}
              {!isLoading && !listError && !hasPlayers ? (
                <p className="muted">No eligible players found.</p>
              ) : null}
              {!isLoading && !listError && hasPlayers ? (
                <PlayerTable
                  columns={columns}
                  players={players}
                  selectedPlayer={selectedPlayer}
                  onSelectPlayer={setSelectedPlayer}
                  sortBy={activeSortBy}
                  sortOrder={activeSortOrder}
                  onSort={handleSort}
                />
              ) : null}
            </div>

            {selectedPlayer ? (
              <div className="player-search-modal-panel-wrap">
                <PlayerStatsPanel
                  player={selectedPlayer}
                  fantasyPoints={selectedPlayer?.fantasyPoints ?? 0}
                  cost={
                    selectedPlayer?.isDrafted
                      ? (selectedPlayer?.leaguePrice ?? selectedPlayer?.cost ?? 0)
                      : (selectedPlayer?.cost ?? 0)
                  }
                  activeLeagueId={selectedLeagueId}
                  onDraftClick={() => setShowDraftModal(true)}
                  onDropClick={handleDropClick}
                  onMoved={async () => {
                    await refreshLeagues();
                    await reloadAll();
                  }}
                  refreshKey={panelRefreshKey}
                  onClose={() => setSelectedPlayer(null)}
                  scrollWithPage
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <DraftPlayerModal
        open={showDraftModal}
        player={selectedPlayer}
        league={selectedLeague}
        isCustom={isCustomPlayer}
        lockedRosterId={rosterId}
        lockedSlotKey={slotKey}
        onClose={() => setShowDraftModal(false)}
        onDrafted={async (data) => {
          await refreshLeagues();
          await reloadAll();
          await onDrafted?.(data);
          onClose();
        }}
      />
    </>
  );
}

export default PlayerSearchModal;
