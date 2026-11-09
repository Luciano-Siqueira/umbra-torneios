# Umbra Torneios

Sistema web de gerenciamento de torneios de MTG multiplayer. Parte da marca **Umbra** (latim pra "sombra"), que vai se expandir pra TCG retail, consultoria de dados e serviços de sommelier de cerveja artesanal.

- **Produção**: https://torneios.umbraarena.com.br (também responde em umbra-torneios.vercel.app)
- **Repo**: https://github.com/Luciano-Siqueira/umbra-torneios
- **Owner**: HerrSiqueira

## Marca

A identidade oficial está em `marca/umbra-identidade.html`: logo, variações, sub-marcas (Cards, Data, Brews e Nights), o lema "In umbra veritas" e a paleta Noir `#0a0a0a`, Luz `#f5f5f5`, Ouro antigo `#c9a648` e Sangue `#8b0000`.

O site usa só o símbolo, com acento em ouro antigo, no menu (`src/components/ui/LogoUmbra.tsx`). O favicon e os ícones do app saem de `marca/simbolo-umbra.svg`. Os cards de torneio usam os símbolos de mana do pacote `mana-font` (`src/components/ui/SimboloMana.tsx`). Cores fora da paleta só para avisos, símbolos de Magic, medalhas e participantes dos sorteios.

---

## Stack

- **React 18 + Vite + TypeScript** (strict mode)
- **TailwindCSS** com CSS tokens customizados (paleta noir + ouro antigo `#c9a648` + sangue `#8b0000`)
- **Zustand** pra state (`src/core/store.ts`)
- **Supabase** (auth email+senha + Postgres com RLS)
- **PWA** via `vite-plugin-pwa`
- **Standalone HTML build** via `vite-plugin-singlefile` (tudo embutido num `.html` offline)
- Font: Sora (Google Fonts)
- Canvas API pra roleta e corrida de patinhos (sorteios de mesas)
- Web Audio API pros beeps do timer

---

## Comandos

```bash
npm install
npm run dev              # dev server
npm run build            # checa os tipos e faz o build pra Vercel
npm run build:single     # checa os tipos e gera dist-single/index.html standalone (tudo inline)
npm test                 # testes automáticos (src/core/testes e src/components/testes)
```

Deploy: push na `main` → Vercel autodeploys.

---

## Arquitetura

### Estrutura de pastas
```
src/
  App.tsx                       # root + roteamento interno via useStore
  banner-image.ts               # exporta o banner (src/assets/banner.webp)
  core/
    supabaseClient.ts           # cliente Supabase (lê as variáveis VITE_SUPABASE_*)
    auth.ts                     # useAuth hook + entrar/registrar/sair/vincularNome
    admin.ts                    # funções admin: listar, deletar, resetar senha, renomear
    store.ts                    # Zustand store + Tela + ModoView
    sync.ts                     # sincronização bidirecional LS <-> Supabase (debounce 800ms)
    storage.ts                  # wrappers de localStorage
    types.ts                    # Torneio, Jogador, Mesa, etc
    pareamento.ts               # algoritmo suíço
    premiacao.ts                # cálculo de prêmios
    resultados.ts               # standings + tiebreakers
    metricas.ts                 # agregações pro analytics
    backup.ts                   # export/import JSON
    useTimer.ts                 # hook de timer com beeps
    audio.ts                    # Web Audio helpers
  components/
    Splash.tsx                  # tela inicial
    TelaLogin.tsx               # modal login/signup (abas)
    TelaVincularNome.tsx        # modal pós-signup com autocomplete
    AuthChip.tsx                # chip multi-role com seletor "Ver como"
    TelaTorneios.tsx            # listagem de torneios
    TelaTorneio.tsx             # torneio individual (rodadas, mesas)
    TelaAnalytics.tsx           # KPIs e gráficos
    TelaDecks.tsx               # lista dos decks de Commander, com busca (dados em core/decks.ts)
    TelaUsuarios.tsx            # painel admin (👑 ADMIN / 🎯 ORG / ✎🔑🗑)
    DialogoTorneio.tsx          # criar/editar torneio
    DialogoResultado.tsx        # registrar resultado de mesa
    abas/                       # AbaMesas, AbaJogadores, AbaRanking, etc
    sorteios/                   # SorteioRoda, CorridaPatinhos
    ui/                         # Toast, confirmar, componentes base
```

