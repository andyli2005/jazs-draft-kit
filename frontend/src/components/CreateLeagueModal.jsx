import { useState, useEffect, useRef } from "react";
import { createLeague } from "../auth/requests";
import "./CreateLeagueModal.css";

const MLB_POSITIONS = [
  { name: "Catchers", count: 2 },
  { name: "1st Base", count: 1 },
  { name: "2nd Base", count: 1 },
  { name: "3rd Base", count: 1 },
  { name: "Short Stop", count: 1 },
  { name: "In Field", count: 1 },
  { name: "MIF", count: 1 },
  { name: "Utility", count: 1 },
  { name: "Pitchers", count: 9 },
  { name: "Outfielders", count: 5 },
];

const DRAFT_TYPES = ["Salary Cap", "Snake", "Linear"];

function CreateLeagueModal({ open, onClose }) {
  const [name, setName] = useState("");
  const [draftType, setDraftType] = useState("Salary Cap");
  const [teamCount, setTeamCount] = useState(12);
  const [budgetCap, setBudgetCap] = useState(260);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSave = async () => {
    setError("");
    setIsSaving(true);
    try {
      await createLeague({
        sport: "MLB",
        name: name.trim(),
        draftType,
        teamCount,
        budgetCap,
      });
      setName("");
      setDraftType("Salary Cap");
      setTeamCount(12);
      setBudgetCap(260);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create league.");
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = name.trim().length > 0 && teamCount >= 2 && !isSaving;

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-panel card">
        <div className="modal-header">
          <h2>Customize Your League</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-fields">
            <label className="modal-label">
              <span>League Type</span>
              <select
                className="modal-select"
                value="MLB"
                onChange={() => {}}
              >
                <option value="MLB">MLB</option>
                <option value="NFL" disabled>NFL (coming soon)</option>
                <option value="NBA" disabled>NBA (coming soon)</option>
              </select>
            </label>

            <label className="modal-label">
              <span>League Name</span>
              <input
                className="modal-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter league name"
              />
            </label>

            <label className="modal-label">
              <span>Draft Type</span>
              <select
                className="modal-select"
                value={draftType}
                onChange={(e) => setDraftType(e.target.value)}
              >
                {DRAFT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="modal-label">
              <span>Team Count</span>
              <input
                className="modal-input"
                type="number"
                min={2}
                value={teamCount}
                onChange={(e) => setTeamCount(Number(e.target.value))}
              />
            </label>

            <label className="modal-label">
              <span>Budget Cap</span>
              <div className="modal-budget-input">
                <span className="budget-prefix">$</span>
                <input
                  className="modal-input budget-field"
                  type="number"
                  min={1}
                  value={budgetCap}
                  onChange={(e) => setBudgetCap(Number(e.target.value))}
                />
              </div>
            </label>
          </div>

          <div className="modal-positions">
            <h3>Positions (MLB)</h3>
            <div className="positions-grid">
              {MLB_POSITIONS.map((pos) => (
                <div className="position-item" key={pos.name}>
                  <span className="position-name">{pos.name}</span>
                  <span className="position-count">x{pos.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateLeagueModal;
