import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

function RostersPage() {
  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">Rosters</p>
          <h1>Roster Overview</h1>
          <p className="muted">View complete roster lists across the league in one table.</p>
        </section>
      </div>
    </main>
  );
}

export default RostersPage;
