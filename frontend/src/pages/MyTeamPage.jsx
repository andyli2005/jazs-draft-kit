import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import PlayerStatsPanel from "../components/PlayerStatsPanel";
import Sidebar from "../components/Sidebar";
import { Link } from "react-router-dom";
import { useLeague } from "../leagues";
import { dropCustomPlayer, dropPlayer, getDepthCharts } from "../leagues/requests";
import RosterPageContent from "./RosterPageContent";

function MyTeamPage() {
  const { selectedLeague, selectedLeagueId, refreshLeagues, patchRoster } = useLeague();
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);
  const [depthCharts, setDepthCharts] = useState(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function loadDepthCharts() {
      try {
        const data = await getDepthCharts();
        if (isMounted) setDepthCharts(data.teams ?? null);
      } catch {
        // Depth charts are supplemental — fail silently.
      }
    }
    loadDepthCharts();
    return () => { isMounted = false; };
  }, []);

  const teamDepthChart = useMemo(() => {
    if (!selectedPlayer?.team || !depthCharts) return null;
    const teamData = depthCharts[selectedPlayer.team];
    if (!teamData) return null;
    return Object.entries(teamData)
      .map(([position, posPlayers]) => ({
        position,
        players: posPlayers.map((p) => ({
          name: p.name,
          role: p.depthChart?.role,
          section: p.depthChart?.section,
          isSelected:
            p.playerId === selectedPlayer.APIplayerId ||
            p.name === selectedPlayer.name,
        })),
      }))
      .sort((a, b) => a.position.localeCompare(b.position));
  }, [selectedPlayer, depthCharts]);

  useEffect(() => {
    function handleLiveUpdate(event) {
      const notice = event.detail;
      const playerUpdate = notice?.player || {};
      if (!playerUpdate.APIplayerId) return;

      setSelectedPlayer((prev) => {
        if (!prev || String(prev.APIplayerId) !== String(playerUpdate.APIplayerId)) return prev;
        return {
          ...prev,
          status: playerUpdate.status || prev.status,
          injuryStatus: Object.prototype.hasOwnProperty.call(playerUpdate, "injuryStatus")
            ? playerUpdate.injuryStatus
            : prev.injuryStatus,
          latestNews: playerUpdate.latestNews || prev.latestNews,
          depthChart:
            notice.type === "depthChart"
              ? { ...(prev.depthChart || {}), ...(playerUpdate.depthChart || {}) }
              : prev.depthChart,
        };
      });
      setPanelRefreshKey((prev) => prev + 1);
    }

    window.addEventListener("draft-kit:player-live-update", handleLiveUpdate);
    return () => window.removeEventListener("draft-kit:player-live-update", handleLiveUpdate);
  }, []);
  const leagueRosters = Array.isArray(selectedLeague?.rosterIds) ? selectedLeague.rosterIds : [];
  const myTeamRoster = selectedLeague?.myTeam
    ? leagueRosters.find((roster) => String(roster._id) === String(selectedLeague.myTeam)) || null
    : null;

  async function handleDropClick(player) {
    if (!selectedLeagueId || !myTeamRoster?._id) return;
    const didConfirm = window.confirm(`Drop ${player.name || "this player"} from ${myTeamRoster.name || "My Team"}?`);
    if (!didConfirm) return;

    setActionError("");
    try {
      const isCustomPlayer = Boolean(player?.isCustom || !player?.APIplayerId);
      const dropActionId = isCustomPlayer ? player?._id : player?.APIplayerId;
      if (!dropActionId) return;
      const requestFn = isCustomPlayer ? dropCustomPlayer : dropPlayer;
      await requestFn(dropActionId, {
        leagueId: selectedLeagueId,
        rosterId: myTeamRoster._id,
      });
      await refreshLeagues();
      setSelectedPlayer(null);
    } catch (err) {
      setActionError(err.message || "Failed to drop player.");
    }
  }

  return (
    <main className="app-shell page-private">
      <Header />
      <div className={`app-body${selectedPlayer ? " app-body-with-panel" : ""}`}>
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">My Team</p>
          <h1>{myTeamRoster?.name || "My Team"}</h1>
          {!selectedLeague?.myTeam ? (
            <p className="muted">No team designated yet. Go to All Teams to select your team.</p>
          ) : null}
          {selectedLeague?.myTeam && !myTeamRoster ? (
            <p className="error">Unable to find the selected My Team roster in this league.</p>
          ) : null}
          {actionError ? <p className="error">{actionError}</p> : null}
          {myTeamRoster ? (
            <>
              <div className="my-team-toolbar">
                <p className="muted my-team-budget">Budget Left: ${myTeamRoster.budgetLeft ?? selectedLeague?.budgetCap ?? 0}</p>
                <Link className="btn btn-primary" to="/player-search">
                  Draft
                </Link>
              </div>
              <div className="my-team-roster-box">
                <RosterPageContent
                  roster={myTeamRoster}
                  budgetCap={selectedLeague?.budgetCap}
                  showBudget={false}
                  onPlayerSelect={setSelectedPlayer}
                />
              </div>
            </>
          ) : null}
        </section>
        {selectedPlayer ? (
          <PlayerStatsPanel
            player={selectedPlayer}
            fantasyPoints={selectedPlayer?.currentStats?.fantasyPoints ?? 0}
            cost={selectedPlayer?.price ?? 0}
            activeLeagueId={selectedLeagueId}
            ownerRosterId={myTeamRoster?._id || null}
            onDropClick={handleDropClick}
            onMoved={async () => {
              await refreshLeagues();
              setSelectedPlayer(null);
            }}
            onTeamChanged={async () => {
              await refreshLeagues();
              setPanelRefreshKey((k) => k + 1);
            }}
            onContractSaved={async (savedDoc) => {
              const priceDelta = (savedDoc.price ?? 0) - (selectedPlayer?.price ?? 0);
              setSelectedPlayer((prev) => prev ? { ...prev, price: savedDoc.price } : prev);
              if (priceDelta !== 0 && myTeamRoster?._id) {
                patchRoster(myTeamRoster._id, {
                  budgetLeft: (myTeamRoster.budgetLeft ?? 0) - priceDelta,
                });
              }
              await refreshLeagues();
            }}
            refreshKey={panelRefreshKey}
            teamDepthChart={teamDepthChart}
            scrollWithPage
            onClose={() => setSelectedPlayer(null)}
          />
        ) : null}
      </div>
    </main>
  );
}

export default MyTeamPage;
