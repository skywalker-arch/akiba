import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { AkibaLogo } from "../components/akiba-logo";
import { useAuth } from "../context/auth-context";
import { authApi } from "../lib/api";

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authApi.login({ email, password });
      login(result.accessToken);
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-panel auth-panel--highlight">
        <AkibaLogo invert />
        <div className="auth-copy">
          <p className="eyebrow eyebrow--light">Savings built for together</p>
          <h1>Grow wealth with your circle.</h1>
          <p>
            Track contributions, manage group disbursements, and keep every member aligned with one trusted platform.
          </p>
        </div>
        <div className="auth-stat-grid">
          <div>
            <strong>Real-time</strong>
            <span>group activity</span>
          </div>
          <div>
            <strong>Trust-first</strong>
            <span>verification flow</span>
          </div>
        </div>
      </div>

      <div className="auth-panel auth-panel--form">
        <div className="auth-card-heading">
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to Akiba</h2>
        </div>

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="muted-text auth-switcher">
          Need an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </section>
  );
}
