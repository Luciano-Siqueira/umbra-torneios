#!/usr/bin/env python3
"""Mantém um acervo local dos decks de Commander: listas, cores e imagens das cartas.

Fontes: MTGJSON (decks) e Scryfall (cores e imagens).
O botão "Atualizar decks" do site não usa este script. Ele serve para guardar as
listas completas e as imagens, que depois podem alimentar a aba de decks.

Instalação:
    pip install requests
    pip install pandas openpyxl    (opcional, só para gerar o Excel)

Uso:
    python scripts/atualizar_decks.py                     atualiza tudo
    python scripts/atualizar_decks.py --sem-imagens       só as listas e o catálogo
    python scripts/atualizar_decks.py --limite-imagens 20 baixa poucas imagens, para testar
    python scripts/atualizar_decks.py --so-imagens        só as imagens que faltam
"""
import argparse
import csv
import json
import os
import sys
import tempfile
import time
import zipfile
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import quote

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

MTGJSON_ZIP_URL = "https://mtgjson.com/api/v5/AllDeckFiles.zip"
SCRYFALL = "https://api.scryfall.com"
USER_AGENT = "UmbraTorneios-DeckArchive/2.0"
TEMPO_LIMITE = (10, 120)  # segundos para conectar e para receber
INTERVALO_SCRYFALL = 0.12  # a Scryfall pede de 50 a 100 ms entre as chamadas
LOTE_SCRYFALL = 75
TAMANHO_BLOCO = 1024 * 1024
ORDEM_CORES = "WUBRG"
# Se a mesma carta aparece em mais de um lugar, a imagem fica na pasta de maior prioridade
PRIORIDADE_BOARD = {"Commander": 0, "Mainboard": 1, "Sideboard": 2, "Token": 3}
CAMPOS_CSV = [
    "deck_year", "deck_set", "deck_name", "board_type", "card_name",
    "quantity", "card_setCode", "card_number", "is_foil",
]
NOMES_RESERVADOS = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}


class Acervo:
    """Caminhos do acervo a partir da pasta base."""

    def __init__(self, base: Path):
        self.base = base
        self.json_dir = base / "01_DECKLISTS_JSON"
        self.csv_dir = base / "02_DECKLISTS_CSV"
        self.metadata_dir = base / "06_METADATA"
        self.csv_cartas = self.csv_dir / "all_commander_cards.csv"
        self.catalogo = self.metadata_dir / "catalog.json"
        self.cache_cores = self.metadata_dir / "cores_cache.json"
        self.falhas_imagens = self.metadata_dir / "imagens_falhas.csv"
        self.excel = base / "all_commander_precons.xlsx"
        self.pastas_imagens = {
            "Mainboard": base / "03_CARD_IMAGES",
            "Sideboard": base / "03_CARD_IMAGES",
            "Commander": base / "04_COMMANDER_IMAGES",
            "Token": base / "05_TOKENS",
        }

    def criar_pastas(self):
        for pasta in (self.json_dir, self.csv_dir, self.metadata_dir, *self.pastas_imagens.values()):
            pasta.mkdir(parents=True, exist_ok=True)


def criar_sessao() -> requests.Session:
    """Repete erros temporários e respeita o tempo de espera pedido pelo servidor (429)."""
    sessao = requests.Session()
    sessao.headers.update({"User-Agent": USER_AGENT, "Accept": "*/*"})
    repeticao = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "POST"],
        respect_retry_after_header=True,
    )
    sessao.mount("https://", HTTPAdapter(max_retries=repeticao))
    return sessao


class Limitador:
    """Garante o intervalo mínimo entre as chamadas à Scryfall."""

    def __init__(self, intervalo: float = INTERVALO_SCRYFALL):
        self.intervalo = intervalo
        self.ultima = 0.0

    def aguardar(self):
        espera = self.intervalo - (time.monotonic() - self.ultima)
        if espera > 0:
            time.sleep(espera)
        self.ultima = time.monotonic()


