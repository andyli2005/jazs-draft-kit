import AuthHeader from "../components/AuthHeader";
import AuthSidebar from "../components/AuthSidebar";

function AllTeamsPage() {
  return (
    <main className="app-shell page-private">
      <AuthHeader />
      <div className="app-body">
        <AuthSidebar />
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
