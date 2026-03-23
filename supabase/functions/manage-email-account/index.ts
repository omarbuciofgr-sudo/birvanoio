import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const emailAccountSchema = z.object({
  label: z.string().min(1).max(100),
  email_address: z.string().email().max(255),
  smtp_host: z.string().min(1).max(255),
  smtp_port: z.number().int().min(1).max(65535),
  smtp_username: z.string().min(1).max(255),
  smtp_password: z.string().min(1).max(500),
  use_tls: z.boolean(),
});

// Simple encryption using Web Crypto API with AES-GCM
async function encryptPassword(password: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Derive a key from the encryption key using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionKey),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // Use a fixed salt derived from the key (for deterministic key derivation)
  const salt = encoder.encode("smtp-password-encryption-salt-v1");
  
  const derivedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    derivedKey,
    encoder.encode(password)
  );

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Convert to base64
  const binaryStr = Array.from(combined).map(b => String.fromCharCode(b)).join('');
  return `enc:${btoa(binaryStr)}`;
}

export async function decryptPassword(encryptedValue: string, encryptionKey: string): Promise<string> {
  if (!encryptedValue.startsWith("enc:")) {
    // Legacy unencrypted password - return as-is
    return encryptedValue;
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const base64Data = encryptedValue.slice(4); // Remove "enc:" prefix
  const binaryStr = atob(base64Data);
  const combined = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    combined[i] = binaryStr.charCodeAt(i);
  }

  // Extract IV and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionKey),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const salt = encoder.encode("smtp-password-encryption-salt-v1");

  const derivedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    derivedKey,
    ciphertext
  );

  return decoder.decode(decrypted);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const encryptionKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!encryptionKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const rawInput = await req.json();
    const { action } = rawInput;

    if (action === "create") {
      const validation = emailAccountSchema.safeParse(rawInput);
      if (!validation.success) {
        return new Response(JSON.stringify({ error: "Invalid input", details: validation.error.errors.map(e => e.message) }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { label, email_address, smtp_host, smtp_port, smtp_username, smtp_password, use_tls } = validation.data;

      // Encrypt the password server-side
      const encryptedPassword = await encryptPassword(smtp_password, encryptionKey);

      // Check if this is user's first account
      const { count } = await supabase
        .from("user_email_accounts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const isFirst = (count ?? 0) === 0;

      const { data, error } = await supabase.from("user_email_accounts").insert({
        user_id: user.id,
        label,
        email_address,
        smtp_host,
        smtp_port,
        smtp_username,
        smtp_password_encrypted: encryptedPassword,
        use_tls,
        is_default: isFirst,
      }).select("id, label, email_address, smtp_host, smtp_port, use_tls, is_default, is_verified, created_at").single();

      if (error) {
        console.error("Failed to create email account:", error);
        return new Response(JSON.stringify({ error: "Failed to create email account" }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ success: true, account: data }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("manage-email-account error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
