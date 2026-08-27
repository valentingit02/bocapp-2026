#!/usr/bin/env python3
"""
fetch_data.py  -  Descarga el fixture real desde TheSportsDB y genera data/data.json
NO hay datos hardcodeados: todo se resuelve por la API.

Uso local:   python scripts/fetch_data.py
En GitHub:   lo corre solo el workflow .github/workflows/update-data.yml
"""

import json, os, sys, time, urllib.request, urllib.parse
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# CONFIG  (cambiá solo estas 3 cosas para adaptarlo a otro equipo)
# ---------------------------------------------------------------------------
API_KEY   = os.environ.get("TSDB_KEY", "3")          # "3" = clave de test gratuita
TEAM_NAME = os.environ.get("TEAM_NAME", "Boca Juniors")
COUNTRY   = os.environ.get("COUNTRY", "Argentina")   # para desambiguar homónimos

# Ligas/temporada a traer completas (id de liga en TheSportsDB, temporada)
# Estos IDs se auto-descubren por nombre más abajo; si falla, se ignora la liga.
SEASON = os.environ.get("SEASON", "2026")
LEAGUE_NAMES = [
    "Argentine Liga Profesional",
    "Argentine Primera Division",
    "Copa Argentina",
    "CONMEBOL Sudamericana",
    "Copa Sudamericana",
]

BASE = f"https://www.thesportsdb.com/api/v1/json/{API_KEY}"
OUT  = os.path.join(os.path.dirname(__file__), "..", "data", "data.json")


def get(url):
    """GET con reintentos simples y respeto del rate limit (max ~1 req/seg free)."""
    for intento in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "boca-pro/1.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.loads(r.read().decode("utf-8"))
            time.sleep(1.2)          # cortesía con la API gratuita
            return data
        except Exception as e:
            print(f"  ! error {e} (intento {intento+1})", file=sys.stderr)
            time.sleep(2)
    return {}


def buscar_equipo(nombre, pais):
    d = get(f"{BASE}/searchteams.php?t={urllib.parse.quote(nombre)}")
    teams = d.get("teams") or []
    if not teams:
        raise SystemExit(f"No se encontró el equipo '{nombre}'")
    t = next((x for x in teams if (x.get("strCountry") or "") == pais), teams[0])
    print(f"Equipo: {t['strTeam']}  (id {t['idTeam']}, liga {t.get('strLeague')})")
    return t


def descubrir_ligas():
    """Mapea nombre de liga -> idLeague usando el catálogo de ligas de la API."""
    ids = {}
    d = get(f"{BASE}/all_leagues.php")
    for lg in d.get("leagues") or []:
        nombre = lg.get("strLeague", "")
        for wanted in LEAGUE_NAMES:
            if wanted.lower() in nombre.lower():
                ids[nombre] = lg["idLeague"]
    print("Ligas detectadas:", ids)
    return ids


def eventos_temporada(id_liga, season):
    d = get(f"{BASE}/eventsseason.php?id={id_liga}&s={season}")
    return d.get("events") or []


def prox_equipo(id_team):
    d = get(f"{BASE}/eventsnext.php?id={id_team}")
    return d.get("events") or []


def ult_equipo(id_team):
    d = get(f"{BASE}/eventslast.php?id={id_team}")
    return d.get("results") or d.get("events") or []


def normalizar(ev, team_name):
    """Deja cada partido con un formato limpio y estable para el front."""
    home = ev.get("strHomeTeam", "")
    away = ev.get("strAwayTeam", "")
    liga = ev.get("strLeague", "")
    es_home = team_name.split()[0].lower() in home.lower()
    neutral = "copa argentina" in liga.lower()
    cond = "neutral" if neutral else ("local" if es_home else "visita")
    return {
        "id": ev.get("idEvent"),
        "liga": liga,
        "ligaBadge": ev.get("strLeagueBadge"),
        "home": home,
        "away": away,
        "homeBadge": ev.get("strHomeTeamBadge"),
        "awayBadge": ev.get("strAwayTeamBadge"),
        "homeScore": ev.get("intHomeScore"),
        "awayScore": ev.get("intAwayScore"),
        "date": ev.get("dateEvent"),
        "time": ev.get("strTime"),
        "timestamp": ev.get("strTimestamp"),
        "venue": ev.get("strVenue"),
        "round": ev.get("intRound"),
        "cond": cond,
        "status": ev.get("strStatus"),
        "postponed": ev.get("strPostponed"),
    }


def involucra(ev, team_name):
    n = team_name.split()[0].lower()
    return n in (ev.get("strHomeTeam", "") + ev.get("strAwayTeam", "")).lower()


def main():
    equipo = buscar_equipo(TEAM_NAME, COUNTRY)
    ligas  = descubrir_ligas()

    todos = {}   # dedup por idEvent

    # 1) Fixture completo de cada liga -> me quedo con los del equipo
    for nombre, idl in ligas.items():
        evs = eventos_temporada(idl, SEASON)
        print(f"  {nombre}: {len(evs)} eventos de temporada")
        for ev in evs:
            if involucra(ev, TEAM_NAME):
                todos[ev["idEvent"]] = ev

    # 2) Próximos y últimos del equipo (cubre lo que la liga aún no publicó)
    for ev in prox_equipo(equipo["idTeam"]) + ult_equipo(equipo["idTeam"]):
        todos[ev["idEvent"]] = ev

    partidos = [normalizar(ev, TEAM_NAME) for ev in todos.values()]
    partidos.sort(key=lambda p: (p["timestamp"] or p["date"] or "9999"))

    salida = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "team": {
            "id": equipo["idTeam"],
            "name": equipo["strTeam"],
            "badge": equipo.get("strBadge"),
            "stadium": equipo.get("strStadium"),
        },
        "season": SEASON,
        "count": len(partidos),
        "matches": partidos,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=2)
    print(f"OK -> {OUT}  ({len(partidos)} partidos)")


if __name__ == "__main__":
    main()
