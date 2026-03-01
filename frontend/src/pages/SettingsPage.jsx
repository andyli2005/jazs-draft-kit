import AuthHeader from "../components/AuthHeader";
import AuthSidebar from "../components/AuthSidebar";

function SettingsPage() {
  return (
    <main className="app-shell page-private">
      <AuthHeader />
      <div className="app-body">
        <AuthSidebar />
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
