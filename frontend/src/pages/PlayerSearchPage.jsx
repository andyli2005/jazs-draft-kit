import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

function PlayerSearchPage() {
  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
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
