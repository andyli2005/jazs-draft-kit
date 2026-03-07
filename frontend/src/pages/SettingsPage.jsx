import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

function SettingsPage() {
  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">Settings</p>
          <h1>Account Settings</h1>
          <p className="muted">Manage your profile and preferences.</p>
        </section>
      </div>
    </main>
  );
}

export default SettingsPage;
