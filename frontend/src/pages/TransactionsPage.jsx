import AuthHeader from "../components/AuthHeader";
import AuthSidebar from "../components/AuthSidebar";

function TransactionsPage() {
  return (
    <main className="app-shell page-private">
      <AuthHeader />
      <div className="app-body">
        <AuthSidebar />
        <section className="app-content card">
          <p className="eyebrow">Transactions</p>
          <h1>Recent Moves</h1>
          <p className="muted">Review trades, claims, and drops to stay updated.</p>
        </section>
      </div>
    </main>
  );
}

export default TransactionsPage;
