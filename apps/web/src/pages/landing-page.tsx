import { Link } from "react-router";
import { AkibaLogo } from "../components/akiba-logo";

export function LandingPage() {
  return (
    <main className="auth-page" aria-label="Akiba overview">
      <section className="auth-card" style={{ maxWidth: "860px" }}>
        <div className="auth-card-brand">
          <AkibaLogo variant="auth" />
        </div>

        <div className="auth-card-header">
          <p className="eyebrow">Community savings, clearly tracked</p>
          <h1>Akiba helps savings groups run with trust and transparency.</h1>
          <p className="auth-subtitle">
            Akiba is built for chamas and community savings circles that need clear records,
            member accountability, and visibility into contributions and loan requests.
          </p>
        </div>

        <div className="stack" style={{ gap: "0.65rem" }}>
          <p>
            <strong>What Akiba supports now:</strong> account registration, group management,
            role-based membership, contribution submission and approval, transaction history,
            and loan lifecycle steps from request to disbursement and repayment records.
          </p>
          <p>
            <strong>Still under development:</strong> advanced lending policies, automated repayment
            schedules with late-fee rules, and external payment integrations.
          </p>
          <p>
            This product is currently best treated as a pilot implementation before full production rollout.
          </p>
        </div>

        <div className="inline-actions" style={{ marginTop: "1rem" }}>
          <Link to="/register" className="button">Create account</Link>
          <Link to="/login" className="button button-secondary">Sign in</Link>
        </div>
      </section>
    </main>
  );
}
