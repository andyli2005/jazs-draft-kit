import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

function ApiDashboardPage() {
  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">API Dashboard</p>
          <h1>Integration Status</h1>
          <p className="muted">Monitor API health, request volume, and sync status.</p>
        </section>
      </div>
    </main>
  );
}

export default ApiDashboardPage;
