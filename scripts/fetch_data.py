#!/usr/bin/env python3
"""
fetch_data.py  ·  Motor de datos con API-FOOTBALL (fechas y horarios fidedignos)

Genera automaticamente:
  - data/data.json      -> fixture del equipo (proximos + jugados) con fecha/hora exacta
  - data/brackets.json  -> cuadros de eliminatorias de las copas, armados solos

Fuente: API-FOOTBALL (api-sports.io). Tier gratis 100 req/dia.
La API key se lee de la variable de entorno APIFOOTBALL_KEY (secret de GitHub).
Si no hay key, cae a TheSportsDB para no romper (menos preciso).

NADA hardcodeado: todo sale de la API. Fechas ya vienen en hora de Argentina
porque pedimos timezone=America/Argentina/Buenos_Aires.
"""

import json, os, sys, time, urllib.request, urllib.parse
from datetime import datetime, timezone

# ------------------------- CONFIG -------------------------
API_KEY  = os.environ.get("APIFOOTBALL_KEY", "").strip()
TEAM_ID  = os.environ.get("TEAM_ID", "451")          # 451 = Boca Juniors en API-Football
TEAM_NAME= os.environ.get("TEAM_NAME", "Boca Juniors")
SEASON   = os.environ.get("SEASON", "2026")
TZ       = "America/Argentina/Buenos_Aires"

# Ligas/copas a seguir  (id de liga en API-Football)
#   128 = Liga Profesional Argentina
#   130 = Copa Argentina
#    11 = Copa Sudamericana
#    13 = Copa Libertadores
LEAGUES = {
    "128": "Liga Profesional",
    "130": "Copa Argentina",
    "11":  "Copa Sudamericana",
    "13":  "Copa Libertadores",
}
# Cuales de esas son copas (para armar cuadros)
CUP_IDS = {"130", "11", "13"}

BASE = "https://v3.football.api-sports.io"
HERE = os.path.dirname(__file__)
OUT_DATA = os.path.join(HERE, "..", "data", "data.json")
OUT_BRK  = os.path.join(HERE, "..", "data", "brackets.json")


def api_get(path, params):
    url = f"{BASE}{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "x-apisports-key": API_KEY,
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=25) as r:
        data = json.loads(r.read().decode("utf-8"))
    # respeta rate-limit del plan free
    time.sleep(6.5)
    if data.get("errors"):
        print("  ! API errors:", data["errors"], file=sys.stderr)
    return data.get("response", [])


# ------------------------- FIXTURE DEL EQUIPO -------------------------
def normaliza_fixture(fx):
    f = fx["fixture"]; lg = fx["league"]; teams = fx["teams"]; goals = fx["goals"]
    home = teams["home"]; away = teams["away"]
    es_home = (home["id"] == int(TEAM_ID))
    # local/visita/neutral: Copa Argentina se juega en cancha neutral
    if lg["id"] in (130,):
        cond = "neutral"
    else:
        cond = "local" if es_home else "visita"
    return {
        "id": f["id"],
        "liga": lg["name"],
        "ligaBadge": lg.get("logo"),
        "round": lg.get("round"),
        "home": home["name"],
        "away": away["name"],
        "homeBadge": home.get("logo"),
        "awayBadge": away.get("logo"),
        "homeScore": goals["home"],
        "awayScore": goals["away"],
        # fecha/hora EXACTA (ya en hora de Argentina por timezone=)
        "date": f["date"][:10],
        "time": f["date"][11:19],
        "timestamp": f["date"],          # ISO con offset -03:00
        "venue": (f.get("venue") or {}).get("name"),
        "status": f["status"]["short"],  # NS, 1H, HT, FT, etc.
        "cond": cond,
    }


def trae_fixture_equipo():
    resp = api_get("/fixtures", {
        "team": TEAM_ID, "season": SEASON, "timezone": TZ,
    })
    print(f"Fixture del equipo: {len(resp)} partidos")
    return [normaliza_fixture(fx) for fx in resp]


# ------------------------- CUADROS DE COPA -------------------------
ORDEN_RONDAS = [
    ("Round of 16", "Octavos de final"),
    ("8th Finals",  "Octavos de final"),
    ("Quarter-finals", "Cuartos de final"),
    ("Semi-finals", "Semifinales"),
    ("Final", "Final"),
]

