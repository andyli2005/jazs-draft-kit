import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { useParams } from "react-router-dom";
import { useLeague } from "../leagues";
import RosterPageContent from "./RosterPageContent";

function RostersPage() {
  const { rosterId } = useParams();
  const { selectedLeague } = useLeague();

  const leagueRosters = Array.isArray(selectedLeague?.rosterIds) ? selectedLeague.rosterIds : [];
  const selectedRoster = rosterId
    ? leagueRosters.find((roster) => String(roster._id) === String(rosterId)) || null
    : null;

  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">Rosters</p>
          <h1>{selectedRoster?.name || "Roster"}</h1>
          {!rosterId ? <p className="muted">Select a roster from the sidebar to view a team page.</p> : null}
          {rosterId && !selectedRoster ? (
            <p className="error">Unable to find that roster in the selected league.</p>
          ) : null}
          {selectedRoster ? (
            <>
              <p className="muted my-team-budget">
                Budget Left: ${selectedRoster.budgetLeft ?? selectedLeague?.budgetCap ?? 0}
              </p>
              <div className="my-team-roster-box">
                <RosterPageContent
                  roster={selectedRoster}
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

export default RostersPage;
