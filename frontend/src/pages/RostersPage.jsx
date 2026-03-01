import AuthHeader from "../components/AuthHeader";
import AuthSidebar from "../components/AuthSidebar";

function RostersPage() {
  return (
    <main className="app-shell page-private">
      <AuthHeader />
      <div className="app-body">
        <AuthSidebar />
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
