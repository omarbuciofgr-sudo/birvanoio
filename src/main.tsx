import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { analytics } from "@heycatch/sdk";
import App from "./App.tsx";
import "./index.css";

analytics.init({
  projectKey: "hck_pk_g6GBx3GPhw8JZMWlW7eY4R9QbDtL9q7b",
  install: {
    framework: "vite-react",
    frameworkVersion: "18",
    agent: "lovable",
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");

createRoot(root).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
