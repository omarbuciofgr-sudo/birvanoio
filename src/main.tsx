import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { analytics } from "@heycatch/sdk";
import { supabase } from "@/integrations/supabase/client";
import App from "./App.tsx";
import { captureFirstTouch, readFirstTouch } from "@/lib/firstTouch";
import "./index.css";

analytics.init({
  projectKey: "hck_pk_g6GBx3GPhw8JZMWlW7eY4R9QbDtL9q7b",
  install: {
    framework: "vite-react",
    frameworkVersion: "18",
    agent: "lovable",
  },
});

captureFirstTouch();

// Saves first-touch source once per profile; a DB trigger blocks overwrites.
const sourcedUsers = new Set<string>();
async function saveSignupSource(userId: string) {
  if (sourcedUsers.has(userId)) return;
  sourcedUsers.add(userId);
  const { data } = await supabase.from("profiles").select("signup_source").eq("user_id", userId).maybeSingle();
  if (!data || data.signup_source) return;
  const source = readFirstTouch() ?? { referrer: null, note: "no first-touch data" };
  await supabase.from("profiles").update({ signup_source: source as never }).eq("user_id", userId).is("signup_source", null);
}

// One listener for the shared site/app, rather than one per useAuth consumer.
let identifiedUserId: string | null = null;
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    analytics.resetIdentity();
    identifiedUserId = null;
    return;
  }
  const user = session?.user;
  if (user) setTimeout(() => { void saveSignupSource(user.id); }, 0);
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
