// Função do Supabase (Edge Function) que manda os avisos (notificações) do Umbra Torneios.
// Tipos ("tipo" no pedido):
//   mesa       — a mesa de cada jogador quando a rodada começa (padrão)
//   extra        — o tempo normal acabou: começa o tempo extra
//   ultimo_turno — o tempo extra acabou: falta 1 turno para cada jogador
//   finalizado — o torneio terminou: ver o ranking
//   aprovacao  — aos admins: um nome de jogador aguarda aprovação
// Quais tipos saem é escolhido pelo admin na tela Usuários (tabela config_avisos). Dentro disso,
// quem organiza com o Organizador Pro (ou é admin) escolhe por torneio (dados.avisos).
// Notificações de torneio são do Jogador Pro (o Organizador Pro inclui): só recebe quem tem o Pro em dia
// e, para mesas e tempo, também "Mesas" (e "Tempo") liberado pelo admin. Admins recebem sempre.
//
// Segredos (Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// Publicar: Edge Functions → avisar-mesas → editar, colar este arquivo e Deploy.
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const esperar = (ms: number) => new Promise((fim) => setTimeout(fim, ms));
const normalizar = (nome: string) => nome.trim().toLowerCase();

function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

type Tipo = "mesa" | "extra" | "ultimo_turno" | "finalizado" | "aprovacao";
const TIPOS: Tipo[] = ["mesa", "extra", "ultimo_turno", "finalizado", "aprovacao"];
type Jogador = { id: number; nome: string };
type Mesa = { numero: number; jogadoresIds: number[]; finalizada?: boolean };
type AvisosDoTorneio = { mesa?: boolean; tempo?: boolean; finalizado?: boolean };
type Dados = { nome: string; rodadaAtual: number; tempoExtraMin?: number; avisos?: AvisosDoTorneio; jogadores: Jogador[]; mesas: Mesa[]; finalizado?: boolean };
type Mensagem = { title: string; body: string; url: string; tag: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta(405, { erro: "Use POST" });

  const servidor = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quem } = await servidor.auth.getUser(token);
  if (!quem?.user) return resposta(401, { erro: "Entre na sua conta" });
  const uid = quem.user.id;

  let tipo: Tipo = "mesa";
  let torneioId = "";
  let rodada = 0;
  let nomePedido = "";
  try {
    const corpo = await req.json();
    tipo = TIPOS.includes(corpo?.tipo) ? corpo.tipo : "mesa";
    torneioId = String(corpo?.torneio_id ?? "");
    rodada = Number(corpo?.rodada ?? 0);
    nomePedido = String(corpo?.nome ?? "").trim();
  } catch {
    return resposta(400, { erro: "Pedido inválido" });
  }

  // O admin pode desligar cada tipo na tela Usuários. Sem a tabela, tudo fica ligado.
  const { data: config } = await servidor.from("config_avisos").select("*").eq("id", 1).maybeSingle();
  if (config && config[tipo] === false) return resposta(200, { ok: true, enviados: 0, contas: 0, desligado: "geral" });

  const { data: admins } = await servidor.from("admins").select("user_id");
  const idsAdmins = (admins ?? []).map((a) => a.user_id as string);

  // Quem recebe e o quê: conta → mensagem
  const mensagens = new Map<string, Mensagem>();

  if (tipo === "aprovacao") {
    // Só quem acabou de pedir aquele nome pode avisar os admins
    const { data: pedido } = await servidor
      .from("usuarios_jogadores")
      .select("nome_jogador")
      .eq("user_id", uid)
      .eq("nome_jogador", nomePedido)
      .eq("aprovado", false)
      .maybeSingle();
    if (!pedido) return resposta(403, { erro: "Nenhum pedido pendente com esse nome" });
    for (const admin of idsAdmins) {
      mensagens.set(admin, {
        title: "Nome aguardando aprovação",
        body: `${nomePedido} quer entrar como jogador. Aprove ou recuse na tela Usuários.`,
        url: "/?tela=usuarios",
        tag: `aprovacao-${nomePedido}`,
      });
    }
  } else {
    if (!torneioId) return resposta(400, { erro: "Informe o torneio" });

    // Só admin ou quem criou o torneio
    const { data: privado } = await servidor.from("torneio_privado").select("criado_por").eq("torneio_id", torneioId).maybeSingle();
    if (!idsAdmins.includes(uid) && privado?.criado_por !== uid) {
      return resposta(403, { erro: "Só quem organiza o torneio pode mandar avisos" });
    }

    // O app grava o torneio em segundo plano: espera a mudança chegar ao banco
    const pronto = (d: Dados | null) => !!d && (tipo === "finalizado"
      ? !!d.finalizado
      : d.rodadaAtual >= rodada && d.mesas?.length > 0);
    let dados: Dados | null = null;
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const { data } = await servidor.from("torneios").select("dados").eq("id", torneioId).maybeSingle();
      dados = (data?.dados as Dados) ?? null;
      if (pronto(dados)) break;
      await esperar(1500);
    }
    if (!dados || !pronto(dados) || (tipo !== "finalizado" && dados.rodadaAtual !== rodada)) {
      return resposta(409, { erro: "O torneio ainda não foi salvo com essa mudança. Tente de novo em instantes." });
    }

    // Dono do torneio com o Pro em dia (admin conta como Pro)
    const donoTemPro = async (dono: string | null): Promise<boolean> => {
      if (!dono) return false;
      if (idsAdmins.includes(dono)) return true;
      const { data } = await servidor.from("assinaturas_pro").select("pro_ate")
        .eq("user_id", dono).eq("plano", "organizador").gt("pro_ate", new Date().toISOString()).maybeSingle();
      return !!data;
    };

    // Escolha do torneio: só vale se quem criou tem o Organizador Pro ou é admin
    const campo: keyof AvisosDoTorneio = tipo === "mesa" ? "mesa" : tipo === "finalizado" ? "finalizado" : "tempo";
    if (dados.avisos?.[campo] === false && await donoTemPro(privado?.criado_por ?? null)) {
      return resposta(200, { ok: true, enviados: 0, contas: 0, desligado: "torneio" });
    }

    // Tempo e fim do torneio saem uma vez só, mesmo que vários aparelhos peçam
    if (tipo !== "mesa") {
      const { error: repetido } = await servidor
        .from("avisos_enviados")
        .insert({ torneio_id: torneioId, rodada: tipo === "finalizado" ? 0 : rodada, tipo });
      if (repetido) return resposta(200, { ok: true, enviados: 0, contas: 0, repetido: true });
    }

    // Nome de jogador do torneio → contas (só nomes aprovados)
    const { data: vinculos } = await servidor.from("usuarios_jogadores").select("user_id, nome_jogador, aprovado");
    const contasPorNome = new Map<string, string[]>();
    for (const v of vinculos ?? []) {
      if (v.aprovado === false) continue;
      const chave = normalizar(v.nome_jogador);
      contasPorNome.set(chave, [...(contasPorNome.get(chave) ?? []), v.user_id]);
    }
    const nomePorId = new Map(dados.jogadores.map((j) => [j.id, j.nome]));

    // Quem tem Jogador Pro ou Organizador Pro em dia (sem a tabela, ninguém além dos admins)
    const { data: assinaturas } = await servidor.from("assinaturas_pro").select("user_id")
      .gt("pro_ate", new Date().toISOString());
    const comPro = new Set<string>([...idsAdmins, ...(assinaturas ?? []).map((a) => a.user_id as string)]);

    // Permissões da tela Usuários (sem a tabela, só admins veem mesas e tempo), e só com o Pro
    const { data: permissoes } = await servidor.from("permissoes_jogador").select("user_id, ver_mesas, ver_tempo");
    const verMesas = new Set<string>(idsAdmins);
    const verTempo = new Set<string>(idsAdmins);
    for (const p of (permissoes ?? []) as { user_id: string; ver_mesas: boolean; ver_tempo: boolean }[]) {
      if (!comPro.has(p.user_id)) continue;
      if (p.ver_mesas) verMesas.add(p.user_id);
      if (p.ver_mesas && p.ver_tempo) verTempo.add(p.user_id);
    }

    const avisar = (nome: string | undefined, podeVer: Set<string> | null, msg: Mensagem) => {
      if (!nome) return;
      for (const conta of contasPorNome.get(normalizar(nome)) ?? []) {
        if (podeVer && !podeVer.has(conta)) continue;
        mensagens.set(conta, msg);
      }
    };

    if (tipo === "finalizado") {
      // Ranking e histórico ficam visíveis a todos quando o torneio termina; o aviso vai para quem tem o Pro
      for (const j of dados.jogadores) {
        avisar(j.nome, comPro, {
          title: `🏆 ${dados.nome} terminou`,
          body: "Veja o ranking final e o histórico das rodadas.",
          url: "/?tela=torneios",
          tag: `fim-${torneioId}`,
        });
      }
    } else {
      for (const mesa of dados.mesas) {
        // Aviso de tempo só para quem ainda está jogando
        if (tipo !== "mesa" && mesa.finalizada) continue;
        for (const id of mesa.jogadoresIds) {
          const nome = nomePorId.get(id);
          if (tipo === "mesa") {
            const outros = mesa.jogadoresIds.filter((x) => x !== id).map((x) => nomePorId.get(x) ?? "?");
            avisar(nome, verMesas, {
              title: `⚔️ Rodada ${rodada} · Mesa ${mesa.numero}`,
              body: `${dados.nome}: você joga com ${juntarNomes(outros)}. Boa sorte!`,
              url: "/?tela=torneios",
              tag: `mesa-${torneioId}-${rodada}`,
            });
          } else if (tipo === "extra") {
            const minutos = dados.tempoExtraMin ? ` de ${dados.tempoExtraMin} minutos` : "";
            avisar(nome, verTempo, {
              title: `⏳ Tempo extra · Rodada ${rodada}`,
              body: `${dados.nome}: o tempo normal acabou. Começou o tempo extra${minutos} (Mesa ${mesa.numero}).`,
              url: "/?tela=torneios",
              tag: `tempo-${torneioId}-${rodada}`,
            });
          } else {
            avisar(nome, verTempo, {
              title: `🔔 Último turno · Rodada ${rodada}`,
              body: `${dados.nome}: o tempo extra acabou. Falta 1 turno para cada jogador (Mesa ${mesa.numero}).`,
              url: "/?tela=torneios",
              tag: `tempo-${torneioId}-${rodada}`,
            });
          }
        }
      }
    }
  }

  if (mensagens.size === 0) return resposta(200, { ok: true, enviados: 0, contas: 0 });

  const { data: aparelhos } = await servidor
    .from("push_inscricoes")
    .select("endpoint, user_id, p256dh, auth")
    .in("user_id", [...mensagens.keys()]);

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@umbraarena.com.br",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  let enviados = 0;
  const vencidos: string[] = [];
  await Promise.all((aparelhos ?? []).map(async (a) => {
    const msg = mensagens.get(a.user_id)!;
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, JSON.stringify(msg), {
        TTL: 60 * 60,
        urgency: "high",
      });
      enviados++;
    } catch (e) {
      // Aparelho que desinstalou ou recusou depois: sai da lista
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) vencidos.push(a.endpoint);
    }
  }));
  if (vencidos.length) await servidor.from("push_inscricoes").delete().in("endpoint", vencidos);

  return resposta(200, { ok: true, enviados, contas: mensagens.size });
});
