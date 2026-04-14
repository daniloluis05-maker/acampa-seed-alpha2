// _env.js — Variáveis de ambiente locais
// ⚠️  NÃO commite este arquivo (.gitignore já o ignora)
// Copie _env.example.js → _env.js e preencha com suas credenciais reais.

window.__ENV__ = {
  // URL do projeto Supabase (encontre em: Project Settings → API → Project URL)
  SUPABASE_URL: "https://oyvvlbyxlaetlghzgjam.supabase.co",

  // Chave pública anon (encontre em: Project Settings → API → anon public)
  // Esta é a chave JWT — começa com "eyJ..."
  // NÃO use a service_role key aqui (ela fica apenas nos secrets das Edge Functions)
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95dnZsYnl4bGFldGxnaHpnamFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Mzc1NDksImV4cCI6MjA5MDIxMzU0OX0.4JpnIymqZOgNnw819I_o8qJq3BwOuvU4XLZ_w79Npqw"
};