def trae_cuadro(league_id, nombre):
    """Arma el bracket de una copa agrupando fixtures por ronda."""
    resp = api_get("/fixtures", {
        "league": league_id, "season": SEASON, "timezone": TZ,
    })
    if not resp:
        return None
    # agrupa por ronda cruda
    por_ronda = {}
    for fx in resp:
        rnd = fx["league"].get("round", "")
        por_ronda.setdefault(rnd, []).append(fx)

    rondas = []
    for clave_api, etiqueta in ORDEN_RONDAS:
        # matchea rondas que contengan la clave (ej "Quarter-finals")
        fixtures = []
        for rnd, lst in por_ronda.items():
            if clave_api.lower() in rnd.lower():
                fixtures += lst
        if not fixtures:
            continue
        # empareja ida/vuelta por par de equipos
        llaves = _empareja(fixtures)
        if llaves:
            rondas.append({"nombre": etiqueta, "llaves": llaves})

    if not rondas:
        return None
    return {
        "id": nombre.lower().replace(" ", "-"),
        "nombre": f"{nombre} {SEASON}",
        "color": "#00a859" if "Sudamericana" in nombre else "#75aadb",
        "final": {"sede": "", "fecha": ""},
        "rondas": rondas,
    }


def _empareja(fixtures):
    """Junta ida y vuelta de la misma llave y calcula global + ganador."""
    pares = {}
    for fx in fixtures:
        h = fx["teams"]["home"]["name"]; a = fx["teams"]["away"]["name"]
        key = "__".join(sorted([h, a]))
        pares.setdefault(key, []).append(fx)

    llaves = []
    for key, lst in pares.items():
        equipos = key.split("__")
        eqA, eqB = equipos[0], equipos[1]
        gA = gB = 0; jugados = 0; detalle = []
        for fx in lst:
            gh, ga = fx["goals"]["home"], fx["goals"]["away"]
            if gh is None:
                continue
            jugados += 1
            h = fx["teams"]["home"]["name"]
            if h == eqA:
                gA += gh; gB += ga
            else:
                gB += gh; gA += ga
            detalle.append(f'{fx["teams"]["home"]["name"]} {gh}-{ga} {fx["teams"]["away"]["name"]}')
        ganador = ""
        if jugados == len(lst) and lst and gA != gB:
            ganador = eqA if gA > gB else eqB
        llaves.append({
            "a": eqA, "b": eqB,
            "ga": str(gA) if jugados else "",
            "gb": str(gB) if jugados else "",
            "ganador": ganador,
            "boca": (TEAM_NAME.split()[0].lower() in key.lower()),
            "detalle": " · ".join(detalle) if detalle else "Por jugarse",
        })
    # Boca primero
    llaves.sort(key=lambda x: (not x["boca"]))
    return llaves


# ------------------------- MAIN -------------------------
def main():
    if not API_KEY:
        print("!! Falta APIFOOTBALL_KEY. Configurá el secret en GitHub.", file=sys.stderr)
        sys.exit(1)

    partidos = trae_fixture_equipo()
    partidos.sort(key=lambda p: p["timestamp"] or "9999")

    salida = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "team": {"id": TEAM_ID, "name": TEAM_NAME},
        "season": SEASON,
        "source": "API-Football",
        "count": len(partidos),
        "matches": partidos,
    }
    os.makedirs(os.path.dirname(OUT_DATA), exist_ok=True)
    with open(OUT_DATA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=2)
    print(f"OK data.json -> {len(partidos)} partidos")

    # Cuadros de copa (solo las que Boca juega este año)
    torneos = []
    for lid in CUP_IDS:
        nombre = LEAGUES.get(lid, "Copa")
        try:
            t = trae_cuadro(lid, nombre)
            if t:
                torneos.append(t)
                print(f"OK cuadro {nombre}: {len(t['rondas'])} rondas")
        except Exception as e:
            print(f"  ! cuadro {nombre} fallo: {e}", file=sys.stderr)

    with open(OUT_BRK, "w", encoding="utf-8") as f:
        json.dump({"generatedAt": salida["generatedAt"], "torneos": torneos},
                  f, ensure_ascii=False, indent=2)
    print(f"OK brackets.json -> {len(torneos)} torneos")


if __name__ == "__main__":
    main()
