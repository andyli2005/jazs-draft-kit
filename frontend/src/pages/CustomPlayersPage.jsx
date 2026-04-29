import { useEffect, useState } from "react";
import Header from "../components/Header";
import DraftPlayerModal from "../components/DraftPlayerModal";
import PlayerStatsPanel from "../components/PlayerStatsPanel";
import Sidebar from "../components/Sidebar";
import { useLeague } from "../leagues";
import {
  createCustomPlayer,
  deleteCustomPlayer,
  dropCustomPlayer,
  getCustomPlayers,
} from "../leagues/requests";

const TABLE_COLUMNS = [
  { label: "Name", key: "name" },
  { label: "Status", key: "status" },
  { label: "Picture URL", key: "pictureURL" },
  { label: "Positions", key: "positions" },
  { label: "Team", key: "team" },
  { label: "Fantasy Points", key: "fantasyPoints" },
  { label: "Draft Price", key: "price" },
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

const CREATE_FIELDS = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "positions", label: "Positions" },
  { key: "team", label: "Team" },
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

  return renderValue(value);
}

function isStatusActive(status) {
  return String(status || "").trim().toLowerCase() === "active";
}

function flattenPlayerForTable(playerDoc) {
  const currentStats = playerDoc?.currentStats || {};
  const projectedStats = playerDoc?.projectedStats || {};
  return {
    ...playerDoc,
    ...currentStats,
    fantasyPoints: currentStats.fantasyPoints ?? projectedStats.fantasyPoints ?? 0,
    isDrafted: Boolean(playerDoc?.ownerId),
    draftOwnerId: playerDoc?.ownerId ? String(playerDoc.ownerId) : null,
    leaguePrice: playerDoc?.price ?? 0,
  };
}

