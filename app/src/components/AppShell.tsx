import { NavLink, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/sets", label: "Sets" },
  { to: "/cards", label: "Cards" },
  { to: "/lists", label: "Lists" },
  { to: "/settings", label: "Settings" },
];

export function AppShell() {
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
        <Outlet />
      </main>
    </div>
  );
}