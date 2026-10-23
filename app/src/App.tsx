import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { CardsPage } from "./pages/CardsPage";
import { ListsPage } from "./pages/ListsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SetsPage } from "./pages/SetsPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Every page renders inside AppShell (navigation + content area). */}
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/sets" replace />} />
          <Route path="/sets" element={<SetsPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}