function CreateCustomPlayerModal({ open, formState, onChange, onCancel, onConfirm, isSubmitting, errorMessage }) {
  if (!open) return null;
  const canSubmit = CREATE_FIELDS.every((field) => String(formState[field.key] || "").trim().length > 0);

  return (
    <div className="modal-overlay">
      <div className="modal-panel card draft-modal-panel">
        <div className="modal-header">
          <h2>Create Custom Player</h2>
          <button className="modal-close" type="button" onClick={onCancel} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-fields">
          {CREATE_FIELDS.map((field) => (
            <label className="modal-label" key={field.key}>
              <span>{field.label}</span>
              <input
                className="modal-input"
                type="text"
                value={formState[field.key]}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            </label>
          ))}
          {errorMessage ? <p className="error">{errorMessage}</p> : null}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="btn btn-primary" type="button" onClick={onConfirm} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Creating..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomPlayersPage() {
  const { selectedLeagueId, selectedLeague, refreshLeagues } = useLeague();
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortBy, setSortBy] = useState("fantasyPoints");
  const [sortOrder, setSortOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    status: "Active",
    positions: "",
    team: "",
  });

  useEffect(() => {
    let isMounted = true;
    async function loadPlayers() {
      setIsLoading(true);
      setErrorMessage("");
      if (!selectedLeagueId) {
        setPlayers([]);
        setIsLoading(false);
        setErrorMessage("Select a league first.");
        return;
      }

      try {
        const data = await getCustomPlayers(selectedLeagueId);
        if (!isMounted) return;
        const docs = Array.isArray(data.players) ? data.players : [];
        const nextPlayers = docs.map(flattenPlayerForTable);
        setPlayers(nextPlayers);
        setSelectedPlayer((prev) => {
          if (!prev?._id) return prev;
          return nextPlayers.find((player) => String(player._id) === String(prev._id)) || null;
        });
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err.message || "Unable to load custom players.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPlayers();
    return () => {
      isMounted = false;
    };
  }, [selectedLeagueId]);

  async function reloadPlayers() {
    if (!selectedLeagueId) return;
    const data = await getCustomPlayers(selectedLeagueId);
    const docs = Array.isArray(data.players) ? data.players : [];
    const nextPlayers = docs.map(flattenPlayerForTable);
    setPlayers(nextPlayers);
    setSelectedPlayer((prev) => {
      if (!prev?._id) return prev;
      return nextPlayers.find((player) => String(player._id) === String(prev._id)) || null;
    });
    setPanelRefreshKey((prev) => prev + 1);
  }

  const normalizedSearch = search.trim().toLowerCase();
  const searchedPlayers = normalizedSearch
    ? players.filter((player) =>
        [player.name, player.team, player.positions, player.status]
          .some((value) => String(value || "").toLowerCase().includes(normalizedSearch))
      )
    : players;

  function compareValues(a, b, key) {
    const aValue = a?.[key];
    const bValue = b?.[key];
    const aNumber = Number(aValue);
    const bNumber = Number(bValue);
    const bothNumeric = Number.isFinite(aNumber) && Number.isFinite(bNumber);

    if (bothNumeric) return aNumber - bNumber;
    return String(aValue || "").localeCompare(String(bValue || ""), undefined, { sensitivity: "base" });
  }

  const filteredPlayers = [...searchedPlayers].sort((a, b) => {
    const base = compareValues(a, b, sortBy);
    return sortOrder === "asc" ? base : -base;
  });
  const hasPlayers = filteredPlayers.length > 0;

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

  function handleDraftClick() {
    setShowDraftModal(true);
  }

  async function handleDropClick(player) {
    if (!selectedLeagueId || !player?._id || !player?.draftOwnerId) return;
    const didConfirm = window.confirm(`Drop ${player.name || "this player"} from their roster?`);
    if (!didConfirm) return;

    try {
      await dropCustomPlayer(player._id, {
        leagueId: selectedLeagueId,
        rosterId: player.draftOwnerId,
      });
      await refreshLeagues();
      await reloadPlayers();
    } catch (err) {
      setErrorMessage(err.message || "Failed to drop custom player.");
    }
  }

  async function handleDeleteClick(player) {
    if (!selectedLeagueId || !player?._id) return;
    const didConfirm = window.confirm(
      `Delete ${player.name || "this custom player"}? If drafted, they will be dropped first.`
    );
    if (!didConfirm) return;

    try {
      await deleteCustomPlayer(player._id, { leagueId: selectedLeagueId });
      await refreshLeagues();
      await reloadPlayers();
      setSelectedPlayer((prev) => (String(prev?._id || "") === String(player._id) ? null : prev));
    } catch (err) {
      setErrorMessage(err.message || "Failed to delete custom player.");
    }
  }

  function openCreateModal() {
    setCreateForm({
      name: "",
      status: "Active",
      positions: "",
      team: "",
    });
    setCreateError("");
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (isCreating) return;
    setShowCreateModal(false);
    setCreateError("");
  }

  function handleCreateFieldChange(key, value) {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreateConfirm() {
    if (!selectedLeagueId) return;
    const payload = {
      leagueId: selectedLeagueId,
      name: createForm.name.trim(),
      status: createForm.status.trim(),
      positions: createForm.positions.trim(),
      team: createForm.team.trim(),
    };
    const hasAllRequired = CREATE_FIELDS.every((field) => payload[field.key].length > 0);
    if (!hasAllRequired) {
      setCreateError("All fields are required.");
      return;
    }

    setIsCreating(true);
    setCreateError("");
    try {
      await createCustomPlayer(payload);
      await reloadPlayers();
      setShowCreateModal(false);
    } catch (err) {
      setCreateError(err.message || "Failed to create custom player.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="app-shell page-private">
      <Header />
      <div className={`app-body${selectedPlayer ? " app-body-with-panel" : ""}`}>
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">Custom Players</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
            <h1 style={{ margin: 0 }}>Manage Custom Players</h1>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search custom players..."
                style={{
                  border: "1px solid #c8d2e9",
                  borderRadius: "10px",
                  padding: "0.65rem 0.75rem",
                  font: "inherit",
                  fontSize: "1rem",
                  width: "280px",
                }}
              />
              <button className="btn btn-primary" type="button" onClick={openCreateModal} disabled={!selectedLeagueId}>
                Create Custom Player
              </button>
            </div>
          </div>
          <p className="muted">Custom players are league-local and never synced to the licensed API.</p>

          {isLoading ? <p className="muted">Loading custom players...</p> : null}
          {!isLoading && errorMessage ? <p className="error">{errorMessage}</p> : null}
          {!isLoading && !errorMessage && !hasPlayers ? (
            <p className="muted">No custom players found.</p>
          ) : null}

          {!isLoading && !errorMessage && hasPlayers ? (
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
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((player, index) => {
                      const rowKey = player._id || `${player.name || "player"}-${index}`;
                      const isInactive = !isStatusActive(player.status);
                      const isSelected = selectedPlayer && String(selectedPlayer._id) === String(player._id);
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
                          <td>
                            <button
                              className="btn btn-danger"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteClick(player);
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>

        {selectedPlayer ? (
          <PlayerStatsPanel
            player={selectedPlayer}
            fantasyPoints={selectedPlayer?.fantasyPoints ?? 0}
            cost={selectedPlayer?.isDrafted ? (selectedPlayer?.leaguePrice ?? 0) : 0}
            activeLeagueId={selectedLeagueId}
            onDraftClick={handleDraftClick}
            onDropClick={handleDropClick}
            onMoved={reloadPlayers}
            refreshKey={panelRefreshKey}
            onClose={() => setSelectedPlayer(null)}
          />
        ) : null}
      </div>
      <DraftPlayerModal
        open={showDraftModal}
        player={selectedPlayer}
        league={selectedLeague}
        isCustom
        onClose={() => setShowDraftModal(false)}
        onDrafted={async () => {
          await refreshLeagues();
          await reloadPlayers();
        }}
      />
      <CreateCustomPlayerModal
        open={showCreateModal}
        formState={createForm}
        isSubmitting={isCreating}
        errorMessage={createError}
        onChange={handleCreateFieldChange}
        onCancel={closeCreateModal}
        onConfirm={handleCreateConfirm}
      />
    </main>
  );
}

export default CustomPlayersPage;
