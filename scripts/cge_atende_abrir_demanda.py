"""Abre demanda no CGE Atende para homologação do Jangada (não do portal ASESI).

Credenciais: CGE_ATENDE_CPF / CGE_ATENDE_SENHA em .env.local (Jangada) ou no .env do ASESI.
Nunca imprime senha nem CPF completo.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

ROOT = Path(__file__).resolve().parents[1]
ASESI = Path(r"C:\Users\francisco.gois\asesi")
sys.path.insert(0, str(ASESI / "scripts"))

for env_path in (ROOT / ".env.local", ROOT / ".env", ASESI / ".env"):
    load_dotenv(env_path, override=False)

from cge_atende_abrir_chamado import dump, login, require_creds, shot  # noqa: E402

TIPO_ID = "chamadoForm:tipoChamadoField:tiposelect"
CAT_ID = "chamadoForm:categoriaField:categoriaselect"
TITULO_ID = "chamadoForm:tituloFormField:tituloInput"
DESC_ID = "chamadoForm:descricaoFormField:descricaoInput"
SAVE_ID = "chamadoForm:saveHtml"

ASSUNTO = "JANGADA — Deploy em homologação (Swarm/Nexus/CI)"
DESCRICAO = """Solicitação EXCLUSIVA do sistema JANGADA (kanban ASESI/CGE).

Este chamado NÃO é do portal ASESI nem do Cacimba.

Solicitação para a equipe de Infraestrutura (Leonardo Borba):

Precisamos colocar o Jangada no ar em homologação, no mesmo padrão Swarm/Traefik/Nexus/CI das demais apps ASESI.

Dados do projeto:
- Sistema: Jangada (kanban, gestora virtual Maya, convites, board ASESI)
- GitLab: grupo g_asesi, projeto jangada
- Branch: homol
- Imagem Nexus esperada: jangada:homol
- Stack Swarm: homolog-jangada
- Host Traefik: homolog-jangada.cge.local
- Tipo: aplicação Next.js (Node 22)
- Health: rota api/health
- Banco: PostgreSQL operacional da ASESI (mesmo servidor do Farol), schema próprio isolado

Pendências:
1) Compartilhar o runner GitLab deploy2 com g_asesi/jangada (hoje está locked só no portal ASESI)
2) Publicar a imagem jangada no Nexus
3) DNS Traefik homolog-jangada.cge.local
4) Rede até o PostgreSQL ASESI e o LiteLLM
5) Arquivo de secrets no servidor, fora do git
6) Confirmar URL de homologação após o deploy

Solicitante: Francisco Nauber Bernardo Gois (francisco.gois)
Área: ASESI / CGE
"""

DRIVER = os.environ.get(
    "CHROMEDRIVER",
    r"C:\Users\francisco.gois\AppData\Local\Temp\chromedriver-151\chromedriver-win64\chromedriver.exe",
)


def select_by_contains(driver, select_id: str, *needles: str):
    sel = Select(driver.find_element(By.ID, select_id))
    print("OPTIONS", select_id, [o.text.strip() for o in sel.options])
    for o in sel.options:
        ot = o.text.strip().lower()
        if any(n.lower() in ot for n in needles):
            sel.select_by_visible_text(o.text)
            print("SELECTED", select_id, o.text)
            return o.text
    return None


def set_ckeditor(driver, text: str) -> None:
    escaped = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )
    ok = driver.execute_script(
        """
        const id = arguments[0];
        const html = arguments[1];
        try {
          if (window.CKEDITOR && CKEDITOR.instances[id]) {
            CKEDITOR.instances[id].setData(html);
            return 'ckeditor';
          }
        } catch (e) { return 'err:' + e; }
        const ta = document.getElementById(id);
        if (ta) { ta.value = html; return 'textarea'; }
        return 'missing';
        """,
        DESC_ID,
        escaped,
    )
    print("CKEDITOR", ok)


def fill_and_submit(driver, wait: WebDriverWait) -> dict:
    wait.until(EC.presence_of_element_located((By.ID, TIPO_ID)))
    time.sleep(1)
    select_by_contains(driver, TIPO_ID, "INFRAESTRUTURA")
    time.sleep(3)
    chosen = select_by_contains(driver, CAT_ID, "aplicações", "aplicacoes", "aplicação")
    time.sleep(2)
    titulo = driver.find_element(By.ID, TITULO_ID)
    titulo.clear()
    titulo.send_keys(ASSUNTO)
    print("TITULO_OK")
    set_ckeditor(driver, DESCRICAO)
    shot(driver, "jangada_filled")
    save = driver.find_element(By.ID, SAVE_ID)
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", save)
    time.sleep(0.5)
    driver.execute_script("arguments[0].click();", save)
    print("CLICKED_CADASTRAR")
    time.sleep(8)
    shot(driver, "jangada_after")
    dump(driver, "jangada_after")
    page = driver.page_source
    nums = re.findall(r"chamadoId=(\d+)", page, flags=re.I)
    nums += re.findall(r"(?:n[ºo°.]?\s*)?(?:chamado|demanda|protocolo)\s*[:#]?\s*(\d{5,})", page, flags=re.I)
    text = re.sub(r"\s+", " ", driver.find_element(By.TAG_NAME, "body").text)
    result = {
        "url": driver.current_url,
        "title": driver.title,
        "subcategoria": chosen,
        "assunto": ASSUNTO,
        "protocol_candidates": list(dict.fromkeys(nums))[:15],
        "has_jangada": "jangada" in text.lower(),
        "situacao": "SOLICITADO" if "solicitado" in text.lower() else None,
    }
    return result


def main() -> int:
    require_creds()
    opts = Options()
    opts.add_argument("--window-size=1400,1100")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    service = Service(DRIVER) if Path(DRIVER).exists() else None
    driver = webdriver.Chrome(service=service, options=opts) if service else webdriver.Chrome(options=opts)
    driver.set_script_timeout(90)
    wait = WebDriverWait(driver, 30)
    try:
        if not login(driver, wait):
            print("LOGIN_FAILED")
            return 3
        base = driver.current_url.split("/CGEAtende/")[0] + "/CGEAtende/"
        driver.get(base + "chamado.seam")
        time.sleep(3)
        result = fill_and_submit(driver, wait)
        out = Path(os.environ.get("TEMP", ROOT / "_tmp")) / "cge_atende_shot" / "ticket_result_jangada.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print("JANGADA_RESULT", json.dumps(result, ensure_ascii=False))
        return 0 if result.get("has_jangada") else 4
    finally:
        driver.quit()


if __name__ == "__main__":
    raise SystemExit(main())
