import AuthHeader from "../components/AuthHeader";
import AuthSidebar from "../components/AuthSidebar";

function PlayerSearchPage() {
  return (
    <main className="app-shell page-private">
      <AuthHeader />
      <div className="app-body">
        <AuthSidebar />
        <section className="app-content card">
          <p className="eyebrow">Player Search</p>
          <h1>Find Players</h1>
          <p className="muted">Search by position, team, age, and performance profile.</p>
        </section>
      </div>
    </main>
  );
}

export default PlayerSearchPage;
