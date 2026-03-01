import AuthHeader from "../components/AuthHeader";
import AuthSidebar from "../components/AuthSidebar";

function ApiDashboardPage() {
  return (
    <main className="app-shell page-private">
      <AuthHeader />
      <div className="app-body">
        <AuthSidebar />
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
