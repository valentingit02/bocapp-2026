#!/usr/bin/env python3
"""
fetch_data.py · Motor INTEGRAL con API-FOOTBALL

Trae, para las 4 competencias que juega Boca, TODOS los partidos (no solo los de Boca):
  128 = Liga Profesional     130 = Copa Argentina
   11 = Copa Sudamericana      13 = Copa Libertadores

Genera:
  data/fixtures.json   -> todos los partidos por competencia (fecha/hora exactas AR)
  data/standings.json  -> tablas (Liga por Zona A/B; copas por grupo)
  data/brackets.json   -> cuadros de copa (armados desde los fixtures) +
                          PROYECCION de playoffs de la Liga (calculada desde la tabla,
                          con criterios de desempate)
  data/stats.json      -> goleadores / asistidores / amarillas (Liga)
  data/live.json       -> partidos en vivo (1 request, para refresco horario)

Presupuesto de requests (plan free = 100/dia):
  MODE=full  -> ~10 requests (4 fixtures + 3 standings + 3 rankings)   [corre 4x/dia]
  MODE=live  -> 1 request  (/fixtures?live=all)                        [corre 20x/dia]
  Total aprox 4*10 + 20 = 60/dia. Comodo.
"""

import json, os, sys, time, urllib.request, urllib.parse
from datetime import datetime, timezone

API_KEY = os.environ.get("APIFOOTBALL_KEY", "").strip()
SEASON  = os.environ.get("SEASON", "2026")
TZ      = "America/Argentina/Buenos_Aires"
MODE    = os.environ.get("MODE", "full").strip().lower()
BOCA    = "boca"     # para resaltar

BASE = "https://v3.football.api-sports.io"
HERE = os.path.dirname(__file__)
D    = lambda f: os.path.join(HERE, "..", "data", f)

# Competencias (id -> meta). "cup"=True arma bracket; "groups"=True tiene fase de grupos.
COMPS = {
    "128": {"name": "Liga Profesional",  "cup": False, "groups": False, "color": "#75aadb", "liga": True},
    "130": {"name": "Copa Argentina",    "cup": True,  "groups": False, "color": "#75aadb"},
    "11":  {"name": "Copa Sudamericana", "cup": True,  "groups": True,  "color": "#00a859"},
    "13":  {"name": "Copa Libertadores", "cup": True,  "groups": True,  "color": "#c9302c"},
}
LIGA_ID = "128"

# Orden de rondas eliminatorias (clave API -> etiqueta ES)
ORDEN_RONDAS = [
    ("Preliminary", "Preliminar"),
    ("Play-off", "Repechaje"),
    ("Round of 32", "16avos"),
    ("Round of 16", "Octavos de final"),
    ("Quarter-finals", "Cuartos de final"),
    ("Semi-finals", "Semifinales"),
    ("Final", "Final"),
]

# Orden de cruces de playoff de la Liga (1A-8B, 2A-7B, ...) — bracket estándar
CRUCES_LIGA = [(1, 8), (4, 5), (2, 7), (3, 6)]


def api_get(path, params):
    url = f"{BASE}{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"x-apisports-key": API_KEY, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode("utf-8"))
    time.sleep(6.5)   # respeta rate-limit del plan free
    if data.get("errors"):
        print("  ! API errors:", data["errors"], file=sys.stderr)
    return data.get("response", [])


def es_boca(nombre):
    return BOCA in (nombre or "").lower()


# ---------------------------------------------------------------- FIXTURES
def norm_fx(fx):
    f = fx["fixture"]; lg = fx["league"]; t = fx["teams"]; g = fx["goals"]
    neutral = (str(lg["id"]) == "130")   # Copa Argentina = cancha neutral
    return {
        "id": f["id"],
        "compId": str(lg["id"]),
        "liga": lg["name"],
        "ligaLogo": lg.get("logo"),
        "round": lg.get("round"),
        "home": t["home"]["name"], "away": t["away"]["name"],
        "homeId": t["home"]["id"], "awayId": t["away"]["id"],
        "homeLogo": t["home"].get("logo"), "awayLogo": t["away"].get("logo"),
        "homeScore": g["home"], "awayScore": g["away"],
        "date": f["date"][:10], "time": f["date"][11:19], "timestamp": f["date"],
        "venue": (f.get("venue") or {}).get("name"),
        "status": f["status"]["short"],
        "neutral": neutral,
        "boca": es_boca(t["home"]["name"]) or es_boca(t["away"]["name"]),
    }


def trae_fixtures():
    comps = []
    for cid, meta in COMPS.items():
        resp = api_get("/fixtures", {"league": cid, "season": SEASON, "timezone": TZ})
        partidos = [norm_fx(fx) for fx in resp]
        partidos.sort(key=lambda p: p["timestamp"] or "9999")
        comps.append({"id": cid, "name": meta["name"], "color": meta["color"],
                      "count": len(partidos), "matches": partidos})
        print(f"OK fixtures {meta['name']}: {len(partidos)} partidos")
    return comps


