import { useEffect, useState } from "react";
import { getPlayerDoc, updatePlayerDoc } from "../leagues/requests";

const BATTING_STATS = [
  { label: "At Bats", key: "atBats" },
  { label: "Batting Avg", key: "battingAverage" },
  { label: "Hits", key: "hits" },
  { label: "Home Runs", key: "homeRuns" },
  { label: "Runs", key: "runs" },
  { label: "RBI", key: "runsBattedIn" },
  { label: "Stolen Bases", key: "stolenBases" },
  { label: "OBP", key: "onBasePercentage" },
  { label: "SLG", key: "sluggingPercentage" },
  { label: "Base on Balls", key: "baseOnBalls" },
  { label: "Strikeouts", key: "strikeOuts" },
  { label: "Doubles", key: "doubles" },
  { label: "Triples", key: "triples" },
  { label: "Singles", key: "singles" },
  { label: "Caught Stealing", key: "caughtStealing" },
];

function valueFrom(sources, keys) {
  for (const source of sources) {
    for (const key of keys) {
      const value = source?.[key];
      if (value != null && value !== "") return value;
    }
  }
  return null;
}

function formatDetailValue(value, fallback = "N/A") {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatHeight(value) {
  const height = Number(value);
  if (!Number.isFinite(height) || height <= 0) return null;
  const feet = Math.floor(height / 12);
  const inches = height % 12;
  return `${feet}' ${inches}"`;
}

function formatWeight(value) {
  const weight = Number(value);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return `${weight} lb`;
}

function getDepthChartValue(sources, key) {
  for (const source of sources) {
    const depthChart = source?.depthChart;
    if (depthChart && typeof depthChart === "object") {
      const value = depthChart[key];
      if (value != null && value !== "") return value;
    }
  }
  return null;
}

function PlayerStatsPanel({
  player,
  fantasyPoints,
  cost,
  activeLeagueId,
  onClose,
  onDraftClick,
  onDropClick,
  refreshKey = 0,
  scrollWithPage = false,
}) {
  const [playerDoc, setPlayerDoc] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!player?.APIplayerId || !activeLeagueId) {
      setPlayerDoc(null);
      setIsEditing(false);
      return;
    }

    let isMounted = true;
    async function fetchPlayerDoc() {
      try {
        const data = await getPlayerDoc(player.APIplayerId, activeLeagueId);
        if (!isMounted) return;
        setPlayerDoc(data.playerDoc || null);
      } catch {
        if (isMounted) setPlayerDoc(null);
      }
    }

    setIsEditing(false);
    setSaveError("");
    fetchPlayerDoc();
    return () => { isMounted = false; };
  }, [player?.APIplayerId, activeLeagueId, refreshKey]);

  const hasDoc = playerDoc != null;
  const displayData = hasDoc ? playerDoc : player;
  const stats = hasDoc ? (playerDoc.currentStats || {}) : player;
  const detailSources = [displayData, player];
  const age = valueFrom(detailSources, ["age"]);
  const injuryStatus =
    valueFrom(detailSources, ["injuryStatus"]) ||
    (valueFrom(detailSources, ["injury"]) ? "Injured" : "Healthy");
  const injuryNote = valueFrom(detailSources, ["injuryNote"]);
  const depthChartStatus = getDepthChartValue(detailSources, "status");
  const depthChartPosition = getDepthChartValue(detailSources, "position");
  const depthChartRank = getDepthChartValue(detailSources, "rank");
  const depthChartRole = getDepthChartValue(detailSources, "role");
  const depthChartSection = getDepthChartValue(detailSources, "section");
  const playerDetails = [
    { label: "Age", value: age },
    { label: "Height", value: formatHeight(valueFrom(detailSources, ["height"])) },
    { label: "Weight", value: formatWeight(valueFrom(detailSources, ["weight"])) },
    { label: "Injury Status", value: injuryStatus, fallback: "Unknown" },
    { label: "Injury Note", value: injuryNote },
    { label: "Depth Chart Status", value: depthChartStatus },
    { label: "Depth Chart Position", value: depthChartPosition },
    { label: "Depth Chart Rank", value: depthChartRank },
    { label: "Depth Chart Role", value: depthChartRole },
    { label: "Depth Chart Section", value: depthChartSection },
    { label: "Player Status", value: displayData.status },
  ];

  function handleEdit() {
    setEditDraft(playerDoc?.personalNotes || "");
    setSaveError("");
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setSaveError("");
  }

  async function handleSave() {
    if (!player?.APIplayerId || !activeLeagueId) return;

    setIsSaving(true);
    setSaveError("");
    try {
      const data = await updatePlayerDoc(player.APIplayerId, {
        leagueId: activeLeagueId,
        personalNotes: editDraft,
        name: player.name,
        status: player.status || "Active",
        notes: player.notes || "",
        positions: player.positions || "",
        team: player.team || "",
        pictureURL: player.pictureURL || "",
        age: player.age ?? null,
        injury: Boolean(player.injury),
        injuryStatus: player.injuryStatus || "",
        injuryNote: player.injuryNote || "",
        depthChart: player.depthChart || {},
        height: player.height ?? null,
        weight: player.weight ?? null,
        // Keep existing draft price for accurate drop refunds.
        price: playerDoc?.price ?? player?.leaguePrice ?? 0,
        currentStats: player.currentStats || {},
        projectedStats: player.projectedStats || {},
        threeYearAverageStats: player.threeYearAverageStats || {},
      });
      setPlayerDoc(data.playerDoc);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err.message || "Failed to save notes.");
    } finally {
      setIsSaving(false);
    }
  }

  const notesDisabled = !activeLeagueId;
  const personalNotes = playerDoc?.personalNotes || "";
  const isDrafted = Boolean(player?.isDrafted ?? playerDoc?.ownerId);
  const hasActionHandler = isDrafted ? Boolean(onDropClick) : Boolean(onDraftClick);
  const actionDisabled = !activeLeagueId || !hasActionHandler;
  const actionLabel = isDrafted ? "Drop" : "Draft";
  const actionClassName = `btn ${
    isDrafted ? "btn-danger" : "btn-primary"
  } player-stats-edit-btn player-stats-draft-btn`;

  function handlePrimaryAction() {
    if (actionDisabled) return;
    if (isDrafted) {
      onDropClick?.(player);
      return;
    }
    onDraftClick?.(player);
  }

  return (
    <aside className={`player-stats-panel${scrollWithPage ? " player-stats-panel-inline" : ""}`}>
      <div className="player-stats-top">
        <p className="eyebrow">Player Stats</p>
        <button
          className="player-stats-close"
          type="button"
          onClick={onClose}
          aria-label="Close panel"
        >
          &times;
        </button>
      </div>

      <div className="player-stats-photo-wrap">
        {displayData.pictureURL ? (
          <img
            src={displayData.pictureURL}
            alt={displayData.name}
            className="player-stats-photo"
          />
        ) : (
          <div className="player-stats-photo-placeholder">No Photo</div>
        )}
      </div>

      <h2 className="player-stats-name">{displayData.name || "Unknown Player"}</h2>

      <div className="player-stats-meta">
        {displayData.positions && (
          <span className="player-stats-badge">{displayData.positions}</span>
        )}
        {displayData.team && (
          <span className="player-stats-badge">{displayData.team}</span>
        )}
        {displayData.status && (
          <span className="player-stats-badge badge-outline">{displayData.status}</span>
        )}
      </div>

      <div className="player-stats-kpi-row">
        <div className="player-stats-kpi">
          <span className="player-stats-kpi-label">Fantasy Pts</span>
          <span className="player-stats-kpi-value">
            {fantasyPoints}
          </span>
        </div>
        <div className="player-stats-kpi">
          <span className="player-stats-kpi-label">Est. Cost</span>
          <span className="player-stats-kpi-value">${cost}</span>
        </div>
      </div>

      <div className="player-stats-section">
        <div className="player-stats-section-head">
          <h3>Player Action</h3>
          <button
            className={actionClassName}
            type="button"
            onClick={handlePrimaryAction}
            disabled={actionDisabled}
          >
            {actionLabel}
          </button>
        </div>
        {!activeLeagueId ? (
          <p className="muted">Select a league to manage draft actions.</p>
        ) : !hasActionHandler ? (
          <p className="muted">Draft actions are only available from player search.</p>
        ) : null}
      </div>

      <div className="player-stats-section">
        <div className="player-stats-section-head">
          <h3>Personal Notes</h3>
          {!isEditing && (
            <button
              className="btn btn-secondary player-stats-edit-btn"
              type="button"
              onClick={handleEdit}
              disabled={notesDisabled}
            >
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="player-stats-notes-editor">
            <textarea
              className="player-stats-textarea"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={4}
              placeholder="Write your notes about this player..."
            />
            {saveError && <p className="error">{saveError}</p>}
            <div className="player-stats-notes-actions">
              <button
                className="btn btn-primary player-stats-edit-btn"
                type="button"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                className="btn btn-secondary player-stats-edit-btn"
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="player-stats-notes-display">
            {personalNotes ? (
              <p>{personalNotes}</p>
            ) : (
              <p className="muted">
                {notesDisabled
                  ? "Create a league to add notes."
                  : "No notes yet. Click Edit to add notes."}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="player-stats-section">
        <h3>Player Details</h3>
        <dl className="player-stats-details">
          {playerDetails.map((detail) => (
            <div className="player-stats-detail-row" key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{formatDetailValue(detail.value, detail.fallback)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="player-stats-section">
        <h3>Batting Stats</h3>
        <div className="player-stats-table-wrap">
          <table className="player-stats-table">
            <thead>
              <tr>
                <th>Stat</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {BATTING_STATS.map((stat) => (
                <tr key={stat.key}>
                  <td>{stat.label}</td>
                  <td>{stats[stat.key] != null ? stats[stat.key] : "---"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </aside>
  );
}

export default PlayerStatsPanel;