### Papéis (multi-role)

Três perfis não exclusivos:
- **👑 admin** — tabela `admins` — acesso total, página de gestão de usuários
- **🎯 organizador** — tabela `organizadores` — pode criar e editar torneios
- **👤 jogador** — tabela `usuarios_jogadores` (vincula user_id a `nome_jogador` único) — vê seus próprios resultados

Dentro do torneio, o modo jogador vê só Mesas (leitura, com o cartão da própria mesa), Ranking e Histórico; admin e organizador veem todas as abas, sem o cartão.

Mesmo usuário pode ter todos os papéis. O `modoView` (admin/organizador/jogador) é um seletor de visualização persistido em localStorage, validado contra permissões reais ao carregar o perfil (default = jogador).

### Sincronização

- **localStorage** como cache (chave `mtg.torneios.v1`), **Supabase** como fonte de verdade
- Ao abrir, o app mostra o cache e atualiza do servidor por trás; o cache só é descartado quando muda a conta (`mtg.torneios.dono`)
- O perfil também fica em cache (`mtg.perfil.v1`) e é confirmado com o servidor a cada abertura
- `puxarDoServidor` **SUBSTITUI** o localStorage (não mescla — evita vazar torneios entre contas), exceto com envio pendente
- `enviarTorneio` tem debounce de 800ms. Sem conexão, o envio fica em `mtg.envios.pendentes` e é repetido, inclusive depois de recarregar; recusa do servidor (como RLS) avisa e não repete
- `sair()` limpa `mtg.torneios.v1`, `mtg.modoView` e `mtg.perfil.v1`

### Ao vivo

- O timer da rodada fica gravado no torneio (`Torneio.timer`), e cada aparelho calcula o tempo a partir da hora do servidor (`agora_servidor()`)
- A tabela `torneio_ao_vivo` guarda só rodada, mesas e timer, para o Realtime não transmitir o torneio inteiro. O SQL está em `supabase/torneio_ao_vivo.sql`
- Quem organiza publica (`publicarAoVivo`); quem acompanha escuta (`useAoVivo`) e baixa o torneio completo só quando a rodada muda
- `CartaoMinhaMesa`, na aba Mesas, mostra ao jogador a mesa e o tempo, comparando os nomes vinculados à conta com os do torneio
- Se o Realtime não conectar, `useAoVivo` confere por consulta a cada 15 segundos; sem linha ao vivo, usa o torneio salvo
- Outro aparelho de quem organiza também escuta, ignora o eco do que publicou (`ehPublicacaoMinha`) e baixa o torneio inteiro a cada novidade. Cada gravação confere a versão do servidor (`dados.versao`): se outro aparelho gravou antes, nada é sobrescrito e o usuário escolhe qual versão fica
- Fora de um torneio, `useListaAtualizada` compara um resumo a cada minuto e só baixa os torneios se algo mudou
- Torneio iniciado e sem atividade há mais de 3 dias (`torneioParado`) sai da faixa "Em andamento" e gera um aviso para quem organiza

### Decks

