import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const SLOT_DEFS = [
  { key: "catcher1", label: "C1" },
  { key: "catcher2", label: "C2" },
  { key: "firstBase", label: "1B" },
  { key: "secondBase", label: "2B" },
  { key: "thirdBase", label: "3B" },
  { key: "shortStop", label: "SS" },
  { key: "inField", label: "IF" },
  { key: "middleInField", label: "MIF" },
  { key: "utility", label: "UTIL" },
  { key: "outfielder1", label: "OF1" },
  { key: "outfielder2", label: "OF2" },
  { key: "outfielder3", label: "OF3" },
  { key: "outfielder4", label: "OF4" },
  { key: "outfielder5", label: "OF5" },
  { key: "pitcher1", label: "P1" },
  { key: "pitcher2", label: "P2" },
  { key: "pitcher3", label: "P3" },
  { key: "pitcher4", label: "P4" },
  { key: "pitcher5", label: "P5" },
  { key: "pitcher6", label: "P6" },
  { key: "pitcher7", label: "P7" },
  { key: "pitcher8", label: "P8" },
  { key: "pitcher9", label: "P9" },
];

const POS_TO_SLOT_KEYS = {
  C: ["catcher1", "catcher2", "utility"],
  "1B": ["firstBase", "inField", "utility"],
  "2B": ["secondBase", "middleInField", "inField", "utility"],
  "3B": ["thirdBase", "inField", "utility"],
  SS: ["shortStop", "middleInField", "inField", "utility"],
  IF: ["firstBase", "secondBase", "thirdBase", "shortStop", "inField", "middleInField", "utility"],
  MIF: ["secondBase", "shortStop", "middleInField", "inField", "utility"],
  MI: ["secondBase", "shortStop", "middleInField", "inField", "utility"],
  OF: ["outfielder1", "outfielder2", "outfielder3", "outfielder4", "outfielder5", "utility"],
  UTIL: ["utility"],
  UT: ["utility"],
  DH: ["utility"],
  P: ["pitcher1", "pitcher2", "pitcher3", "pitcher4", "pitcher5", "pitcher6", "pitcher7", "pitcher8", "pitcher9"],
  SP: ["pitcher1", "pitcher2", "pitcher3", "pitcher4", "pitcher5", "pitcher6", "pitcher7", "pitcher8", "pitcher9"],
  RP: ["pitcher1", "pitcher2", "pitcher3", "pitcher4", "pitcher5", "pitcher6", "pitcher7", "pitcher8", "pitcher9"],
};

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function parseEligiblePositions(raw) {
  return String(raw || "")
    .split(",")
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
}

function getEligibleSlotKeySet(positionTokens) {
  const eligibleKeys = new Set();
  positionTokens.forEach((token) => {
    const mapped = POS_TO_SLOT_KEYS[token];
    if (mapped) {
      mapped.forEach((key) => eligibleKeys.add(key));
    }
  });
  return eligibleKeys;
}

function DraftPlayerModal({ open, player, league, onClose, onDrafted }) {
  const overlayRef = useRef(null);
  const [bidStartedById, setBidStartedById] = useState("");
  const [draftedToRosterId, setDraftedToRosterId] = useState("");
  const [slotKey, setSlotKey] = useState("");
  const [draftCost, setDraftCost] = useState("");
  const [positionOverrideEnabled, setPositionOverrideEnabled] = useState(false);
  const [inactiveOverrideAccepted, setInactiveOverrideAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const rosters = Array.isArray(league?.rosterIds) ? league.rosterIds : [];
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

  useEffect(() => {
    if (!open) return;

    const defaultRosterId = rosters[0]?._id || "";
    setBidStartedById(defaultRosterId);
    setDraftedToRosterId(defaultRosterId);
    setSlotKey("");
    setPositionOverrideEnabled(false);
    setInactiveOverrideAccepted(false);
    setError("");
    const defaultCost = Number.isFinite(Number(player?.cost)) ? Number(player.cost) : 0;
    setDraftCost(String(defaultCost));
  }, [open, player?.APIplayerId, player?.cost, rosters]);

  useEffect(() => {
    if (!displayedSlots.some((slot) => slot.key === slotKey)) {
      setSlotKey(displayedSlots[0]?.key || "");
    }
  }, [displayedSlots, slotKey]);

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
    Boolean(player?.APIplayerId) &&
    Boolean(league?._id) &&
    Boolean(bidStartedById) &&
    Boolean(draftedToRosterId) &&
    Boolean(slotKey) &&
    draftCostIsValid &&
    (!requiresInactiveOverride || inactiveOverrideAccepted) &&
    !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/players/${player.APIplayerId}/draft`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league._id,
          bidStartedById,
          draftedToRosterId,
          slotKey,
          draftCost: numericDraftCost,
          inactiveOverrideAccepted,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.errorMessage || "Failed to draft player.");
      }
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
            </label>

            <label className="modal-label">
              <span>Drafted To Team</span>
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
            </label>

            <label className="modal-label">
              <span>Roster Slot</span>
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
