// O app da Play Store abre o site dentro de uma "atividade confiável" (TWA). Na primeira página,
// o navegador informa a origem como android-app://<pacote>. A regra da loja não deixa vender
// recursos digitais por fora dela, então ali a compra do Organizador Pro fica escondida.
const CHAVE = "mtg.app.loja";

// Chamar uma vez, no começo do app. Fica guardado só nesta janela (o Chrome do celular é separado).
export function registrarOrigemDoApp(referrer = typeof document !== "undefined" ? document.referrer : ""): void {
  try {
    if (referrer.startsWith("android-app://")) sessionStorage.setItem(CHAVE, "1");
  } catch { /* sem armazenamento */ }
}

export function abertoPeloAppDaLoja(): boolean {
  try {
    return sessionStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

// A compra só aparece no site, aberto no navegador ou instalado como app pelo navegador
export function podeVenderNoApp(): boolean {
  return !abertoPeloAppDaLoja();
}
