import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSecurityQuestion, resetPassword } from "../auth/requests/index.jsx";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email"); // "email" | "reset" | "success"
  const [email, setEmail] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVerify, setPasswordVerify] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleEmailSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await getSecurityQuestion(email);
      setSecurityQuestion(data.securityQuestion);
      setStep("reset");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await resetPassword({ email, securityAnswer, password, passwordVerify });
      setStep("success");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "success") {
    return (
      <main className="page">
        <section className="card auth-card">
          <h1>Password Reset</h1>
          <p className="muted">Your password has been updated. You can now log in with your new password.</p>
          <Link to="/login" className="btn btn-primary" style={{ display: "inline-block", marginTop: "1rem" }}>
            Go to Log In
          </Link>
        </section>
      </main>
    );
  }

  if (step === "reset") {
    return (
      <main className="page">
        <section className="card auth-card">
          <h1>Reset Password</h1>
          <p className="muted">Answer your security question to set a new password.</p>
          <form onSubmit={handleResetSubmit} className="form">
            <label>
              Security Question
              <input value={securityQuestion} disabled />
            </label>
            <label>
              Your Answer
              <input value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} required />
            </label>
            <label>
              New Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <label>
              Confirm New Password
              <input type="password" value={passwordVerify} onChange={(e) => setPasswordVerify(e.target.value)} required />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card auth-card">
        <h1>Forgot Password</h1>
        <p className="muted">Enter your account email to retrieve your security question.</p>
        <form onSubmit={handleEmailSubmit} className="form">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Looking up..." : "Continue"}
          </button>
        </form>
        <p className="muted small">
          <Link to="/login">Back to Log In</Link>
        </p>
      </section>
    </main>
  );
}

export default ForgotPasswordPage;