# ---------------------------------------------------------------- STANDINGS
def norm_row(row):
    return {
        "pos": row["rank"], "equipo": row["team"]["name"], "logo": row["team"]["logo"],
        "pj": row["all"]["played"], "g": row["all"]["win"], "e": row["all"]["draw"],
        "p": row["all"]["lose"], "gf": row["all"]["goals"]["for"],
        "gc": row["all"]["goals"]["against"], "dg": row["goalsDiff"],
        "pts": row["points"], "forma": row.get("form"),
        "boca": es_boca(row["team"]["name"]),
    }


def trae_standings():
    ligas = []
    for cid, meta in COMPS.items():
        if not (meta.get("liga") or meta.get("groups")):
            continue
        resp = api_get("/standings", {"league": cid, "season": SEASON})
        if not resp:
            continue
        grupos = {}
        for bloque in resp[0]["league"]["standings"]:
            for row in bloque:
                gname = row.get("group", meta["name"])
                grupos.setdefault(gname, []).append(norm_row(row))
        ligas.append({"id": cid, "name": meta["name"],
                      "grupos": [{"grupo": g, "filas": fs} for g, fs in grupos.items()]})
        print(f"OK standings {meta['name']}: {len(grupos)} grupo(s)")
    return ligas


# ---------------------------------------------------------------- BRACKETS (copas)
def empareja(fixtures):
    pares = {}
    for fx in fixtures:
        h, a = fx["teams"]["home"]["name"], fx["teams"]["away"]["name"]
        pares.setdefault("__".join(sorted([h, a])), []).append(fx)
    llaves = []
    for key, lst in pares.items():
        eqA, eqB = key.split("__")
        gA = gB = jug = 0; det = []
        for fx in lst:
            gh, ga = fx["goals"]["home"], fx["goals"]["away"]
            if gh is None:
                continue
            jug += 1
            if fx["teams"]["home"]["name"] == eqA:
                gA += gh; gB += ga
            else:
                gB += gh; gA += ga
            det.append(f'{fx["teams"]["home"]["name"]} {gh}-{ga} {fx["teams"]["away"]["name"]}')
        ganador = ""
        if lst and jug == len(lst) and gA != gB:
            ganador = eqA if gA > gB else eqB
        llaves.append({"a": eqA, "b": eqB,
                       "ga": str(gA) if jug else "", "gb": str(gB) if jug else "",
                       "ganador": ganador, "boca": es_boca(key),
                       "detalle": " · ".join(det) if det else "Por jugarse"})
    llaves.sort(key=lambda x: (not x["boca"]))
    return llaves


def cuadro_copa(cid, meta, fixtures_comp):
    por_ronda = {}
    for fx in fixtures_comp:
        por_ronda.setdefault(fx["round"] or "", []).append(fx)
    rondas = []
    for clave, etiqueta in ORDEN_RONDAS:
        fxs = [fx for rnd, lst in por_ronda.items() if clave.lower() in rnd.lower() for fx in lst]
        if not fxs:
            continue
        llaves = empareja(fxs)
        if llaves:
            rondas.append({"nombre": etiqueta, "llaves": llaves})
    if not rondas:
        return None
    return {"id": meta["name"].lower().replace(" ", "-"), "nombre": f'{meta["name"]} {SEASON}',
            "color": meta["color"], "tipo": "copa", "rondas": rondas}


# -------------------------------------- PROYECCION PLAYOFFS LIGA (calculada)
def desempata(filas):
    """Ordena una zona con criterios: pts -> dif de gol -> goles a favor."""
    return sorted(filas, key=lambda r: (-r["pts"], -r["dg"], -r["gf"]))


def proyeccion_liga(standings_ligas):
    liga = next((l for l in standings_ligas if l["id"] == LIGA_ID), None)
    if not liga or len(liga["grupos"]) < 2:
        return None
    zonas = {g["grupo"]: desempata(g["filas"]) for g in liga["grupos"]}
    nombres = list(zonas.keys())
    zA, zB = zonas[nombres[0]], zonas[nombres[1]]

    def clasif(z):  # top 8 con puesto
        return [{**r, "seed": i + 1} for i, r in enumerate(z[:8])]
    cA, cB = clasif(zA), clasif(zB)

    def llave(seedLocal, top, other, otherSeed):
        loc = next((x for x in top if x["seed"] == seedLocal), None)
        vis = next((x for x in other if x["seed"] == otherSeed), None)
        if not loc or not vis:
            return None
        return {"a": f'{loc["seed"]}° {loc["equipo"]}', "b": f'{vis["seed"]}° {vis["equipo"]}',
                "ga": "", "gb": "", "ganador": "",
                "boca": es_boca(loc["equipo"]) or es_boca(vis["equipo"]),
                "detalle": "Local: mejor clasificado"}

    octavos = []
    # Llave A: locales de Zona A vs visitantes Zona B
    for sl, sv in CRUCES_LIGA:
        k = llave(sl, cA, cB, sv)
        if k: octavos.append(k)
    # Llave B: locales de Zona B vs visitantes Zona A
    for sl, sv in CRUCES_LIGA:
        k = llave(sl, cB, cA, sv)
        if k: octavos.append(k)

    if not octavos:
        return None
    # rondas siguientes vacias (se completan en el simulador del front)
    vac = lambda n: [{"a": "", "b": "", "ganador": "", "detalle": ""} for _ in range(n)]
    return {
        "id": "liga-playoffs", "nombre": f"Liga Profesional {SEASON} · Playoffs (proyección)",
        "color": "#75aadb", "tipo": "liga-proy",
        "nota": "Proyección según la tabla actual (pts → dif. gol → goles a favor). Se recalcula sola.",
        "rondas": [
            {"nombre": "Octavos (proyectado)", "llaves": octavos},
            {"nombre": "Cuartos", "llaves": vac(4)},
            {"nombre": "Semifinales", "llaves": vac(2)},
            {"nombre": "Final", "llaves": vac(1)},
        ],
    }


