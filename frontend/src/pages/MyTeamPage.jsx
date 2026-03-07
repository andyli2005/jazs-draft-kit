import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

function MyTeamPage() {
  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">My Team</p>
          <h1>Your Team Hub</h1>
          <p className="muted">Track your roster status, strengths, and upcoming draft priorities.</p>
        </section>
      </div>
    </main>
  );
}

export default MyTeamPage;
