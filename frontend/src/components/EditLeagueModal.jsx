import { useEffect, useMemo, useRef, useState } from "react";
import { useLeague } from "../leagues";
import "./EditLeagueModal.css";

const DEFAULT_TEAM_PREFIX = "Team";

function normalizeRosters(league) {
  const rosterIds = Array.isArray(league?.rosterIds) ? league.rosterIds : [];
  return rosterIds.map((roster) => ({
    id: String(roster?._id || ""),
    name: String(roster?.name || "").trim(),
    isNew: false,
  }));
}

function getNextTeamName(existingNames) {
  let idx = 1;
  while (existingNames.has(`${DEFAULT_TEAM_PREFIX} ${idx}`)) {
    idx += 1;
  }
  return `${DEFAULT_TEAM_PREFIX} ${idx}`;
}

function EditLeagueModal({ open, league, onClose, onSaved }) {
  const { editLeague } = useLeague();
  const overlayRef = useRef(null);
  const [name, setName] = useState("");
  const [budgetCap, setBudgetCap] = useState(260);
  const [teams, setTeams] = useState([]);
  const [teamsToDelete, setTeamsToDelete] = useState([]);
  const [editingTeamId, setEditingTeamId] = useState("");
  const [addTeamCount, setAddTeamCount] = useState(1);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setName(String(league?.name || ""));
    setBudgetCap(Number(league?.budgetCap ?? 260));
    setTeams(normalizeRosters(league));
    setTeamsToDelete([]);
    setEditingTeamId("");
    setAddTeamCount(1);
    setError("");
    setIsSaving(false);
  }, [open, league]);

  const activeTeams = useMemo(() => teams, [teams]);
  const canSave =
    !isSaving &&
    name.trim().length > 0 &&
    Number.isFinite(Number(budgetCap)) &&
    Number(budgetCap) >= 1 &&
    activeTeams.length > 0 &&
    activeTeams.every((team) => String(team.name || "").trim().length > 0);

  if (!open) return null;

  const handleOverlayClick = (event) => {
    if (event.target === overlayRef.current) {
      onClose();
    }
  };

  const handleAddTeams = () => {
    setError("");
    const numericAddCount = Number(addTeamCount);
    if (!Number.isInteger(numericAddCount) || numericAddCount <= 0) {
      setError("Add Team count must be a positive integer.");
      return;
    }

    const usedNames = new Set(activeTeams.map((team) => String(team.name || "").trim()));
    const newTeams = [];
    for (let index = 0; index < numericAddCount; index += 1) {
      const nextName = getNextTeamName(usedNames);
      usedNames.add(nextName);
      newTeams.push({
        id: `new-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        name: nextName,
        isNew: true,
      });
    }
    setTeams((prev) => [...prev, ...newTeams]);
  };

  const handleDeleteTeam = (team) => {
    const didConfirm = window.confirm(`Delete ${team.name || "this team"} from the league?`);
    if (!didConfirm) return;

    setError("");
    setTeams((prev) => prev.filter((candidate) => candidate.id !== team.id));
    if (!team.isNew) {
      setTeamsToDelete((prev) => (prev.includes(team.id) ? prev : [...prev, team.id]));
    }
    if (editingTeamId === team.id) {
      setEditingTeamId("");
    }
  };

  const handleTeamRenameChange = (teamId, nextName) => {
    setTeams((prev) =>
      prev.map((team) => (team.id === teamId ? { ...team, name: nextName } : team))
    );
  };

  const handleRenameButton = (teamId) => {
    setEditingTeamId(teamId);
  };

  const buildPayload = () => {
    const trimmedName = name.trim();
    const parsedBudget = Number(budgetCap);
    const originalRosters = normalizeRosters(league);
    const originalNameById = new Map(originalRosters.map((roster) => [roster.id, roster.name]));

    const existingTeams = activeTeams.filter((team) => !team.isNew);
    const newTeams = activeTeams.filter((team) => team.isNew);

    const teamRenames = {};
    existingTeams.forEach((team) => {
      const nextName = String(team.name || "").trim();
      const previousName = String(originalNameById.get(team.id) || "").trim();
      if (nextName !== previousName) {
        teamRenames[team.id] = nextName;
      }
    });

    return {
      name: trimmedName,
      budgetCap: parsedBudget,
      teamRenames,
      teamsToDelete,
      teamsToAdd: newTeams.length,
    };
  };

  const handleSave = async () => {
    setError("");
    if (!canSave) {
      setError("Please complete all required league and team fields before saving.");
      return;
    }

    const payload = buildPayload();
    setIsSaving(true);
    try {
      await editLeague(league?._id, payload);
      if (onSaved) {
        await onSaved();
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to edit league.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-panel card edit-league-modal-panel">
        <div className="modal-header">
          <h2>Edit League</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="edit-league-body">
          <div className="modal-fields">
            <label className="modal-label">
              <span>League Name</span>
              <input
                className="modal-input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter league name"
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
                  onChange={(event) => setBudgetCap(event.target.value)}
                />
              </div>
            </label>
          </div>

          <div className="edit-teams-panel">
            <div className="edit-teams-header">
              <h3>Teams</h3>
              <div className="add-team-controls">
                <input
                  className="modal-input add-team-count-input"
                  type="number"
                  min={1}
                  value={addTeamCount}
                  onChange={(event) => setAddTeamCount(event.target.value)}
                />
                <button className="btn btn-secondary" type="button" onClick={handleAddTeams}>
                  Add Team
                </button>
              </div>
            </div>

            <div className="team-list">
              {activeTeams.length === 0 ? (
                <p className="muted">No teams in this league.</p>
              ) : (
                activeTeams.map((team) => {
                  const isEditing = editingTeamId === team.id;
                  return (
                    <div className="team-row" key={team.id}>
                      {isEditing ? (
                        <input
                          className="modal-input team-name-input"
                          type="text"
                          autoFocus
                          value={team.name}
                          onChange={(event) => handleTeamRenameChange(team.id, event.target.value)}
                          onBlur={() => setEditingTeamId("")}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              setEditingTeamId("");
                            }
                            if (event.key === "Escape") {
                              setEditingTeamId("");
                            }
                          }}
                        />
                      ) : (
                        <button
                          className="team-name-text-button"
                          type="button"
                          onDoubleClick={() => setEditingTeamId(team.id)}
                          title="Double-click to rename"
                        >
                          {team.name}
                        </button>
                      )}

                      <div className="team-row-actions">
                        <button
                          className="btn btn-secondary team-action-btn"
                          type="button"
                          onClick={() => handleRenameButton(team.id)}
                        >
                          Name Change
                        </button>
                        <button
                          className="btn btn-secondary team-action-btn team-delete-btn"
                          type="button"
                          onClick={() => handleDeleteTeam(team)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="btn btn-primary" type="button" onClick={handleSave} disabled={!canSave}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditLeagueModal;