# ---------------------------------------------------------------- RANKINGS
def _fila_pl(item, campo):
    pl = item["player"]; st = item["statistics"][0]
    if campo == "goles":  val = st["goals"]["total"] or 0
    elif campo == "asist": val = st["goals"]["assists"] or 0
    else:                  val = st["cards"]["yellow"] or 0
    return {"jugador": pl["name"], "foto": pl.get("photo"),
            "equipo": st["team"]["name"], "logoEquipo": st["team"].get("logo"),
            "valor": val, "partidos": st["games"].get("appearences") or 0,
            "boca": es_boca(st["team"]["name"])}


def trae_rankings():
    out = {}
    for path, campo, clave in [("topscorers", "goles", "goleadores"),
                               ("topassists", "asist", "asistidores"),
                               ("topyellowcards", "amaril", "amarillas")]:
        try:
            resp = api_get(f"/players/{path}", {"league": LIGA_ID, "season": SEASON})
            out[clave] = [_fila_pl(it, campo) for it in resp][:20]
            print(f"OK {clave}: {len(out[clave])}")
        except Exception as e:
            print(f"  ! {clave}: {e}", file=sys.stderr); out[clave] = []
    return out


# ---------------------------------------------------------------- LIVE
def trae_live():
    ids = set(COMPS.keys())
    resp = api_get("/fixtures", {"live": "all", "timezone": TZ})
    vivos = [norm_fx(fx) for fx in resp if str(fx["league"]["id"]) in ids]
    print(f"OK live: {len(vivos)} en vivo (de nuestras ligas)")
    return vivos


# ---------------------------------------------------------------- MAIN
def main():
    if not API_KEY:
        print("!! Falta APIFOOTBALL_KEY", file=sys.stderr); sys.exit(1)
    now = datetime.now(timezone.utc).isoformat()

    if MODE == "live":
        vivos = trae_live()
        with open(D("live.json"), "w", encoding="utf-8") as f:
            json.dump({"generatedAt": now, "matches": vivos}, f, ensure_ascii=False, indent=2)
        print("MODE=live listo (1 request).")
        return

    # ---- MODE=full ----
    comps = trae_fixtures()
    with open(D("fixtures.json"), "w", encoding="utf-8") as f:
        json.dump({"generatedAt": now, "season": SEASON, "competencias": comps},
                  f, ensure_ascii=False, indent=2)

    ligas_tabla = trae_standings()
    with open(D("standings.json"), "w", encoding="utf-8") as f:
        json.dump({"generatedAt": now, "ligas": ligas_tabla}, f, ensure_ascii=False, indent=2)

    # Cuadros de copa (desde los fixtures ya bajados; sin requests extra)
    fx_by_comp = {c["id"]: c["matches"] for c in comps}
    # necesitamos el objeto crudo para round -> re-bajamos? No: usamos matches normalizados
    torneos = []
    for cid, meta in COMPS.items():
        if not meta.get("cup"):
            continue
        # reconstruyo estructura minima para cuadro_copa a partir de normalizados
        crudos = [{"league": {"round": m["round"]},
                   "teams": {"home": {"name": m["home"]}, "away": {"name": m["away"]}},
                   "goals": {"home": m["homeScore"], "away": m["awayScore"]}}
                  for m in fx_by_comp.get(cid, [])]
        t = cuadro_copa(cid, meta, crudos)
        if t:
            torneos.append(t); print(f"OK cuadro {meta['name']}")

    proy = proyeccion_liga(ligas_tabla)
    if proy:
        torneos.insert(0, proy); print("OK proyección playoffs Liga")

    with open(D("brackets.json"), "w", encoding="utf-8") as f:
        json.dump({"generatedAt": now, "torneos": torneos}, f, ensure_ascii=False, indent=2)

    try:
        rk = trae_rankings()
        with open(D("stats.json"), "w", encoding="utf-8") as f:
            json.dump({"generatedAt": now, "liga": "Liga Profesional", "season": SEASON, **rk},
                      f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"  ! rankings: {e}", file=sys.stderr)

    print("MODE=full listo.")


if __name__ == "__main__":
    main()
