// Ambiente dos testes: localStorage em memória e rede controlada por cada teste
export type RespostaFalsa = (url: string, init: RequestInit) => Response | Promise<Response>;

const dados = new Map<string, string>();
const global = globalThis as any;

// Os testes de tela já têm window e localStorage, vindos do jsdom
if (typeof document === "undefined") {
  global.localStorage = {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v),
    removeItem: (k: string) => void dados.delete(k),
  };
  global.window = globalThis;
}

global.fetch = async (entrada: any, init: RequestInit = {}) => {
  const url = String(entrada?.url ?? entrada);
  const resposta: RespostaFalsa | undefined = global.__rede;
  if (resposta) return resposta(url, init);
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
};
