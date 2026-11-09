import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { registrarOrigemDoApp } from "./core/plataforma";

// Antes de qualquer navegação interna: só a primeira página sabe se veio do app da Play Store
registrarOrigemDoApp();

function boot() {
  const el = document.getElementById("root");
  if (!el) {
    // Se por algum motivo o body ainda não carregou, cria a div.
    const div = document.createElement("div");
    div.id = "root";
    document.body.appendChild(div);
    ReactDOM.createRoot(div).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    return;
  }
  ReactDOM.createRoot(el).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
