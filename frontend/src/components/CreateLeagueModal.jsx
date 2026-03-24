import { useState, useEffect, useRef } from "react";
import "./CreateLeagueModal.css";

const LEAGUE_POSITIONS = {
  MLB: [
    { name: "Pitchers", count: 9 },
    { name: "1st Base", count: 1 },
    { name: "2nd Base", count: 1 },
    { name: "3rd Base", count: 1 },
    { name: "In Field", count: 1 },
    { name: "Short Stop", count: 1 },
    { name: "Outfielder", count: 5 },
    { name: "MIF", count: 1 },
    { name: "Utility", count: 1 },
  ],
  NFL: [
    { name: "QB", count: 1 },
    { name: "RB", count: 2 },
    { name: "WR", count: 2 },
    { name: "TE", count: 1 },
    { name: "Flex", count: 1 },
    { name: "K", count: 1 },
    { name: "DEF", count: 1 },
    { name: "Bench", count: 6 },
  ],
  NBA: [
    { name: "PG", count: 1 },
    { name: "SG", count: 1 },
    { name: "SF", count: 1 },
    { name: "PF", count: 1 },
    { name: "C", count: 1 },
    { name: "Guard", count: 1 },
    { name: "Forward", count: 1 },
    { name: "Utility", count: 2 },
    { name: "Bench", count: 3 },
  ],
};

const DRAFT_TYPES = ["Salary Cap", "Snake", "Linear"];

function CreateLeagueModal({ open, onClose }) {
  const [leagueType, setLeagueType] = useState("MLB");
  const [leagueName, setLeagueName] = useState("");
  const [draftType, setDraftType] = useState("Salary Cap");
  const [budgetCap, setBudgetCap] = useState(260);
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

  const positions = LEAGUE_POSITIONS[leagueType] || [];

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSave = () => {
    const leagueData = {
      leagueType,
      leagueName: leagueName.trim(),
      draftType,
      budgetCap: draftType === "Salary Cap" ? budgetCap : null,
      positions,
    };
    console.log("League data (frontend only):", leagueData);
    onClose();
  };

  const canSave = leagueName.trim().length > 0;

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
                value={leagueType}
                onChange={(e) => setLeagueType(e.target.value)}
              >
                {Object.keys(LEAGUE_POSITIONS).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="modal-label">
              <span>League Name</span>
              <input
                className="modal-input"
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
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

            {draftType === "Salary Cap" && (
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
            )}
          </div>

          <div className="modal-positions">
            <h3>Positions ({leagueType})</h3>
            <div className="positions-grid">
              {positions.map((pos) => (
                <div className="position-item" key={pos.name}>
                  <span className="position-name">{pos.name}</span>
                  <span className="position-count">x{pos.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateLeagueModal;