- `src/core/decks.ts` traz a lista de decks de Commander, com as cores dos comandantes. Os lançamentos novos ficam na tabela `decks_commander` (`supabase/decks_commander.sql`) e são somados a ela
- O botão "Atualizar decks" (só admin, no modo admin) roda no navegador: compara com o `DeckList.json` do MTGJSON, baixa só os decks novos, busca as cores na Scryfall e grava na tabela (`src/core/atualizarDecks.ts`)
- A página de decks é só do admin, no modo admin. Ao abrir um deck, `src/core/deckCompleto.ts` baixa as cartas do MTGJSON e separa por tipo; as imagens vêm da Scryfall. O cadastro de jogadores continua sugerindo decks para quem organiza
- O MTGJSON só lista os tokens da caixa de parte dos decks. Sem eles, o detalhe mostra os que as cartas do deck criam, consultados na Scryfall (`all_parts`), sem quantidade
- `scripts/atualizar_decks.py` mantém um acervo local com as listas completas e as imagens. Não é usado pelo site
- `src/core/coresMagic.ts` traz os nomes das combinações de cores (guildas, fragmentos, cunhas), usados no filtro de decks e no Analytics
- `src/core/colecoes.ts` traz o nome completo das coleções. As lançadas depois são buscadas no `SetList.json` do MTGJSON ao sincronizar
- O torneio guarda só o nome do deck; comandante e cores vêm da lista. Um deck fora dela é tratado como próprio
### Supabase

Credenciais em variáveis de ambiente, lidas no build. Localmente ficam em `.env.local` e, em produção, na Vercel (Production e Preview):
```bash
VITE_SUPABASE_URL=https://<projeto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_VAPID_PUBLIC_KEY=B...   # chave pública dos avisos da mesa (opcional)
```

O prefixo `VITE_` é obrigatório e coloca o valor no JavaScript enviado ao navegador. Por isso, use só a chave publishable e nunca `sb_secret` ou `service_role`. Depois de mudar uma variável na Vercel, é preciso fazer um novo deploy.

**Avisos da mesa (notificações)**: o jogador liga os avisos no menu da conta; o aparelho fica em `push_inscricoes` (`supabase/push_inscricoes.sql`). Ao iniciar a rodada, o app de quem organiza chama a função `avisar-mesas` (`supabase/functions/avisar-mesas`), que manda a mesa a quem tem "Mesas" liberado. As chaves saem de `npx web-push generate-vapid-keys`: a pública vai em `VITE_VAPID_PUBLIC_KEY`; a privada, só nos segredos das funções do Supabase (`VAPID_PRIVATE_KEY`, com `VAPID_PUBLIC_KEY` e `VAPID_SUBJECT`). O service worker mostra o aviso por `public/push-sw.js`. A mesma função manda "tempo extra" (acabou o tempo normal) e "último turno" (acabou o tempo extra: 1 turno para cada jogador) (pedidos pelo app de quem organiza, uma vez só por rodada, registrados em `avisos_enviados`), "torneio finalizado" e, aos admins, "nome aguardando aprovação". O admin escolhe quais tipos saem em Usuários → Avisos (`config_avisos`, em `supabase/config_avisos.sql`).

**Acesso aos torneios (RLS)**: admin vê e altera todos; organizador vê e altera os que criou; jogador só lê aqueles em que participa, e só depois que o admin aprova o nome (`usuarios_jogadores.aprovado`). Dono e pagamentos ficam em `torneio_privado`, que só admin e dono leem; ao participante vai `dados.premios`. Mudar quem é admin passa por `definir_papel_seguro`, que confere a senha no banco. Regras em `supabase/seguranca_v2.sql` e `supabase/corrigir_papel_email.sql`; para revisar, rode `supabase/auditoria_rls.sql`.

**Tabelas**:
- `admins (user_id uuid PK, email text)`
- `organizadores (user_id uuid PK)`
- `usuarios_jogadores (user_id uuid, nome_jogador text UNIQUE)`
- `torneios (id uuid PK, user_id uuid, nome text, dados jsonb, atualizado_em timestamptz)` — JSONB storage pattern

**Função principal** `eh_admin()` — SECURITY DEFINER, usada em RLS policies.

**RPCs**:
- `listar_usuarios()` — retorna todos com flags eh_admin/eh_organizador + nomes vinculados
- `definir_papel(user_id, eh_admin, eh_organizador)` — toggle de papéis
- `admin_deletar_usuario(user_id)` — DELETE em `auth.users` (bloqueia auto-delete)

