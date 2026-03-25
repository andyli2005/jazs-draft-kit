import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

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

function PlayerStatsPanel({ player, fantasyPoints, cost, activeLeagueId, onClose }) {
  const [personalNotes, setPersonalNotes] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!player?.APIplayerId || !activeLeagueId) {
      setPersonalNotes("");
      setIsEditing(false);
      return;
    }

    let isMounted = true;
    async function fetchPlayerDoc() {
      try {
        const res = await fetch(
          `${API_BASE}/api/players/${player.APIplayerId}/doc?leagueId=${activeLeagueId}`,
          { method: "GET", credentials: "include" }
        );
        const data = await res.json();
        if (!isMounted) return;
        if (data.playerDoc && data.playerDoc.personalNotes) {
          setPersonalNotes(data.playerDoc.personalNotes);
        } else {
          setPersonalNotes("");
        }
      } catch {
        if (isMounted) setPersonalNotes("");
      }
    }

    setIsEditing(false);
    setSaveError("");
    fetchPlayerDoc();
    return () => { isMounted = false; };
  }, [player?.APIplayerId, activeLeagueId]);

  function handleEdit() {
    setEditDraft(personalNotes);
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
      const res = await fetch(
        `${API_BASE}/api/players/${player.APIplayerId}/doc`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leagueId: activeLeagueId,
            personalNotes: editDraft,
            name: player.name,
            status: player.status || "Active",
            notes: player.status || "",
            positions: player.positions || "",
            team: player.team || "",
            pictureURL: player.pictureURL || "",
            price: 0,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.errorMessage || "Failed to save notes.");
      }
      setPersonalNotes(data.playerDoc.personalNotes);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err.message || "Failed to save notes.");
    } finally {
      setIsSaving(false);
    }
  }

  const notesDisabled = !activeLeagueId;

  return (
    <aside className="player-stats-panel">
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
        {player.pictureURL ? (
          <img
            src={player.pictureURL}
            alt={player.name}
            className="player-stats-photo"
          />
        ) : (
          <div className="player-stats-photo-placeholder">No Photo</div>
        )}
      </div>

      <h2 className="player-stats-name">{player.name || "Unknown Player"}</h2>

      <div className="player-stats-meta">
        {player.positions && (
          <span className="player-stats-badge">{player.positions}</span>
        )}
        {player.team && (
          <span className="player-stats-badge">{player.team}</span>
        )}
        {player.status && (
          <span className="player-stats-badge badge-outline">{player.status}</span>
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
        <h3>Depth Chart Status</h3>
        <ul className="player-stats-list">
          <li className="muted">Depth chart data not available.</li>
        </ul>
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
                  <td>{player[stat.key] != null ? player[stat.key] : "---"}</td>
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
