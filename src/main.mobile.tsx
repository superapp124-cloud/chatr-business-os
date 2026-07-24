import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { DesignSystemProvider } from "./contexts/DesignSystemContext";

// Mobile entry point — platform is decided here, once, at startup.
// Capacitor always loads this via localhost:8080 during live reload,
// or from the bundled dist/ in production.
// App never needs to guess the platform.

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
 <DesignSystemProvider>
 <App platform="mobile" />
 </DesignSystemProvider>
);
