import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { useLeague } from "../leagues";
import RosterPageContent from "./RosterPageContent";

function MyTeamPage() {
  const { selectedLeague } = useLeague();
  const leagueRosters = Array.isArray(selectedLeague?.rosterIds) ? selectedLeague.rosterIds : [];
  const myTeamRoster = selectedLeague?.myTeam
    ? leagueRosters.find((roster) => String(roster._id) === String(selectedLeague.myTeam)) || null
    : null;

  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
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
          {myTeamRoster ? (
            <>
              <p className="muted my-team-budget">Budget Left: ${myTeamRoster.budgetLeft ?? selectedLeague?.budgetCap ?? 0}</p>
              <div className="my-team-roster-box">
                <RosterPageContent
                  roster={myTeamRoster}
                  budgetCap={selectedLeague?.budgetCap}
                  showBudget={false}
                />
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default MyTeamPage;
