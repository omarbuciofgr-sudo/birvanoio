import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { analytics } from "@heycatch/sdk";
import { supabase } from "@/integrations/supabase/client";
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

// One listener for the shared site/app, rather than one per useAuth consumer.
let identifiedUserId: string | null = null;
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    analytics.resetIdentity();
    identifiedUserId = null;
    return;
  }
  const user = session?.user;
  if (!user || user.id === identifiedUserId) return;
  const metadata = user.user_metadata;
  const name = metadata.full_name ?? metadata.name ??
    [metadata.first_name, metadata.last_name].filter(Boolean).join(" ");
  analytics.setIdentity(
    user.id,
    { ...(user.email ? { email: user.email } : {}), ...(name ? { name } : {}) },
    { signup_date: user.created_at },
  );
  identifiedUserId = user.id;
});

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");

createRoot(root).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
