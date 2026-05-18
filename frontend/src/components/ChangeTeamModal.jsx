import { useEffect, useMemo, useRef, useState } from "react";
import {
  dropCustomPlayer,
  dropPlayer,
  draftCustomPlayer,
  draftPlayer,
} from "../leagues/requests";
import {
  SLOT_DEFS,
  parseEligiblePositions,
  getEligibleSlotKeySet,
} from "../leagues/rosterSlots";

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function ChangeTeamModal({
  open,
  player,
  playerDoc,
  league,
  activeLeagueId,
  isCustom = false,
  onClose,
  onTeamChanged,
}) {
  const overlayRef = useRef(null);
  const [draftedToRosterId, setDraftedToRosterId] = useState("");
  const [slotKey, setSlotKey] = useState("");
  const [positionOverrideEnabled, setPositionOverrideEnabled] = useState(false);
  const [inactiveOverrideAccepted, setInactiveOverrideAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const rosters = useMemo(
    () => (Array.isArray(league?.rosterIds) ? league.rosterIds : []),
    [league?.rosterIds]
  );

  const currentRosterId = String(playerDoc?.ownerId || "");

  const eligibleRosters = useMemo(
    () =>
      rosters.filter(
        (r) =>
          String(r._id) !== currentRosterId &&
          SLOT_DEFS.some(({ key }) => !r[key])
      ),
    [rosters, currentRosterId]
  );

  const activeRoster = useMemo(
    () => rosters.find((r) => String(r._id) === String(draftedToRosterId)) || null,
    [rosters, draftedToRosterId]
  );

  const openSlots = useMemo(() => {
    if (!activeRoster) return [];
    return SLOT_DEFS.filter((slot) => !activeRoster[slot.key]);
  }, [activeRoster]);

  const openSlotsRemaining = openSlots.length;
  const budgetLeft = Number(activeRoster?.budgetLeft ?? 0);
  const originalPrice = Number(player?.price ?? 0);
  const maxAffordable = budgetLeft - Math.max(openSlotsRemaining - 1, 0);
  const budgetIsValid = !activeRoster || originalPrice <= maxAffordable;

  const eligiblePositionTokens = useMemo(
    () => parseEligiblePositions(player?.positions || playerDoc?.positions),
    [player?.positions, playerDoc?.positions]
  );
  const eligibleSlotKeySet = useMemo(
    () => getEligibleSlotKeySet(eligiblePositionTokens),
    [eligiblePositionTokens]
  );

  const eligibleOpenSlots = useMemo(
    () => openSlots.filter((slot) => eligibleSlotKeySet.has(slot.key)),
    [openSlots, eligibleSlotKeySet]
  );

  const displayedSlots = useMemo(
    () => (positionOverrideEnabled ? openSlots : eligibleOpenSlots),
    [positionOverrideEnabled, openSlots, eligibleOpenSlots]
  );

  const normalizedStatus = normalizeStatus(player?.status);
  const requiresInactiveOverride = normalizedStatus !== "active";
  const playerActionId = isCustom ? player?._id : player?.APIplayerId;

  // Initialize state when modal opens
  useEffect(() => {
    if (!open) return;
    setDraftedToRosterId(String(eligibleRosters[0]?._id || ""));
    setSlotKey("");
    setPositionOverrideEnabled(false);
    setInactiveOverrideAccepted(false);
    setError("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, player?.APIplayerId, player?._id]);

  // Auto-select first slot when displayed slots change
  useEffect(() => {
    if (!displayedSlots.some((slot) => slot.key === slotKey)) {
      setSlotKey(displayedSlots[0]?.key || "");
    }
  }, [displayedSlots, slotKey]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit =
    Boolean(playerActionId) &&
    Boolean(activeLeagueId) &&
    Boolean(draftedToRosterId) &&
    Boolean(slotKey) &&
    budgetIsValid &&
    (!requiresInactiveOverride || inactiveOverrideAccepted) &&
    !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError("");
    try {
      const dropFn = isCustom ? dropCustomPlayer : dropPlayer;
      const draftFn = isCustom ? draftCustomPlayer : draftPlayer;
      await dropFn(playerActionId, { leagueId: activeLeagueId, rosterId: currentRosterId });
      await draftFn(playerActionId, {
        leagueId: activeLeagueId,
        bidStartedById: draftedToRosterId,
        draftedToRosterId,
        slotKey,
        draftCost: originalPrice,
        inactiveOverrideAccepted,
        contractStatus: playerDoc?.contractStatus || "",
      });
      await onTeamChanged?.();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to change team.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOverlayClick(event) {
    if (event.target === overlayRef.current) onClose();
  }

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-panel card draft-modal-panel">
        <div className="modal-header">
          <h2>Change Team: {player?.name || "Player"}</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {eligibleRosters.length === 0 ? (
          <p className="muted" style={{ padding: "1rem" }}>
            No teams with open positions available. All other teams are full.
          </p>
        ) : (
          <div className="draft-modal-grid">
            <div className="modal-fields">
              <label className="modal-label">
                <span>Draft To Team</span>
                <select
                  className="modal-select"
                  value={draftedToRosterId}
                  onChange={(e) => {
                    setDraftedToRosterId(e.target.value);
                    setPositionOverrideEnabled(false);
                    setSlotKey("");
                  }}
                >
                  {eligibleRosters.map((roster) => (
                    <option key={roster._id} value={roster._id}>
                      {roster.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="modal-label">
                <span>Roster Slot</span>
                <select
                  className="modal-select"
                  value={slotKey}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    if (nextValue === "__override__") {
                      setPositionOverrideEnabled(true);
                      return;
                    }
                    setSlotKey(nextValue);
                  }}
                  disabled={openSlots.length === 0}
                >
                  {displayedSlots.map((slot) => (
                    <option key={slot.key} value={slot.key}>
                      {slot.label}
                    </option>
                  ))}
                  {!positionOverrideEnabled ? (
                    <>
                      <option disabled>──────────</option>
                      <option value="__override__">⚠ Override: Allow any open slot</option>
                    </>
                  ) : null}
                </select>
              </label>

              {!positionOverrideEnabled && eligibleOpenSlots.length === 0 && openSlots.length > 0 ? (
                <p className="muted">
                  No eligible slots available. Use override to continue.
                </p>
              ) : null}
              {openSlots.length === 0 ? (
                <p className="muted">No open slots on this team.</p>
              ) : null}

              {requiresInactiveOverride ? (
                <div className="draft-warning-box">
                  <p className="error">
                    This player is not currently active ({player?.status || "unknown status"}).
                  </p>
                  <label className="draft-checkbox">
                    <input
                      type="checkbox"
                      checked={inactiveOverrideAccepted}
                      onChange={(e) => setInactiveOverrideAccepted(e.target.checked)}
                    />
                    <span>I understand and want to continue drafting this non-active player.</span>
                  </label>
                </div>
              ) : null}

              <label className="modal-label">
                <span>Contract Status</span>
                <input
                  className="modal-input"
                  value={playerDoc?.contractStatus || ""}
                  readOnly
                  disabled
                />
              </label>

              <label className="modal-label">
                <span>Draft Cost</span>
                <input
                  className="modal-input"
                  type="number"
                  value={originalPrice}
                  readOnly
                  disabled
                />
              </label>
              <p className="muted">
                Budget left: ${budgetLeft} · Original price: ${originalPrice}
                {activeRoster && !budgetIsValid ? (
                  <span className="error"> · Team cannot afford this transfer</span>
                ) : null}
              </p>
            </div>

            <div className="draft-preview">
              <h3>{activeRoster?.name || "Roster Preview"}</h3>
              <table className="player-stats-table">
                <thead>
                  <tr>
                    <th>Slot</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {SLOT_DEFS.map((slot) => {
                    const rosterPlayer = activeRoster?.[slot.key];
                    return (
                      <tr key={slot.key}>
                        <td>{slot.label}</td>
                        <td>{rosterPlayer?.name || "Open Slot"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error ? <p className="error" style={{ padding: "0 1rem" }}>{error}</p> : null}

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          {eligibleRosters.length > 0 ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {isSubmitting ? "Changing Team..." : "Confirm"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ChangeTeamModal;
