import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { refreshBinders } from "./data/binders";
import { refreshLists } from "./data/lists";

// Lists and binders are loaded once here, before anything renders; components wait for the status to become "ready".
void refreshLists();
void refreshBinders();

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Missing #root element in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);