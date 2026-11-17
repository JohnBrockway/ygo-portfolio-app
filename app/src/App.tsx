import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { BinderDetailPage } from "./pages/BinderDetailPage";
import { BindersPage } from "./pages/BindersPage";
import { CardDetailPage } from "./pages/CardDetailPage";
import { CardsPage } from "./pages/CardsPage";
import { ListDetailPage } from "./pages/ListDetailPage";
import { ListsPage } from "./pages/ListsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PrintingPage } from "./pages/PrintingPage";
import { SetDetailPage } from "./pages/SetDetailPage";
import { SetsPage } from "./pages/SetsPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Every page renders inside AppShell (navigation + content area). */}
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/cards" replace />} />
          <Route path="/sets" element={<SetsPage />} />
          <Route path="/sets/:setId" element={<SetDetailPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/cards/:cardId" element={<CardDetailPage />} />
          <Route path="/printings/:setcodeId" element={<PrintingPage />} />
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/lists/:listId" element={<ListDetailPage />} />
          <Route path="/binders" element={<BindersPage />} />
          <Route path="/binders/:binderId" element={<BinderDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}