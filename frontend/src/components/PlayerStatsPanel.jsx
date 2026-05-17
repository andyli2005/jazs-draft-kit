import { useEffect, useState } from "react";
import ChangePositionMenu from "./ChangePositionMenu";
import PositionChecklistDropdown from "./PositionChecklistDropdown";
import { useLeague } from "../leagues";
import { formatPositionsString, parsePositionsString } from "../leagues/positions";
import { getPlayerDoc, updateCustomPlayer, updatePlayerDoc } from "../leagues/requests";

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
  ownerRosterId = null,
  onClose,
  onDraftClick,
  onDropClick,
  onMoved,
  refreshKey = 0,
  scrollWithPage = false,
}) {
  const { selectedLeague } = useLeague();
  const [playerDoc, setPlayerDoc] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [customDraft, setCustomDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showChangePositionMenu, setShowChangePositionMenu] = useState(false);
  const isCustomPlayer = Boolean(player?.isCustom || !player?.APIplayerId);

  useEffect(() => {
    if (!activeLeagueId) {
      setPlayerDoc(null);
      setIsEditing(false);
      setShowChangePositionMenu(false);
      return;
    }

    if (isCustomPlayer) {
      setPlayerDoc(player || null);
      setIsEditing(false);
      setShowChangePositionMenu(false);
      setSaveError("");
      return;
    }

    if (!player?.APIplayerId) {
      setPlayerDoc(null);
      setIsEditing(false);
      setShowChangePositionMenu(false);
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
    setShowChangePositionMenu(false);
    fetchPlayerDoc();
    return () => { isMounted = false; };
  }, [player, player?.APIplayerId, activeLeagueId, isCustomPlayer, refreshKey]);

  const hasDoc = playerDoc != null;
  const displayData = hasDoc ? playerDoc : player;
  const stats = hasDoc ? (playerDoc.currentStats || {}) : (player?.currentStats || {});
  const detailSources = [player, displayData];
  const age = valueFrom(detailSources, ["age"]);
  const latestNews = valueFrom(detailSources, ["latestNews"]);
  const injuryStatus = valueFrom(detailSources, ["injuryStatus"]);
  const playerNotes = valueFrom(detailSources, ["notes"]);
  const normalizedStatus = String(displayData?.status || "").trim().toLowerCase();
  const isActivePlayer = normalizedStatus === "active";
  const depthChartPosition = getDepthChartValue(detailSources, "position");
  const depthChartRank = getDepthChartValue(detailSources, "rank");
  const depthChartRole = getDepthChartValue(detailSources, "role");
  const depthChartSection = getDepthChartValue(detailSources, "section");
  const playerDetails = [
    { label: "Age", value: age },
    { label: "Height", value: formatHeight(valueFrom(detailSources, ["height"])) },
    { label: "Weight", value: formatWeight(valueFrom(detailSources, ["weight"])) },
    { label: "Injury Status", value: injuryStatus },
    { label: "Latest News", value: latestNews },
    { label: "Depth Chart Position", value: depthChartPosition },
    { label: "Depth Chart Rank", value: depthChartRank },
    { label: "Depth Chart Role", value: depthChartRole },
    { label: "Depth Chart Section", value: depthChartSection },
    { label: "Player Status", value: displayData?.status },
  ];
  const effectiveOwnerId = playerDoc?.ownerId || player?.ownerId || ownerRosterId || null;

  function handleEdit() {
    if (isCustomPlayer) {
      setCustomDraft({
        name: displayData?.name || "",
        status: displayData?.status || "Active",
        notes: displayData?.notes || "",
        positions: parsePositionsString(displayData?.positions),
        team: displayData?.team || "",
        pictureURL: displayData?.pictureURL || "",
        personalNotes: displayData?.personalNotes || "",
        currentStats: { ...(displayData?.currentStats || {}) },
        projectedStats: { ...(displayData?.projectedStats || {}) },
        threeYearAverageStats: { ...(displayData?.threeYearAverageStats || {}) },
      });
    } else {
      setEditDraft(playerDoc?.personalNotes || "");
    }
    setSaveError("");
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setCustomDraft(null);
    setSaveError("");
  }

  function updateCustomDraftField(key, value) {
    setCustomDraft((prev) => ({ ...(prev || {}), [key]: value }));
  }

  function updateCustomStatBlock(blockKey, statKey, rawValue) {
    const parsedValue = Number(rawValue);
    const safeValue = Number.isFinite(parsedValue) ? parsedValue : 0;
    setCustomDraft((prev) => ({
      ...(prev || {}),
      [blockKey]: {
        ...((prev && prev[blockKey]) || {}),
        [statKey]: safeValue,
      },
    }));
  }

  async function handleSave() {
    if (!activeLeagueId) return;

    setIsSaving(true);
    setSaveError("");
    try {
      if (isCustomPlayer) {
        if (!player?._id || !customDraft) return;
        const data = await updateCustomPlayer(player._id, {
          leagueId: activeLeagueId,
          name: customDraft.name || "",
          status: customDraft.status || "Active",
          notes: customDraft.notes || customDraft.status || "",
          positions: formatPositionsString(customDraft.positions),
          team: customDraft.team || "",
          pictureURL: customDraft.pictureURL || "",
          personalNotes: customDraft.personalNotes || "",
          currentStats: customDraft.currentStats || {},
          projectedStats: customDraft.projectedStats || {},
          threeYearAverageStats: customDraft.threeYearAverageStats || {},
        });
        setPlayerDoc(data.playerDoc);
      } else {
        if (!player?.APIplayerId) return;
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
          contractStatus: player.contractStatus || "",
          latestNews: player.latestNews || "",
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
      }
      setIsEditing(false);
      setCustomDraft(null);
    } catch (err) {
      setSaveError(err.message || "Failed to save player.");
    } finally {
      setIsSaving(false);
    }
  }

  const notesDisabled = !activeLeagueId;
  const personalNotes = displayData?.personalNotes || "";
  const isDrafted = Boolean(player?.isDrafted ?? effectiveOwnerId ?? (onDropClick && !onDraftClick));
  const hasActionHandler = isDrafted ? Boolean(onDropClick) : Boolean(onDraftClick);
  const actionDisabled = !activeLeagueId || !hasActionHandler;
  const actionLabel = isDrafted ? "Drop" : "Draft";
  const canChangePosition = Boolean(
    isDrafted &&
    activeLeagueId &&
    selectedLeague &&
    effectiveOwnerId &&
    (isCustomPlayer ? player?._id : player?.APIplayerId)
  );
  const actionClassName = `btn ${
    isDrafted ? "btn-danger" : "btn-primary"
  } player-stats-edit-btn player-stats-draft-btn`;

  function handlePrimaryAction() {
    if (actionDisabled) return;
    setShowChangePositionMenu(false);
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
          <span className={`player-stats-badge status-badge ${isActivePlayer ? "status-badge-active" : "status-badge-inactive"}`}>
            {displayData.status}
          </span>
        )}
        {displayData.injuryStatus && (
          <span className="player-stats-badge injury-badge">{displayData.injuryStatus}</span>
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

      {!isCustomPlayer && (
        <div className="player-stats-section">
          <h3>Player Notes</h3>
          <div className="player-stats-notes-display">
            {playerNotes ? (
              <p>{playerNotes}</p>
            ) : (
              <p className="muted">No player notes available.</p>
            )}
          </div>
        </div>
      )}

      <div className="player-stats-section">
        <div className="player-stats-section-head">
          <h3>Player Action</h3>
          <div className="player-stats-notes-actions">
            {canChangePosition ? (
              <div className="change-position-anchor">
                <button
                  className="btn btn-secondary player-stats-edit-btn"
                  type="button"
                  onClick={() => setShowChangePositionMenu(true)}
                >
                  Change Position
                </button>
                {showChangePositionMenu && canChangePosition ? (
                  <ChangePositionMenu
                    player={player}
                    playerDoc={{
                      ...(playerDoc || {}),
                      ownerId: effectiveOwnerId,
                    }}
                    isCustom={isCustomPlayer}
                    league={selectedLeague}
                    activeLeagueId={activeLeagueId}
                    onMoved={onMoved}
                    onClose={() => setShowChangePositionMenu(false)}
                  />
                ) : null}
              </div>
            ) : null}
            <button
              className={actionClassName}
              type="button"
              onClick={handlePrimaryAction}
              disabled={actionDisabled}
            >
              {actionLabel}
            </button>
          </div>
        </div>
        {!activeLeagueId ? (
          <p className="muted">Select a league to manage draft actions.</p>
        ) : !hasActionHandler ? (
          <p className="muted">Draft actions are only available from player search.</p>
        ) : null}
      </div>

      <div className="player-stats-section">
        <div className="player-stats-section-head">
          <h3>{isCustomPlayer ? "Player Details" : "Personal Notes"}</h3>
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
            {isCustomPlayer ? (
              <div style={{ display: "grid", gap: "0.6rem" }}>
                <label className="modal-label">
                  <span>Name</span>
                  <input
                    className="modal-input"
                    type="text"
                    value={customDraft?.name || ""}
                    onChange={(event) => updateCustomDraftField("name", event.target.value)}
                  />
                </label>
                <label className="modal-label">
                  <span>Status</span>
                  <input
                    className="modal-input"
                    type="text"
                    value={customDraft?.status || ""}
                    onChange={(event) => updateCustomDraftField("status", event.target.value)}
                  />
                </label>
                <label className="modal-label">
                  <span>Positions</span>
                  <PositionChecklistDropdown
                    selected={customDraft?.positions || []}
                    onChange={(value) => updateCustomDraftField("positions", value)}
                    disabled={isSaving}
                  />
                </label>
                <label className="modal-label">
                  <span>Team</span>
                  <input
                    className="modal-input"
                    type="text"
                    value={customDraft?.team || ""}
                    onChange={(event) => updateCustomDraftField("team", event.target.value)}
                  />
                </label>
                <label className="modal-label">
                  <span>Picture URL</span>
                  <input
                    className="modal-input"
                    type="text"
                    value={customDraft?.pictureURL || ""}
                    onChange={(event) => updateCustomDraftField("pictureURL", event.target.value)}
                  />
                </label>
                <label className="modal-label">
                  <span>Notes</span>
                  <textarea
                    className="player-stats-textarea"
                    value={customDraft?.notes || ""}
                    onChange={(event) => updateCustomDraftField("notes", event.target.value)}
                    rows={3}
                  />
                </label>
                <label className="modal-label">
                  <span>Personal Notes</span>
                  <textarea
                    className="player-stats-textarea"
                    value={customDraft?.personalNotes || ""}
                    onChange={(event) => updateCustomDraftField("personalNotes", event.target.value)}
                    rows={3}
                  />
                </label>
              </div>
            ) : (
              <textarea
                className="player-stats-textarea"
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={4}
                placeholder="Write your notes about this player..."
              />
            )}
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
            {isCustomPlayer ? (
              <div>
                <p><strong>Notes:</strong> {displayData?.notes || "N/A"}</p>
                <p><strong>Personal Notes:</strong> {personalNotes || "N/A"}</p>
              </div>
            ) : personalNotes ? (
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
                  <td>
                    {isCustomPlayer && isEditing ? (
                      <input
                        className="modal-input"
                        type="number"
                        value={customDraft?.currentStats?.[stat.key] ?? 0}
                        onChange={(event) =>
                          updateCustomStatBlock("currentStats", stat.key, event.target.value)
                        }
                      />
                    ) : (
                      stats[stat.key] != null ? stats[stat.key] : "---"
                    )}
                  </td>
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
