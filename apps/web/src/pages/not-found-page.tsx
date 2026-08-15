import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <section className="panel">
      <h1>Page not found</h1>
      <p>The route you requested does not exist.</p>
      <Link className="button" to="/dashboard">
        Go to dashboard
      </Link>
    </section>
  );
}
