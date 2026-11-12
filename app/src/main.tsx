import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { refreshLists } from "./data/lists";

// Lists are loaded once here, before anything renders; components wait for the status to become "ready".
void refreshLists();

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Missing #root element in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);