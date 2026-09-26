import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { TemaProvider, BotonTema } from "./tema";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TemaProvider>
      <App />
      <BotonTema />
    </TemaProvider>
  </StrictMode>,
);