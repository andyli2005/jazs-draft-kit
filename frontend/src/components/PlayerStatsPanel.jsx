import { useEffect, useState } from "react";
import ChangePositionMenu from "./ChangePositionMenu";
import EditContractModal from "./EditContractModal";
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

function SectionEditActions({ onSave, onCancel, isSaving, saveError, saveDisabled = false }) {
  return (
    <div>
      {saveError && <p className="error">{saveError}</p>}
      <div className="player-stats-notes-actions">
        <button
          className="btn btn-primary player-stats-edit-btn"
          type="button"
          onClick={onSave}
          disabled={isSaving || saveDisabled}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          className="btn btn-secondary player-stats-edit-btn"
          type="button"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
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
  onContractSaved = null,
  refreshKey = 0,
  scrollWithPage = false,
  teamDepthChart = null,
}) {
  const { selectedLeague } = useLeague();
  const [playerDoc, setPlayerDoc] = useState(null);

  // Three independent edit sections
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isEditingStats, setIsEditingStats] = useState(false);

  // Per-section draft states
  const [notesDraft, setNotesDraft] = useState(null);
  const [detailsDraft, setDetailsDraft] = useState(null);
  const [statsDraft, setStatsDraft] = useState(null);

  // For non-custom player notes
  const [editPersonalNotes, setEditPersonalNotes] = useState("");
  const [editContractStatus, setEditContractStatus] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showChangePositionMenu, setShowChangePositionMenu] = useState(false);
  const [showEditContractModal, setShowEditContractModal] = useState(false);
  const isCustomPlayer = Boolean(player?.isCustom || !player?.APIplayerId);

  function resetAllEdits() {
    setIsEditingNotes(false);
    setIsEditingDetails(false);
    setIsEditingStats(false);
    setNotesDraft(null);
    setDetailsDraft(null);
    setStatsDraft(null);
    setSaveError("");
    setShowEditContractModal(false);
  }

  useEffect(() => {
    if (!activeLeagueId) {
      setPlayerDoc(null);
      resetAllEdits();
      setShowChangePositionMenu(false);
      return;
    }

    if (isCustomPlayer) {
      setPlayerDoc(player || null);
      resetAllEdits();
      setShowChangePositionMenu(false);
      return;
    }

    if (!player?.APIplayerId) {
      setPlayerDoc(null);
      resetAllEdits();
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

    resetAllEdits();
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
  const contractStatus = valueFrom([playerDoc, player], ["contractStatus"]);
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
  const isPlayerDrafted = Boolean(
    player?.isDrafted ||
    player?.ownerId ||
    playerDoc?.ownerId ||
    ownerRosterId
  );
  const notesDisabled = !activeLeagueId;
  const personalNotes = displayData?.personalNotes || "";

  // Build a full custom-player body from current displayData, then merge overrides.
  // This way each section save keeps all fields intact.
  function buildCustomSaveBody(overrides = {}) {
    return {
      leagueId: activeLeagueId,
      name: displayData?.name || "",
      status: displayData?.status || "Active",
      notes: displayData?.notes || "",
      positions: displayData?.positions || "",
      team: displayData?.team || "",
      pictureURL: displayData?.pictureURL || "",
      personalNotes: displayData?.personalNotes || "",
      age: displayData?.age ?? null,
      height: displayData?.height ?? null,
      weight: displayData?.weight ?? null,
      injuryStatus: displayData?.injuryStatus || "",
      latestNews: displayData?.latestNews || "",
      currentStats: displayData?.currentStats || {},
      projectedStats: displayData?.projectedStats || {},
      threeYearAverageStats: displayData?.threeYearAverageStats || {},
      ...(effectiveOwnerId ? { contractStatus: displayData?.contractStatus || "" } : {}),
      ...overrides,
    };
  }

  // ─── Player Notes section ─────────────────────────────────────────────────

  function handleEditNotes() {
    resetAllEdits();
    if (isCustomPlayer) {
      setNotesDraft({
        name: displayData?.name || "",
        status: displayData?.status || "Active",
        notes: displayData?.notes || "",
        positions: parsePositionsString(displayData?.positions),
        team: displayData?.team || "",
        pictureURL: displayData?.pictureURL || "",
        personalNotes: displayData?.personalNotes || "",
        contractStatus: effectiveOwnerId ? (displayData?.contractStatus || "") : "",
      });
    } else {
      setEditPersonalNotes(playerDoc?.personalNotes || "");
      setEditContractStatus(effectiveOwnerId ? (playerDoc?.contractStatus || "") : "");
    }
    setIsEditingNotes(true);
  }

  function handleCancelNotes() {
    setIsEditingNotes(false);
    setNotesDraft(null);
    setSaveError("");
  }

  function updateNotesDraftField(key, value) {
    setNotesDraft((prev) => ({ ...(prev || {}), [key]: value }));
  }

  async function handleSaveNotes() {
    if (!activeLeagueId) return;
    setIsSaving(true);
    setSaveError("");
    try {
      if (isCustomPlayer) {
        if (!player?._id || !notesDraft) return;
        const body = buildCustomSaveBody({
          name: notesDraft.name || "",
          status: notesDraft.status || "Active",
          notes: notesDraft.notes || "",
          positions: formatPositionsString(notesDraft.positions),
          team: notesDraft.team || "",
          pictureURL: notesDraft.pictureURL || "",
          personalNotes: notesDraft.personalNotes || "",
          ...(effectiveOwnerId ? { contractStatus: notesDraft.contractStatus } : {}),
        });
        const data = await updateCustomPlayer(player._id, body);
        setPlayerDoc(data.playerDoc);
      } else {
        if (!player?.APIplayerId) return;
        const body = {
          leagueId: activeLeagueId,
          personalNotes: editPersonalNotes,
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
        };
        if (effectiveOwnerId) {
          body.contractStatus = editContractStatus;
        }
        const data = await updatePlayerDoc(player.APIplayerId, body);
        setPlayerDoc(data.playerDoc);
      }
      setIsEditingNotes(false);
      setNotesDraft(null);
    } catch (err) {
      setSaveError(err.message || "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Player Details section (custom only) ────────────────────────────────

  function handleEditDetails() {
    resetAllEdits();
    setDetailsDraft({
      age: displayData?.age ?? "",
      height: displayData?.height ?? "",
      weight: displayData?.weight ?? "",
      injuryStatus: displayData?.injuryStatus || "",
      latestNews: displayData?.latestNews || "",
    });
    setIsEditingDetails(true);
  }

  function handleCancelDetails() {
    setIsEditingDetails(false);
    setDetailsDraft(null);
    setSaveError("");
  }

  function updateDetailsDraftField(key, value) {
    setDetailsDraft((prev) => ({ ...(prev || {}), [key]: value }));
  }

  async function handleSaveDetails() {
    if (!activeLeagueId || !player?._id || !detailsDraft) return;
    setIsSaving(true);
    setSaveError("");
    try {
      const body = buildCustomSaveBody({
        age: detailsDraft.age !== "" ? Number(detailsDraft.age) : null,
        height: detailsDraft.height !== "" ? Number(detailsDraft.height) : null,
        weight: detailsDraft.weight !== "" ? Number(detailsDraft.weight) : null,
        injuryStatus: detailsDraft.injuryStatus || "",
        latestNews: detailsDraft.latestNews || "",
      });
      const data = await updateCustomPlayer(player._id, body);
      setPlayerDoc(data.playerDoc);
      setIsEditingDetails(false);
      setDetailsDraft(null);
    } catch (err) {
      setSaveError(err.message || "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Batting Stats section (custom only) ─────────────────────────────────

  function handleEditStats() {
    resetAllEdits();
    setStatsDraft({
      currentStats: { ...(displayData?.currentStats || {}) },
      projectedStats: { ...(displayData?.projectedStats || {}) },
      threeYearAverageStats: { ...(displayData?.threeYearAverageStats || {}) },
    });
    setIsEditingStats(true);
  }

  function handleCancelStats() {
    setIsEditingStats(false);
    setStatsDraft(null);
    setSaveError("");
  }

  function updateStatsDraftBlock(blockKey, statKey, rawValue) {
    const parsedValue = Number(rawValue);
    const safeValue = Number.isFinite(parsedValue) ? parsedValue : 0;
    setStatsDraft((prev) => ({
      ...(prev || {}),
      [blockKey]: {
        ...((prev && prev[blockKey]) || {}),
        [statKey]: safeValue,
      },
    }));
  }

  async function handleSaveStats() {
    if (!activeLeagueId || !player?._id || !statsDraft) return;
    setIsSaving(true);
    setSaveError("");
    try {
      const body = buildCustomSaveBody({
        currentStats: statsDraft.currentStats || {},
        projectedStats: statsDraft.projectedStats || {},
        threeYearAverageStats: statsDraft.threeYearAverageStats || {},
      });
      const data = await updateCustomPlayer(player._id, body);
      setPlayerDoc(data.playerDoc);
      setIsEditingStats(false);
      setStatsDraft(null);
    } catch (err) {
      setSaveError(err.message || "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Edit contract ────────────────────────────────────────────────────────

  async function handleSaveContract({ contractStatus, price }) {
    if (!activeLeagueId) throw new Error("No active league.");
    let savedDoc = null;
    if (isCustomPlayer) {
      if (!player?._id) throw new Error("Player not found.");
      const body = buildCustomSaveBody({ contractStatus, price });
      const data = await updateCustomPlayer(player._id, body);
      savedDoc = data.playerDoc;
    } else {
      if (!player?.APIplayerId) throw new Error("Player not found.");
      const body = {
        leagueId: activeLeagueId,
        personalNotes: playerDoc?.personalNotes || "",
        name: player.name,
        status: player.status || "Active",
        notes: player.notes || "",
        positions: player.positions || "",
        team: player.team || "",
        pictureURL: player.pictureURL || "",
        age: player.age ?? null,
        contractStatus,
        latestNews: player.latestNews || "",
        depthChart: player.depthChart || {},
        height: player.height ?? null,
        weight: player.weight ?? null,
        price,
        currentStats: player.currentStats || {},
        projectedStats: player.projectedStats || {},
        threeYearAverageStats: player.threeYearAverageStats || {},
      };
      const data = await updatePlayerDoc(player.APIplayerId, body);
      savedDoc = data.playerDoc;
    }
    setPlayerDoc(savedDoc);
    await onContractSaved?.(savedDoc);
  }

  // ─── Draft / drop ─────────────────────────────────────────────────────────

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
        {isPlayerDrafted && contractStatus ? (
          <div className="player-stats-kpi">
            <span className="player-stats-kpi-label">Contract</span>
            <span className="player-stats-kpi-value">{contractStatus}</span>
          </div>
        ) : null}
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
            {effectiveOwnerId && activeLeagueId ? (
              <button
                className="btn btn-secondary player-stats-edit-btn"
                type="button"
                onClick={() => setShowEditContractModal(true)}
              >
                Edit Contract
              </button>
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

      {/* ── Player Notes section ── */}
      <div className="player-stats-section">
        <div className="player-stats-section-head">
          <h3>{isCustomPlayer ? "Player Notes" : "Personal Notes"}</h3>
          {!isEditingNotes && (
            <button
              className="btn btn-secondary player-stats-edit-btn"
              type="button"
              onClick={handleEditNotes}
              disabled={notesDisabled}
            >
              Edit
            </button>
          )}
        </div>

        {isEditingNotes ? (
          <div className="player-stats-notes-editor">
            {isCustomPlayer ? (
              <div style={{ display: "grid", gap: "0.6rem" }}>
                <label className="modal-label">
                  <span>Name</span>
                  <input
                    className="modal-input"
                    type="text"
                    value={notesDraft?.name || ""}
                    onChange={(e) => updateNotesDraftField("name", e.target.value)}
                    disabled={isSaving}
                  />
                </label>
                <label className="modal-label">
                  <span>Status</span>
                  <input
                    className="modal-input"
                    type="text"
                    value={notesDraft?.status || ""}
                    onChange={(e) => updateNotesDraftField("status", e.target.value)}
                    disabled={isSaving}
                  />
                </label>
                <label className="modal-label">
                  <span>Positions</span>
                  <PositionChecklistDropdown
                    selected={notesDraft?.positions || []}
                    onChange={(value) => updateNotesDraftField("positions", value)}
                    disabled={isSaving}
                  />
                </label>
                <label className="modal-label">
                  <span>Team</span>
                  <input
                    className="modal-input"
                    type="text"
                    value={notesDraft?.team || ""}
                    onChange={(e) => updateNotesDraftField("team", e.target.value)}
                    disabled={isSaving}
                  />
                </label>
                <label className="modal-label">
                  <span>Picture URL</span>
                  <input
                    className="modal-input"
                    type="text"
                    value={notesDraft?.pictureURL || ""}
                    onChange={(e) => updateNotesDraftField("pictureURL", e.target.value)}
                    disabled={isSaving}
                  />
                </label>
                <label className="modal-label">
                  <span>Notes</span>
                  <textarea
                    className="player-stats-textarea"
                    value={notesDraft?.notes || ""}
                    onChange={(e) => updateNotesDraftField("notes", e.target.value)}
                    rows={3}
                    disabled={isSaving}
                  />
                </label>
                <label className="modal-label">
                  <span>Personal Notes</span>
                  <textarea
                    className="player-stats-textarea"
                    value={notesDraft?.personalNotes || ""}
                    onChange={(e) => updateNotesDraftField("personalNotes", e.target.value)}
                    rows={3}
                    disabled={isSaving}
                  />
                </label>
                {effectiveOwnerId ? (
                  <label className="modal-label">
                    <span>Contract status</span>
                    <input
                      className="modal-input"
                      type="text"
                      value={notesDraft?.contractStatus || ""}
                      onChange={(e) => updateNotesDraftField("contractStatus", e.target.value)}
                      placeholder="Enter contract status"
                      disabled={isSaving}
                    />
                  </label>
                ) : null}
              </div>
            ) : (
              <>
                {effectiveOwnerId ? (
                  <label className="modal-label">
                    <span>Contract status</span>
                    <input
                      className="modal-input"
                      type="text"
                      value={editContractStatus}
                      onChange={(e) => setEditContractStatus(e.target.value)}
                      placeholder="Enter contract status"
                      disabled={isSaving}
                    />
                  </label>
                ) : null}
                <textarea
                  className="player-stats-textarea"
                  value={editPersonalNotes}
                  onChange={(e) => setEditPersonalNotes(e.target.value)}
                  rows={4}
                  placeholder="Write your notes about this player..."
                  disabled={isSaving}
                />
              </>
            )}
            <SectionEditActions
              onSave={handleSaveNotes}
              onCancel={handleCancelNotes}
              isSaving={isSaving}
              saveError={saveError}
            />
          </div>
        ) : (
          <div className="player-stats-notes-display">
            {isCustomPlayer ? (
              <div>
                <p><strong>Notes:</strong> {displayData?.notes || "N/A"}</p>
                <p><strong>Personal Notes:</strong> {personalNotes || "N/A"}</p>
                {effectiveOwnerId && displayData?.contractStatus ? (
                  <p><strong>Contract status:</strong> {displayData.contractStatus}</p>
                ) : null}
              </div>
            ) : (
              <div>
                {personalNotes ? <p>{personalNotes}</p> : (
                  <p className="muted">
                    {notesDisabled
                      ? "Create a league to add notes."
                      : effectiveOwnerId
                        ? "No personal notes yet. Click Edit to add notes."
                        : "No notes yet. Click Edit to add notes."}
                  </p>
                )}
                {effectiveOwnerId && displayData?.contractStatus ? (
                  <p><strong>Contract status:</strong> {displayData.contractStatus}</p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Player Details section ── */}
      <div className="player-stats-section">
        <div className="player-stats-section-head">
          <h3>Player Details</h3>
          {isCustomPlayer && !isEditingDetails && (
            <button
              className="btn btn-secondary player-stats-edit-btn"
              type="button"
              onClick={handleEditDetails}
              disabled={notesDisabled}
            >
              Edit
            </button>
          )}
        </div>

        {isEditingDetails && isCustomPlayer ? (
          <div className="player-stats-notes-editor">
            <div style={{ display: "grid", gap: "0.6rem" }}>
              <label className="modal-label">
                <span>Age</span>
                <input
                  className="modal-input"
                  type="number"
                  value={detailsDraft?.age ?? ""}
                  onChange={(e) => updateDetailsDraftField("age", e.target.value)}
                  disabled={isSaving}
                />
              </label>
              <label className="modal-label">
                <span>Height (inches)</span>
                <input
                  className="modal-input"
                  type="number"
                  value={detailsDraft?.height ?? ""}
                  onChange={(e) => updateDetailsDraftField("height", e.target.value)}
                  disabled={isSaving}
                  placeholder={`e.g. 73 for 6'1"`}
                />
              </label>
              <label className="modal-label">
                <span>Weight (lb)</span>
                <input
                  className="modal-input"
                  type="number"
                  value={detailsDraft?.weight ?? ""}
                  onChange={(e) => updateDetailsDraftField("weight", e.target.value)}
                  disabled={isSaving}
                />
              </label>
              <label className="modal-label">
                <span>Injury Status</span>
                <input
                  className="modal-input"
                  type="text"
                  value={detailsDraft?.injuryStatus ?? ""}
                  onChange={(e) => updateDetailsDraftField("injuryStatus", e.target.value)}
                  disabled={isSaving}
                />
              </label>
              <label className="modal-label">
                <span>Latest News</span>
                <textarea
                  className="player-stats-textarea"
                  value={detailsDraft?.latestNews ?? ""}
                  onChange={(e) => updateDetailsDraftField("latestNews", e.target.value)}
                  rows={2}
                  disabled={isSaving}
                />
              </label>
            </div>
            <SectionEditActions
              onSave={handleSaveDetails}
              onCancel={handleCancelDetails}
              isSaving={isSaving}
              saveError={saveError}
            />
          </div>
        ) : (
          <dl className="player-stats-details">
            {playerDetails.map((detail) => (
              <div className="player-stats-detail-row" key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{formatDetailValue(detail.value, detail.fallback)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* ── Batting Stats section ── */}
      <div className="player-stats-section">
        <div className="player-stats-section-head">
          <h3>Batting Stats</h3>
          {isCustomPlayer && !isEditingStats && (
            <button
              className="btn btn-secondary player-stats-edit-btn"
              type="button"
              onClick={handleEditStats}
              disabled={notesDisabled}
            >
              Edit
            </button>
          )}
        </div>

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
                    {isCustomPlayer && isEditingStats ? (
                      <input
                        className="modal-input"
                        type="number"
                        value={statsDraft?.currentStats?.[stat.key] ?? 0}
                        onChange={(e) =>
                          updateStatsDraftBlock("currentStats", stat.key, e.target.value)
                        }
                        disabled={isSaving}
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

        {isEditingStats && isCustomPlayer && (
          <SectionEditActions
            onSave={handleSaveStats}
            onCancel={handleCancelStats}
            isSaving={isSaving}
            saveError={saveError}
          />
        )}
      </div>

      {!isCustomPlayer && teamDepthChart && teamDepthChart.length > 0 && (
        <div className="player-stats-section">
          <h3>Team Depth Chart</h3>
          <p className="muted depth-chart-team-label">{displayData?.team}</p>
          <div className="depth-chart-positions">
            {teamDepthChart.map(({ position, players: posPlayers }) => (
              <div key={position} className="depth-chart-position-group">
                <div className="depth-chart-position-label">{position}</div>
                <ol className="depth-chart-player-list">
                  {posPlayers.map((p, idx) => (
                    <li
                      key={`${p.name}-${idx}`}
                      className={`depth-chart-player-row${p.isSelected ? " depth-chart-player-selected" : ""}`}
                    >
                      <span className="depth-chart-player-name">{p.name}</span>
                      {p.role ? <span className="depth-chart-role">{p.role}</span> : null}
                      {p.section ? <span className="depth-chart-section">{p.section}</span> : null}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}
      <EditContractModal
        open={showEditContractModal}
        player={player}
        playerDoc={playerDoc}
        onClose={() => setShowEditContractModal(false)}
        onSaved={handleSaveContract}
      />
    </aside>
  );
}

export default PlayerStatsPanel;
