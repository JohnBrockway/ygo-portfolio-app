import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <>
      <h1>Page not found</h1>
      <p className="muted">That address doesn't match any page.</p>
      <Link to="/sets">Go to Sets</Link>
    </>
  );
}