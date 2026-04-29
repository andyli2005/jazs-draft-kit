import { useEffect, useMemo, useRef, useState } from "react";
import { moveCustomPlayer, movePlayer } from "../leagues/requests";
import {
  SLOT_DEFS,
  parseEligiblePositions,
  getEligibleSlotKeySet,
} from "../leagues/rosterSlots";

function ChangePositionMenu({
  player,
  playerDoc,
  isCustom = false,
  league,
  activeLeagueId,
  onMoved,
  onClose,
}) {
  const menuRef = useRef(null);
  const [slotKey, setSlotKey] = useState("");
  const [positionOverrideEnabled, setPositionOverrideEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const rosters = useMemo(
    () => (Array.isArray(league?.rosterIds) ? league.rosterIds : []),
    [league?.rosterIds]
  );

  const activeRoster = useMemo(
    () =>
      rosters.find(
        (roster) => String(roster?._id) === String(playerDoc?.ownerId || "")
      ) || null,
    [rosters, playerDoc?.ownerId]
  );

  const currentSlot = useMemo(
    () =>
      SLOT_DEFS.find(
        (slot) => {
          const rosterPlayer = activeRoster?.[slot.key];
          if (!rosterPlayer) return false;
          if (isCustom) {
            return String(rosterPlayer?._id || "") === String(player?._id || "");
          }
          return String(rosterPlayer?.APIplayerId || "") === String(player?.APIplayerId || "");
        }
      ) || null,
    [activeRoster, isCustom, player?._id, player?.APIplayerId]
  );

  const openSlots = useMemo(() => {
    if (!activeRoster) return [];
    return SLOT_DEFS.filter((slot) => !activeRoster[slot.key]);
  }, [activeRoster]);

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

  useEffect(() => {
    if (!slotKey || !displayedSlots.some((slot) => slot.key === slotKey)) {
      setSlotKey(displayedSlots[0]?.key || "");
    }
  }, [displayedSlots, slotKey]);

  useEffect(() => {
    function handleDocumentClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose?.();
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [onClose]);

  const canSubmit =
    Boolean(activeLeagueId) &&
    Boolean(isCustom ? player?._id : player?.APIplayerId) &&
    Boolean(activeRoster?._id) &&
    Boolean(currentSlot?.key) &&
    Boolean(slotKey) &&
    !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError("");

    try {
      const requestFn = isCustom ? moveCustomPlayer : movePlayer;
      const playerActionId = isCustom ? player._id : player.APIplayerId;
      await requestFn(playerActionId, {
        leagueId: activeLeagueId,
        rosterId: activeRoster._id,
        newSlotKey: slotKey,
      });
      await onMoved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Failed to change position.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="change-position-menu" ref={menuRef}>
      <p className="change-position-menu-title">Change Position</p>

      <label className="modal-label">
        <span>Current Slot</span>
        <input
          className="modal-input"
          value={currentSlot?.label || "Unknown"}
          disabled
          readOnly
        />
      </label>

      <label className="modal-label">
        <span>New Slot</span>
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
          disabled={isSubmitting || displayedSlots.length === 0}
        >
          {displayedSlots.map((slot) => (
            <option key={slot.key} value={slot.key}>
              {slot.label}
            </option>
          ))}
          {!positionOverrideEnabled ? (
            <>
              <option disabled>----------</option>
              <option value="__override__">Override: Allow any open slot</option>
            </>
          ) : null}
        </select>
      </label>

      {!positionOverrideEnabled && eligibleOpenSlots.length === 0 && openSlots.length > 0 ? (
        <p className="muted">
          No eligible slots available. Free desired position or use override to continue.
        </p>
      ) : null}
      {openSlots.length === 0 ? (
        <p className="muted">No slots available. Free desired position.</p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="change-position-menu-actions">
        <button
          className="btn btn-secondary player-stats-edit-btn"
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          className="btn btn-primary player-stats-edit-btn"
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? "Confirming..." : "Confirm"}
        </button>
      </div>
    </div>
  );
}

export default ChangePositionMenu;