**Reset de senha**: `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })`

### Autenticação — gotchas

- **Email signups** precisam estar habilitados em Supabase → Authentication → Sign In/Providers (ON)
- **Confirm email** está desligado (SMTP interno do Supabase Free tem limite de 2-4 emails/hora)
- **Nunca criar usuários via INSERT direto em auth.users** — quebra o GoTrue. Usar o signup normal ou `crypt('senha', gen_salt('bf'))` + inserir também em `auth.identities`
- Signup faz auto-login
- Modal "Qual seu nome?" só abre com `auth.perfilCarregado === true` (evita falso-positivo durante fetch)

---

## Convenções

- **Autocomplete**: usar `onMouseDown` (NÃO `onClick`) com `e.preventDefault()` + lógica de seleção DENTRO do mesmo handler — evita conflito com blur do input
- **Importar backup**: 3 casos — ID novo adiciona; mesmo ID+nome sobrescreve; mesmo ID+nome diferente vira novo ID com sufixo `_imp_timestamp`
- **Confirmações**: sempre o helper `confirmar()` de `components/ui`, nunca a janela do navegador
- **Valores e contagens**: `core/formato.ts` (`formatarReais`, `formatarPercentual`, `contar`)
- **Botões**: texto só com a inicial maiúscula. Primário (dourado) para a ação principal, sucesso para iniciar ou aprovar, aviso para refazer, perigo para apagar, `btn-info` para ação secundária e `btn-ghost` para neutra
- **Termos**: "Excluir" apaga de vez (torneio, usuário); "Remover" tira de uma lista (jogador, nome)
- **Cores**: usar as variáveis de `index.css`. Valores fixos só para símbolos de Magic, sorteios e onde a cor recebe transparência no código
- **Tabelas**: cabeçalho com a classe `tabela-cab`
- **Deletar admin**: bloquear auto-delete (`user_id === auth.session?.user?.id`)
- **Idioma**: português brasileiro em labels e código
- **Commits**: em inglês, no padrão Conventional Commits (`fix(auth): ...`)
- **Celular** (abaixo de 768 px): a navegação fica em `ui/BarraInferior.tsx`, e Novo torneio vira um botão redondo. Dentro de um torneio ficam só as abas dele
- **Ações do torneio**: clicar no card abre o torneio. Editar, exportar e excluir ficam em ícones no próprio card, só para quem edita
- **Ícones**: a barra e os títulos usam `components/ui/Icones.tsx`, em ouro antigo. Coroa é admin, alvo é organizador e pessoa é jogador. Emojis ficam nas conquistas, nas medalhas e nas mensagens

---

## Problemas conhecidos resolvidos (referência)

- Vercel build "✓ 2 modules transformed" → pasta `src/` não subiu no GitHub (arrastar a pasta inteira, não arquivos soltos)
- Torneios de outros users vazavam → sync agora SUBSTITUI em vez de mesclar
- "Database error querying schema" no login de usuários teste → tinham sido criados via INSERT direto. Recriar com `crypt()` + registro em `auth.identities`
- Autocomplete não selecionava → onClick disparava depois de onMouseDown esvaziar sugestões. Fix: seleção dentro do onMouseDown

---

## Para continuar o trabalho

Qualquer novo agente que pegar esse projeto:

1. Lê esse README inteiro antes de abrir qualquer arquivo
2. Confere as tabelas no Supabase (`admins`, `organizadores`, `usuarios_jogadores`, `torneios`) e a função `eh_admin()`
3. Cria o `.env.local` (veja a seção Supabase); `npm install && npm run dev` roda local em `http://localhost:5173`
4. Mudanças em `src/` → `npm run build` → commit → push → Vercel autodeploys
5. Pra testar offline: `npm run build:single` gera `dist-single/index.html` que roda abrindo direto no browser
6. Estrutura do banco: `supabase/exportar_schema.sql` gera o `supabase/schema.sql`; atualize quando mudar tabelas, policies ou funções
