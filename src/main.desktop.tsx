import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { DesignSystemProvider } from "./contexts/DesignSystemContext";

// Desktop entry point — platform is decided here, once, at startup.
// Electron's main.cjs always loads this via localhost:8085.
// App never needs to guess the platform.

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

try {
 console.log("🚀 [Main Desktop] Starting React mount...");
 createRoot(rootElement).render(
 <DesignSystemProvider>
 <App platform="desktop" />
 </DesignSystemProvider>
 );
 console.log("🚀 [Main Desktop] Render call completed");
} catch (e: any) {
 console.error("❌ React Mount Error:", e);
 rootElement.innerHTML = `<div style="color:red;font-size:24px;padding:20px;z-index:999999;position:relative;">CRITICAL ERROR: ${e.message}<br/>${e.stack}</div>`;
}
