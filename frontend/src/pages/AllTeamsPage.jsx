import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

function AllTeamsPage() {
  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">All Teams</p>
          <h1>League Teams</h1>
          <p className="muted">Browse all teams and compare records, needs, and depth.</p>
        </section>
      </div>
    </main>
  );
}

export default AllTeamsPage;
