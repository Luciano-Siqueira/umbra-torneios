import { createClient } from "@supabase/supabase-js";

// Credenciais do projeto Umbra/Tournament (entram no bundle: só chave publishable aqui)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (veja o README)");
}

// Lido antes do Supabase limpar o endereço: link de convite ou de nova senha pede uma senha nova
function tipoDoLink(): string | null {
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return hash.get("type") ?? new URLSearchParams(window.location.search).get("type");
  } catch {
    return null;
  }
}
export const LINK_PEDE_SENHA = ["invite", "recovery"].includes(tipoDoLink() ?? "");

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
