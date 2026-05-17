import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/index.jsx";

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "What was the make of your first car?",
];

function RegisterPage() {
  const navigate = useNavigate();
  const { registerUser } = useAuth();
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVerify, setPasswordVerify] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await registerUser({ userName, email, password, passwordVerify, securityQuestion, securityAnswer });
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <section className="card auth-card">
        <h1>Create Account</h1>
        <p className="muted">Create your Draft Kit account.</p>
        <form onSubmit={handleSubmit} className="form">
          <label>
            Username
            <input value={userName} onChange={(e) => setUserName(e.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label>
            Confirm Password
            <input type="password" value={passwordVerify} onChange={(e) => setPasswordVerify(e.target.value)} required />
          </label>
          <label>
            Security Question
            <select value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)} required>
              <option value="">Select a question...</option>
              {SECURITY_QUESTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </label>
          <label>
            Security Answer
            <input value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} required />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p className="muted small">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}

export default RegisterPage;
