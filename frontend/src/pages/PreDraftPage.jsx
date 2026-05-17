import { useMemo, useState } from "react";
import Header from "../components/Header";
import PlayerSearchModal from "../components/PlayerSearchModal";
import PlayerStatsPanel from "../components/PlayerStatsPanel";
import Sidebar from "../components/Sidebar";
import { useLeague } from "../leagues";
import { importLeagueData } from "../leagues/requests";
import { SLOT_DEFS } from "../leagues/rosterSlots";
import "./AllTeamsPage.css";

function playerLabel(player) {
  if (!player) return null;
  const bits = [player.name, player.team].filter(Boolean);
  return bits.length > 0 ? bits.join(" • ") : "Rostered Player";
}

function PreDraftPage() {
  const { leagues, selectedLeagueId, refreshLeagues } = useLeague();

  const [searchModal, setSearchModal] = useState(null);
  const [panelInfo, setPanelInfo] = useState(null);
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);

  const [showPicker, setShowPicker] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");

  const activeLeague = useMemo(
    () => leagues.find((league) => league._id === selectedLeagueId) || null,
    [leagues, selectedLeagueId]
  );

  const otherLeagues = useMemo(
    () => leagues.filter((l) => l._id !== selectedLeagueId),
    [leagues, selectedLeagueId]
  );

  const selectedSourceName = useMemo(
    () => leagues.find((l) => l._id === selectedSourceId)?.name || "",
    [leagues, selectedSourceId]
  );

  async function handleSourceChange(e) {
    const sourceId = e.target.value;
    if (!sourceId) return;
    setSelectedSourceId(sourceId);
    setIsImporting(true);
    setImportError("");
    try {
      await importLeagueData(selectedLeagueId, sourceId);
      await refreshLeagues();
    } catch (err) {
      setImportError(err?.message || "Import failed. Please try again.");
    } finally {
      setIsImporting(false);
    }
  }

  const rosters = Array.isArray(activeLeague?.rosterIds) ? activeLeague.rosterIds : [];

  function openSearch(rosterId, slotKey) {
    setPanelInfo(null);
    setSearchModal({ rosterId, slotKey });
  }

  function openPanel(player, rosterId) {
    setSearchModal(null);
    setPanelInfo({ player, rosterId });
  }

  async function handleDrafted() {
    await refreshLeagues();
    setPanelRefreshKey((prev) => prev + 1);
  }

  const panelPlayer = panelInfo?.player || null;

  return (
    <main className="app-shell page-private">
      <Header />
      <div className={`app-body${panelPlayer ? " app-body-with-panel" : ""}`}>
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">Pre-draft</p>
          <h1>Pre-draft Setup</h1>
          <p className="muted" style={{ maxWidth: "680px" }}>
            You may input pre-draft roster information below. Leave it blank to start a fresh
            league, or use the button below to import information from a previous league.
          </p>
          <div style={{ marginTop: "0.75rem" }}>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setShowPicker((prev) => !prev)}
            >
              {showPicker ? "Hide Previous Leagues" : "Use Information From Previous Leagues"}
            </button>

            {showPicker && (
              <div className="predraft-source-row">
                <select
                  className="my-team-select"
                  value={selectedSourceId}
                  disabled={isImporting}
                  onChange={handleSourceChange}
                >
                  <option value="">-- Select a previous league --</option>
                  {otherLeagues.length === 0 ? (
                    <option value="" disabled>No other leagues available</option>
                  ) : (
                    otherLeagues.map((league) => (
                      <option key={league._id} value={league._id}>
                        {league.name}
                      </option>
                    ))
                  )}
                </select>

                {isImporting && (
                  <span className="muted">Importing...</span>
                )}
                {!isImporting && importError && (
                  <span className="predraft-source-error">{importError}</span>
                )}
                {!isImporting && !importError && selectedSourceName && (
                  <span className="muted">
                    Imported from: <strong>{selectedSourceName}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          <hr className="predraft-divider" />

          {!activeLeague ? (
            <p className="muted">Select a league to configure pre-draft rosters.</p>
          ) : null}

          {activeLeague ? (
            <div className="roster-board-wrap">
              <div className="roster-board">
                {rosters.map((roster, index) => (
                  <article
                    className="roster-column"
                    key={roster._id || `${roster.name}-${index}`}
                  >
                    <div className="roster-column-head">
                      <h2>{roster.name || `Team ${index + 1}`}</h2>
                      <p className="muted">Budget Left: ${roster.budgetLeft ?? activeLeague.budgetCap}</p>
                    </div>

                    <div className="roster-slot-list">
                      {SLOT_DEFS.map((slot) => {
                        const player = roster[slot.key];
                        const isSelected =
                          panelPlayer &&
                          (panelPlayer.APIplayerId
                            ? panelPlayer.APIplayerId === player?.APIplayerId
                            : panelPlayer._id && String(panelPlayer._id) === String(player?._id)) &&
                          panelInfo?.rosterId === String(roster._id);

                        return (
                          <div
                            className={`roster-slot-card${isSelected ? " roster-slot-card-selected" : ""}`}
                            key={slot.key}
                          >
                            <span className="roster-slot-label">{slot.label}</span>
                            <div className="roster-slot-content">
                              {player ? (
                                <button
                                  className="roster-player-button"
                                  type="button"
                                  onClick={() => openPanel(player, String(roster._id))}
                                >
                                  <strong>{playerLabel(player)}</strong>
                                  <span className="muted">{player.positions || "Rostered"}</span>
                                </button>
                              ) : (
                                <>
                                  <strong className="predraft-empty-slot">Empty</strong>
                                  <button
                                    className="btn btn-sm btn-secondary predraft-add-btn"
                                    type="button"
                                    onClick={() => openSearch(String(roster._id), slot.key)}
                                  >
                                    + Add
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {panelPlayer ? (
          <PlayerStatsPanel
            player={panelPlayer}
            fantasyPoints={panelPlayer?.fantasyPoints ?? 0}
            cost={panelPlayer?.leaguePrice ?? panelPlayer?.price ?? 0}
            activeLeagueId={selectedLeagueId}
            onDraftClick={null}
            onDropClick={async (player) => {
              await refreshLeagues();
              setPanelInfo(null);
              setPanelRefreshKey((prev) => prev + 1);
            }}
            onMoved={async () => {
              await refreshLeagues();
              setPanelRefreshKey((prev) => prev + 1);
            }}
            refreshKey={panelRefreshKey}
            onClose={() => setPanelInfo(null)}
          />
        ) : null}
      </div>

      {searchModal ? (
        <PlayerSearchModal
          open={Boolean(searchModal)}
          onClose={() => setSearchModal(null)}
          slotKey={searchModal.slotKey}
          rosterId={searchModal.rosterId}
          onDrafted={handleDrafted}
        />
      ) : null}
    </main>
  );
}

export default PreDraftPage;