@contextmanager
def escrita_atomica(destino: Path, modo: str = "w", **opcoes):
    """Só substitui o arquivo quando termina: uma interrupção não deixa arquivo pela metade."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    descritor, temporario = tempfile.mkstemp(dir=destino.parent, suffix=".tmp")
    try:
        with os.fdopen(descritor, modo, **opcoes) as arquivo:
            yield arquivo
        os.replace(temporario, destino)
    except BaseException:
        if os.path.exists(temporario):
            os.unlink(temporario)
        raise


def nome_seguro(nome: str) -> str:
    limpo = "".join(c for c in nome if c.isalnum() or c in " -_").strip()[:120].strip()
    if not limpo:
        return "sem_nome"
    return f"_{limpo}" if limpo.upper() in NOMES_RESERVADOS else limpo


def baixar_pacote(sessao: requests.Session, pasta: Path) -> Path:
    """Grava em disco, sem carregar o pacote inteiro na memória."""
    destino = pasta / "AllDeckFiles.zip"
    with sessao.get(MTGJSON_ZIP_URL, stream=True, timeout=TEMPO_LIMITE) as resposta:
        resposta.raise_for_status()
        recebido = 0
        with destino.open("wb") as arquivo:
            for bloco in resposta.iter_content(TAMANHO_BLOCO):
                arquivo.write(bloco)
                recebido += len(bloco)
                print(f"\r  {recebido / TAMANHO_BLOCO:.0f} MB", end="", flush=True)
    print()
    return destino


def ler_decks_commander(caminho_zip: Path):
    """Um arquivo com defeito no pacote é avisado e não interrompe os demais."""
    with zipfile.ZipFile(caminho_zip) as pacote:
        for nome in pacote.namelist():
            if not nome.endswith(".json"):
                continue
            try:
                with pacote.open(nome) as arquivo:
                    deck = json.load(arquivo).get("data", {})
            except (json.JSONDecodeError, UnicodeDecodeError) as erro:
                print(f"  Aviso: {nome} ignorado ({erro})")
                continue
            if "Commander" in deck.get("type", ""):
                yield deck


def linhas_de_cartas(deck: dict) -> list[dict]:
    ano = deck.get("releaseDate", "0000")[:4]
    linhas = []
    for campo, board in (("commander", "Commander"), ("mainBoard", "Mainboard"),
                         ("sideBoard", "Sideboard"), ("tokens", "Token")):
        for carta in deck.get(campo) or []:
            linhas.append({
                "deck_year": ano,
                "deck_set": deck.get("code", "UNK"),
                "deck_name": deck.get("name", "Unknown Deck"),
                "board_type": board,
                "card_name": carta.get("name", ""),
                "quantity": carta.get("count", 1),
                "card_setCode": carta.get("setCode", ""),
                "card_number": carta.get("number", ""),
                "is_foil": carta.get("isFoil", False),
            })
    return linhas


def frente(nome_carta: str) -> str:
    return nome_carta.split(" // ")[0].strip()


def item_do_catalogo(deck: dict, cores: dict[str, list[str]]) -> dict:
    comandantes = deck.get("commander") or []
    principais = comandantes + (deck.get("mainBoard") or [])
    identidade: set[str] = set()
    cores_conhecidas = bool(comandantes)
    for carta in comandantes:
        encontrada = cores.get(frente(carta["name"]).lower())
        if encontrada is None:
            cores_conhecidas = False
        else:
            identidade.update(encontrada)
    data = deck.get("releaseDate", "0000-00-00")
    return {
        "Ano": data[:4],
        "Lançamento": data,
        "Coleção": deck.get("code", "UNK"),
        "Nome do Deck": deck.get("name", "Unknown Deck"),
        "Comandante(s)": ", ".join(c.get("name", "") for c in comandantes),
        # None: a Scryfall não encontrou. Texto vazio: comandante incolor
        "Cores": "".join(c for c in ORDEM_CORES if c in identidade) if cores_conhecidas else None,
        "Qtd Cartas": sum(c.get("count", 1) for c in principais),
        "Qtd Tokens": sum(c.get("count", 1) for c in deck.get("tokens") or []),
    }


def buscar_cores(sessao, limitador: Limitador, nomes: set[str], cache_arquivo: Path) -> dict[str, list[str]]:
    """Consulta só o que não está no cache: a identidade de cor de uma carta não muda."""
    cache: dict[str, list[str]] = {}
    if cache_arquivo.exists():
        cache = json.loads(cache_arquivo.read_text(encoding="utf-8"))

    faltando = sorted(n for n in nomes if n.lower() not in cache)
    for inicio in range(0, len(faltando), LOTE_SCRYFALL):
        lote = faltando[inicio:inicio + LOTE_SCRYFALL]
        limitador.aguardar()
        resposta = sessao.post(
            f"{SCRYFALL}/cards/collection",
            json={"identifiers": [{"name": n} for n in lote]},
            timeout=TEMPO_LIMITE,
        )
        resposta.raise_for_status()
        dados = resposta.json()
        for carta in dados.get("data", []):
            cache[frente(carta["name"]).lower()] = carta.get("color_identity", [])
        for ausente in dados.get("not_found", []):
            print(f"  Aviso: {ausente.get('name')} não encontrada na Scryfall")

    with escrita_atomica(cache_arquivo, encoding="utf-8") as arquivo:
        json.dump(cache, arquivo, indent=1, ensure_ascii=False, sort_keys=True)
    return cache


def gravar_excel(catalogo: list[dict], destino: Path):
    try:
        import pandas as pd
    except ImportError:
        print("  Excel não gerado: instale pandas e openpyxl para ter esse arquivo.")
        return
    try:
        pd.DataFrame(catalogo).to_excel(destino, index=False, engine="openpyxl")
    except (ImportError, ValueError, PermissionError) as erro:
        # Comum no Windows, com a planilha aberta: não invalida o restante
        print(f"  Excel não gerado: {erro}")


def construir_base(sessao, limitador: Limitador, acervo: Acervo) -> bool:
    print("\n--- FASE 1: LISTAS E CATÁLOGO ---")
    print("Baixando o pacote de decks do MTGJSON...")
    try:
        with tempfile.TemporaryDirectory() as pasta:
            caminho = baixar_pacote(sessao, Path(pasta))
            decks = list(ler_decks_commander(caminho))
    except (requests.RequestException, zipfile.BadZipFile) as erro:
        print(f"Erro ao baixar o pacote: {erro}")
        return False
    if not decks:
        # Mantém o catálogo anterior em vez de trocá-lo por um vazio
        print("Nenhum deck de Commander no pacote. Nada foi alterado.")
        return False

    nomes = {frente(c["name"]) for d in decks for c in d.get("commander") or [] if c.get("name")}
    print(f"Buscando as cores de {len(nomes)} comandantes...")
    try:
        cores = buscar_cores(sessao, limitador, nomes, acervo.cache_cores)
    except requests.RequestException as erro:
        print(f"Erro ao consultar a Scryfall: {erro}")
        return False

    linhas: list[dict] = []
    catalogo: list[dict] = []
    usados: set[str] = set()
    for deck in decks:
        data = deck.get("releaseDate", "0000-00-00")
        base = f"{data[:4]}_{deck.get('code', 'UNK')}_{nome_seguro(deck.get('name', 'Unknown Deck'))}"
        nome_arquivo, n = base, 1
        while nome_arquivo in usados:  # Nomes diferentes podem ficar iguais depois de limpos
            n += 1
            nome_arquivo = f"{base}_{n}"
        usados.add(nome_arquivo)
        with escrita_atomica(acervo.json_dir / f"{nome_arquivo}.json", encoding="utf-8") as arquivo:
            json.dump(deck, arquivo, indent=2, ensure_ascii=False)
        linhas.extend(linhas_de_cartas(deck))
        catalogo.append(item_do_catalogo(deck, cores))

    with escrita_atomica(acervo.csv_cartas, newline="", encoding="utf-8") as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=CAMPOS_CSV)
        escritor.writeheader()
        escritor.writerows(linhas)

    catalogo.sort(key=lambda d: (d["Lançamento"], d["Coleção"], d["Nome do Deck"]))
    with escrita_atomica(acervo.catalogo, encoding="utf-8") as arquivo:
        json.dump(catalogo, arquivo, indent=2, ensure_ascii=False)
    gravar_excel(catalogo, acervo.excel)

    sem_cores = [d["Nome do Deck"] for d in catalogo if d["Cores"] is None]
    print(f"✓ {len(catalogo)} decks e {len(linhas)} cartas catalogados.")
    if sem_cores:
        print(f"  Sem cores: {', '.join(sem_cores)}")
    return True


def cartas_unicas(acervo: Acervo) -> list[dict]:
    unicas: dict[str, dict] = {}
    with acervo.csv_cartas.open(encoding="utf-8", newline="") as arquivo:
        for linha in csv.DictReader(arquivo):
            set_code = linha["card_setCode"].strip().lower()
            numero = linha["card_number"].strip().lower()
            nome = linha["card_name"].strip()
            board = linha["board_type"]
            chave = f"{set_code}_{numero or nome}"
            atual = unicas.get(chave)
            if atual is None or PRIORIDADE_BOARD.get(board, 9) < PRIORIDADE_BOARD.get(atual["board"], 9):
                unicas[chave] = {"set": set_code, "numero": numero, "nome": nome, "board": board}
    return list(unicas.values())


def caminho_da_imagem(acervo: Acervo, carta: dict) -> Path:
    pasta = acervo.pastas_imagens.get(carta["board"], acervo.pastas_imagens["Mainboard"])
    return pasta / f"{carta['set']}_{nome_seguro(carta['numero'])}_{nome_seguro(carta['nome'])}"


def imagem_ja_existe(base: Path) -> bool:
    return base.with_name(f"{base.name}.jpg").exists() or base.with_name(f"{base.name}_front.jpg").exists()


def buscar_carta(sessao, limitador: Limitador, carta: dict) -> dict | None:
    """Do mais exato para o menos exato. Sem busca aproximada, que pode trazer outra carta."""
    tentativas = []
    if carta["numero"]:
        tentativas.append((f"{SCRYFALL}/cards/{quote(carta['set'], safe='')}/{quote(carta['numero'], safe='')}", None))
    tentativas.append((f"{SCRYFALL}/cards/named", {"exact": carta["nome"], "set": carta["set"]}))
    tentativas.append((f"{SCRYFALL}/cards/named", {"exact": frente(carta["nome"])}))

    for url, parametros in tentativas:
        limitador.aguardar()
        resposta = sessao.get(url, params=parametros, timeout=TEMPO_LIMITE)
        if resposta.status_code == 200:
            return resposta.json()
        if resposta.status_code != 404:
            resposta.raise_for_status()
    return None


def urls_da_carta(dados: dict) -> list[tuple[str, str]]:
    """Lista de (sufixo do arquivo, endereço). Cartas de duas faces têm uma imagem por face."""
    uris = dados.get("image_uris")
    if uris:
        url = uris.get("large") or uris.get("normal")
        return [("", url)] if url else []
    faces = []
    for i, face in enumerate(dados.get("card_faces") or []):
        uris = face.get("image_uris") or {}
        url = uris.get("large") or uris.get("normal")
        if url:
            faces.append(("_front" if i == 0 else "_back", url))
    return faces


def baixar_imagem(sessao, url: str, destino: Path) -> bool:
    """Confere se veio mesmo uma imagem, para não gravar uma página de erro como .jpg."""
    with sessao.get(url, stream=True, timeout=TEMPO_LIMITE) as resposta:
        if resposta.status_code != 200 or not resposta.headers.get("Content-Type", "").startswith("image/"):
            return False
        with escrita_atomica(destino, "wb") as arquivo:
            for bloco in resposta.iter_content(64 * 1024):
                arquivo.write(bloco)
    return True


def baixar_imagens(sessao, limitador: Limitador, acervo: Acervo, limite: int | None = None) -> int:
    print("\n--- FASE 2: IMAGENS ---")
    if not acervo.csv_cartas.exists():
        print("Falta o catálogo de cartas. Rode sem --so-imagens primeiro.")
        return 1

    pendentes = [c for c in cartas_unicas(acervo) if not imagem_ja_existe(caminho_da_imagem(acervo, c))]
    if not pendentes:
        print("✓ Todas as imagens já estão baixadas.")
        return 0
    total_pendente = len(pendentes)
    if limite is not None:
        pendentes = pendentes[:limite]
    print(f"{total_pendente} imagens faltando. Baixando {len(pendentes)}...")

    falhas: list[dict] = []
    baixadas = 0
    for indice, carta in enumerate(pendentes, start=1):
        print(f"[{indice}/{len(pendentes)}] {carta['nome']} ({carta['set'].upper()})... ", end="", flush=True)
        motivo = None
        try:
            dados = buscar_carta(sessao, limitador, carta)
            urls = urls_da_carta(dados) if dados else []
            if not dados:
                motivo = "carta não encontrada"
            elif not urls:
                motivo = "carta sem imagem"
            else:
                base = caminho_da_imagem(acervo, carta)
                ok = [baixar_imagem(sessao, url, base.with_name(f"{base.name}{sufixo}.jpg")) for sufixo, url in urls]
                if not all(ok):
                    motivo = "falha ao baixar a imagem"
        except requests.RequestException as erro:
            motivo = str(erro)

        if motivo:
            print(f"FALHOU ({motivo})")
            falhas.append({**carta, "motivo": motivo})
        else:
            print("OK")
            baixadas += 1

    # Sempre reescrito, para refletir só o que continua faltando
    with escrita_atomica(acervo.falhas_imagens, newline="", encoding="utf-8") as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=["set", "numero", "nome", "board", "motivo"])
        escritor.writeheader()
        escritor.writerows(falhas)

    print(f"\n✓ {baixadas} imagens baixadas, {len(falhas)} falhas.")
    if falhas:
        print(f"  Falhas em {acervo.falhas_imagens}. Rode de novo para tentar outra vez.")
    return 0


def ler_argumentos(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Atualiza o acervo local de decks de Commander.")
    parser.add_argument("--pasta", type=Path, default=Path("MTG_COMMANDER_ARCHIVE"), help="pasta do acervo")
    grupo = parser.add_mutually_exclusive_group()
    grupo.add_argument("--sem-imagens", action="store_true", help="só listas e catálogo")
    grupo.add_argument("--so-imagens", action="store_true", help="só as imagens que faltam")
    parser.add_argument("--limite-imagens", type=int, metavar="N", help="baixa no máximo N imagens")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    # O console do Windows pode não aceitar os símbolos das mensagens
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = ler_argumentos(argv)
    acervo = Acervo(args.pasta)
    acervo.criar_pastas()
    sessao = criar_sessao()
    limitador = Limitador()

    try:
        if not args.so_imagens and not construir_base(sessao, limitador, acervo):
            return 1
        if not args.sem_imagens:
            return baixar_imagens(sessao, limitador, acervo, args.limite_imagens)
    except KeyboardInterrupt:
        print("\nInterrompido. Rode de novo para continuar de onde parou.")
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
