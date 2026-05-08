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

  const [activeTab, setActiveTab] = useState("licensed");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("fantasyPoints");
  const [sortOrder, setSortOrder] = useState("desc");

  const [licensedPlayers, setLicensedPlayers] = useState([]);
  const [licensedLoading, setLicensedLoading] = useState(false);
  const [licensedError, setLicensedError] = useState("");

  const [customPlayers, setCustomPlayers] = useState([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState("");

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);

  const slotDef = SLOT_DEFS.find((s) => s.key === slotKey);
  const eligiblePosTokens = useMemo(
    () => (slotKey ? getEligiblePosTokensForSlot(slotKey) : null),
    [slotKey]
  );

  useEffect(() => {
    if (!open || !selectedLeagueId) return;
    let isMounted = true;
    setLicensedLoading(true);
    setLicensedError("");
    getPlayers({ leagueId: selectedLeagueId, rankBy: "fantasyPoints", order: "desc" })
      .then((data) => {
        if (!isMounted) return;
        setLicensedPlayers(Array.isArray(data.players) ? data.players : []);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLicensedError(err.message || "Failed to load players.");
      })
      .finally(() => {
        if (isMounted) setLicensedLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [open, selectedLeagueId]);

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
    setSearch("");
    setSortBy("fantasyPoints");
    setSortOrder("desc");
    setActiveTab("licensed");
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
    if (!eligiblePosTokens || eligiblePosTokens.size === 0) return players;
    return players.filter((player) => {
      const tokens = parseEligiblePositions(player.positions);
      return tokens.some((t) => eligiblePosTokens.has(t));
    });
  }

  function filterBySearch(players) {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return players;
    return players.filter((player) =>
      [player.name, player.team, player.positions, player.status].some((v) =>
        String(v || "").toLowerCase().includes(normalized)
      )
    );
  }

  function sortPlayerList(players) {
    return [...players].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      const aN = Number(aValue);
      const bN = Number(bValue);
      if (Number.isFinite(aN) && Number.isFinite(bN)) {
        return sortOrder === "asc" ? aN - bN : bN - aN;
      }
      const cmp = String(aValue || "").localeCompare(String(bValue || ""), undefined, {
        sensitivity: "base",
      });
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }

  function handleSort(key) {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  }

  const displayedLicensed = useMemo(
    () => sortPlayerList(filterBySearch(filterBySlot(licensedPlayers))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [licensedPlayers, search, eligiblePosTokens, sortBy, sortOrder]
  );

  const displayedCustom = useMemo(
    () => sortPlayerList(filterBySearch(filterBySlot(customPlayers))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customPlayers, search, eligiblePosTokens, sortBy, sortOrder]
  );

  async function reloadAll() {
    if (!selectedLeagueId) return;
    const [licensedData, customData] = await Promise.all([
      getPlayers({ leagueId: selectedLeagueId, rankBy: "fantasyPoints", order: "desc" }),
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
          </div>

          <div className="player-search-modal-body">
            <div className="player-search-modal-list">
              <div className="player-search-modal-search">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
                  sortBy={sortBy}
                  sortOrder={sortOrder}
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
