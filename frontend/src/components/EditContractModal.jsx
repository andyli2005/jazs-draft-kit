import { useEffect, useRef, useState } from "react";

function EditContractModal({ open, player, playerDoc, onClose, onSaved }) {
  const overlayRef = useRef(null);
  const [contractStatus, setContractStatus] = useState("");
  const [price, setPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setContractStatus(playerDoc?.contractStatus || "");
    setPrice(String(playerDoc?.price ?? player?.leaguePrice ?? 0));
    setError("");
  }, [open, playerDoc, player]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const numericPrice = Number(price);
  const priceIsValid = Number.isFinite(numericPrice) && numericPrice >= 0;
  const canSubmit = Boolean(contractStatus.trim()) && priceIsValid && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError("");
    try {
      await onSaved({ contractStatus: contractStatus.trim(), price: numericPrice });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save.");
      setIsSubmitting(false);
    }
  }

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-panel card">
        <div className="modal-header">
          <h2>Edit Contract: {player?.name || "Player"}</h2>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={isSubmitting}
          >
            &times;
          </button>
        </div>

        <div className="modal-fields">
          <label className="modal-label">
            <span>
              Contract Status{" "}
              <span style={{ color: "#e05252" }} aria-hidden="true">*</span>
            </span>
            <input
              className="modal-input"
              type="text"
              value={contractStatus}
              onChange={(e) => setContractStatus(e.target.value)}
              placeholder="e.g. 1-year, 2-year extension, arb…"
              disabled={isSubmitting}
              autoFocus
            />
          </label>

          <label className="modal-label">
            <span>Draft Price ($)</span>
            <input
              className="modal-input"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          {!priceIsValid && price !== "" && (
            <p className="error" style={{ marginTop: 0 }}>
              Draft price must be a non-negative number.
            </p>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditContractModal;
