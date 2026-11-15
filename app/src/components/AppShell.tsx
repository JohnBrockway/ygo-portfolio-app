import { NavLink, Outlet, useLocation } from "react-router-dom";
import { refreshBinders, useLiveBinders } from "../data/binders";
import { refreshLists, useLiveLists } from "../data/lists";
import { ErrorBanner } from "./ErrorBanner";
import { ErrorBoundary } from "./ErrorBoundary";

const NAV_ITEMS = [
  { to: "/sets", label: "Sets" },
  { to: "/cards", label: "Cards" },
  { to: "/lists", label: "Lists" },
  { to: "/settings", label: "Settings" },
];

export function AppShell() {
  const location = useLocation();
  const listsState = useLiveLists();
  const bindersState = useLiveBinders();

  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <div className="nav-title">Card Tracker</div>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className="nav-link">
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <ErrorBanner what="lists" state={listsState} retry={refreshLists} />
        <ErrorBanner what="binders" state={bindersState} retry={refreshBinders} />
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}