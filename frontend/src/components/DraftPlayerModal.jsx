import { useEffect, useMemo, useRef, useState } from "react";
import { draftCustomPlayer, draftPlayer } from "../leagues/requests";
import {
  SLOT_DEFS,
  parseEligiblePositions,
  getEligibleSlotKeySet,
} from "../leagues/rosterSlots";


function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function DraftPlayerModal({
  open,
  player,
  league,
  onClose,
  onDrafted,
  isCustom = false,
  lockedRosterId = null,
  lockedSlotKey = null,
}) {
  const overlayRef = useRef(null);
  const [bidStartedById, setBidStartedById] = useState("");
  const [draftedToRosterId, setDraftedToRosterId] = useState("");
  const [slotKey, setSlotKey] = useState("");
  const [draftCost, setDraftCost] = useState("");
  const [positionOverrideEnabled, setPositionOverrideEnabled] = useState(false);
  const [inactiveOverrideAccepted, setInactiveOverrideAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [contractStatus, setContractStatus] = useState("");

  const isLocked = Boolean(lockedRosterId && lockedSlotKey);

  const rosters = useMemo(
    () => (Array.isArray(league?.rosterIds) ? league.rosterIds : []),
    [league?.rosterIds]
  );
  const activeRoster =
    rosters.find((roster) => String(roster?._id) === String(draftedToRosterId)) || null;

  const openSlots = useMemo(() => {
    if (!activeRoster) return [];
    return SLOT_DEFS.filter((slot) => !activeRoster[slot.key]);
  }, [activeRoster]);

  const openSlotsRemaining = openSlots.length;
  const budgetLeft = Number(activeRoster?.budgetLeft ?? 0);
  const maxLegalDraftCost = budgetLeft - Math.max(openSlotsRemaining - 1, 0);
  const numericDraftCost = Number(draftCost);
  const hasNumericDraftCost = Number.isFinite(numericDraftCost);
  const draftCostIsValid =
    hasNumericDraftCost &&
    numericDraftCost >= 0 &&
    numericDraftCost <= maxLegalDraftCost;

  const eligiblePositionTokens = parseEligiblePositions(player?.positions);
  const eligibleSlotKeySet = useMemo(
    () => getEligibleSlotKeySet(eligiblePositionTokens),
    [eligiblePositionTokens]
  );
  const eligibleOpenSlots = openSlots.filter((slot) => eligibleSlotKeySet.has(slot.key));
  const displayedSlots = positionOverrideEnabled ? openSlots : eligibleOpenSlots;

  const normalizedStatus = normalizeStatus(player?.status);
  const requiresInactiveOverride = normalizedStatus !== "active";
  const playerActionId = isCustom ? player?._id : player?.APIplayerId;

  useEffect(() => {
    if (!open) return;

    const defaultRosterId = lockedRosterId || rosters[0]?._id || "";
    setBidStartedById(defaultRosterId);
    setDraftedToRosterId(defaultRosterId);
    setSlotKey(lockedSlotKey || "");
    setPositionOverrideEnabled(false);
    setInactiveOverrideAccepted(false);
    setError("");
    setContractStatus("");
    const defaultCost = Number.isFinite(Number(player?.cost)) ? Number(player.cost) : 0;
    setDraftCost(String(defaultCost));
  }, [open, player?.APIplayerId, player?._id, player?.cost, rosters, lockedRosterId, lockedSlotKey]);

  // When not locked, auto-pick first eligible slot whenever the displayed slots change.
  useEffect(() => {
    if (isLocked) return;
    if (!displayedSlots.some((slot) => slot.key === slotKey)) {
      setSlotKey(displayedSlots[0]?.key || "");
    }
  }, [displayedSlots, slotKey, isLocked]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit =
    Boolean(playerActionId) &&
    Boolean(league?._id) &&
    Boolean(bidStartedById) &&
    Boolean(draftedToRosterId) &&
    Boolean(slotKey) &&
    draftCostIsValid &&
    Boolean(contractStatus.trim()) &&
    (!requiresInactiveOverride || inactiveOverrideAccepted) &&
    !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError("");
    try {
      const requestFn = isCustom ? draftCustomPlayer : draftPlayer;
      const data = await requestFn(playerActionId, {
        leagueId: league._id,
        bidStartedById,
        draftedToRosterId,
        slotKey,
        draftCost: numericDraftCost,
        inactiveOverrideAccepted,
        contractStatus,
      });
      await onDrafted?.(data);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to draft player.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOverlayClick(event) {
    if (event.target === overlayRef.current) {
      onClose();
    }
  }

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-panel card draft-modal-panel">
        <div className="modal-header">
          <h2>Now Drafting: {player?.name || "Player"}</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="draft-modal-grid">
          <div className="modal-fields">
            <label className="modal-label">
              <span>Bid Started By</span>
              {isLocked ? (
                <input
                  className="modal-input"
                  value={activeRoster?.name || ""}
                  readOnly
                  disabled
                />
              ) : (
                <select
                  className="modal-select"
                  value={bidStartedById}
                  onChange={(event) => setBidStartedById(event.target.value)}
                >
                  {rosters.map((roster) => (
                    <option key={roster._id} value={roster._id}>
                      {roster.name}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="modal-label">
              <span>Drafted To Team</span>
              {isLocked ? (
                <input
                  className="modal-input"
                  value={activeRoster?.name || ""}
                  readOnly
                  disabled
                />
              ) : (
                <select
                  className="modal-select"
                  value={draftedToRosterId}
                  onChange={(event) => setDraftedToRosterId(event.target.value)}
                >
                  {rosters.map((roster) => (
                    <option key={roster._id} value={roster._id}>
                      {roster.name}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="modal-label">
              <span>Roster Slot</span>
              {isLocked ? (
                <input
                  className="modal-input"
                  value={SLOT_DEFS.find((s) => s.key === lockedSlotKey)?.label || lockedSlotKey || ""}
                  readOnly
                  disabled
                />
              ) : (
                <select
                  className="modal-select"
                  value={slotKey}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue === "__override__") {
                      setPositionOverrideEnabled(true);
                      return;
                    }
                    setSlotKey(nextValue);
                  }}
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
              )}
            </label>

            {requiresInactiveOverride ? (
              <div className="draft-warning-box">
                <p className="error">
                  This player is not currently active ({player?.status || "unknown status"}).
                </p>
                <label className="draft-checkbox">
                  <input
                    type="checkbox"
                    checked={inactiveOverrideAccepted}
                    onChange={(event) => setInactiveOverrideAccepted(event.target.checked)}
                  />
                  <span>I understand and want to continue drafting this non-active player.</span>
                </label>
              </div>
            ) : null}

            <label className="modal-label">
              <span>Contract status <span className="required-asterisk">*</span></span>
              <input
                className="modal-input"
                type="text"
                value={contractStatus}
                onChange={(event) => setContractStatus(event.target.value)}
                placeholder="Enter contract status"
                required
              />
            </label>

            <label className="modal-label">
              <span>Draft Cost</span>
              <input
                className="modal-input"
                type="number"
                min={0}
                value={draftCost}
                onChange={(event) => setDraftCost(event.target.value)}
              />
            </label>
            <p className="muted">
              Budget left: ${budgetLeft} · Max legal bid: ${Math.max(maxLegalDraftCost, 0)}
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

        {error ? <p className="error">{error}</p> : null}

        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? "Drafting..." : "Confirm Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DraftPlayerModal;
