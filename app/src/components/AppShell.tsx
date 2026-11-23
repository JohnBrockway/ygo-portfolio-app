import { NavLink, Outlet, useLocation } from "react-router-dom";
import { refreshBinders, useLiveBinders } from "../data/binders";
import { refreshLists, useLiveLists } from "../data/lists";
import { syncNow, useLiveSyncStatus } from "../data/sync";
import { AccountControl } from "./AccountControl";
import { AccountGuardBanner } from "./AccountGuardBanner";
import { ErrorBanner } from "./ErrorBanner";
import { ErrorBoundary } from "./ErrorBoundary";
import { SyncIndicator } from "./SyncIndicator";

const NAV_ITEMS = [
  { to: "/sets", label: "Sets" },
  { to: "/cards", label: "Cards" },
  { to: "/lists", label: "Lists" },
  { to: "/binders", label: "Binders" },
  { to: "/settings", label: "Settings" },
];

export function AppShell() {
  const location = useLocation();
  const listsState = useLiveLists();
  const bindersState = useLiveBinders();
  const syncStatus = useLiveSyncStatus();

  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <div className="nav-title">Card Tracker</div>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className="nav-link">
            {item.label}
          </NavLink>
        ))}
        <AccountControl />
        <SyncIndicator />
      </nav>
      <main className="content">
        <ErrorBanner what="lists" state={listsState} retry={refreshLists} />
        <ErrorBanner what="binders" state={bindersState} retry={refreshBinders} />
        <AccountGuardBanner />
        <ErrorBanner
          what="changes"
          message="Couldn't sync with the cloud. Your changes are safe on this device and will be uploaded by the next successful sync."
          state={{
            status: syncStatus.kind === "error" ? "error" : "ready",
            error: syncStatus.kind === "error" ? syncStatus.message : null,
          }}
          retry={syncNow}
        />
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}