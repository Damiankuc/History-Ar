import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Enviar un latido (heartbeat) al backend cada 2 segundos para mantenerlo vivo.
// Si el usuario cierra el navegador, el backend dejará de recibir latidos y se apagará automáticamente.
setInterval(() => {
  fetch("http://localhost:8000/api/heartbeat", { method: "POST" })
    .catch((err) => console.warn("Backend heartbeat connection warning:", err));
}, 2000);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
