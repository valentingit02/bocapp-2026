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

# Equipo a seguir para detalles ampliados (ficha de partido)
BOCA_ID = os.environ.get("TEAM_ID", "451")
DETALLE_PARTIDOS = int(os.environ.get("DETALLE_PARTIDOS", "0"))  # cuantos partidos de Boca detallar


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


# -------------------------------------- TABLA ANUAL / PROMEDIOS / DESCENSOS
def tabla_anual_y_promedios(comps):
    """Calcula tabla anual (todos los partidos de Liga jugados) y promedios,
    SIN requests extra: usa los fixtures de la Liga ya bajados.
    Nota: para promedios reales de descenso hace falta historial de temporadas
    anteriores; acá calculamos con lo disponible en la temporada actual."""
    liga = next((c for c in comps if c["id"] == LIGA_ID), None)
    if not liga:
        return None
    tab = {}  # equipo -> stats
    for m in liga["matches"]:
        if m["homeScore"] is None or m["awayScore"] is None:
            continue
        h, a = m["home"], m["away"]
        gh, ga = m["homeScore"], m["awayScore"]
        for eq in (h, a):
            tab.setdefault(eq, {"equipo": eq, "logo": m["homeLogo"] if eq == h else m["awayLogo"],
                                "pj": 0, "g": 0, "e": 0, "p": 0, "gf": 0, "gc": 0, "pts": 0,
                                "boca": es_boca(eq)})
        tab[h]["pj"] += 1; tab[a]["pj"] += 1
        tab[h]["gf"] += gh; tab[h]["gc"] += ga
        tab[a]["gf"] += ga; tab[a]["gc"] += gh
        if gh > ga:
            tab[h]["g"] += 1; tab[h]["pts"] += 3; tab[a]["p"] += 1
        elif ga > gh:
            tab[a]["g"] += 1; tab[a]["pts"] += 3; tab[h]["p"] += 1
        else:
            tab[h]["e"] += 1; tab[a]["e"] += 1; tab[h]["pts"] += 1; tab[a]["pts"] += 1
    filas = list(tab.values())
    for r in filas:
        r["dg"] = r["gf"] - r["gc"]
        r["prom"] = round(r["pts"] / r["pj"], 3) if r["pj"] else 0
    anual = sorted(filas, key=lambda r: (-r["pts"], -r["dg"], -r["gf"]))
    for i, r in enumerate(anual): r["pos"] = i + 1
    promedios = sorted(filas, key=lambda r: (r["prom"], r["pts"]))  # peor promedio primero
    for i, r in enumerate(promedios): r["pos"] = i + 1
    n = len(promedios)
    # marca descensos (2 peores promedios) y clasificacion a copas 2027 (referencial)
    for i, r in enumerate(promedios):
        r["desciende"] = (i < 2)
    for i, r in enumerate(anual):
        r["copa2027"] = "Libertadores" if i == 0 else ("Sudamericana" if i < 7 else "")
    return {"anual": anual, "promedios": promedios, "totalEquipos": n}


# ---------------------------------------------------------------- FICHA PARTIDO
def detalles_boca(comps):
    """Baja eventos+formaciones SOLO de los proximos/ultimos partidos de Boca.
    Controlado por DETALLE_PARTIDOS para cuidar el presupuesto de requests."""
    if DETALLE_PARTIDOS <= 0:
        return {}
    liga_ids = set(COMPS.keys())
    boca_matches = []
    for c in comps:
        for m in c["matches"]:
            if m["boca"]:
                boca_matches.append(m)
    # priorizo: el mas proximo no jugado + el ultimo jugado
    jugados = [m for m in boca_matches if m["status"] in ("FT", "AET", "PEN")]
    prox = [m for m in boca_matches if m["status"] == "NS"]
    prox.sort(key=lambda m: m["timestamp"] or "9999")
    jugados.sort(key=lambda m: m["timestamp"] or "", reverse=True)
    elegidos = (prox[:1] + jugados[:1])[:DETALLE_PARTIDOS]
    out = {}
    for m in elegidos:
        fid = m["id"]
        det = {"eventos": [], "formaciones": []}
        try:
            ev = api_get("/fixtures/events", {"fixture": fid})
            for e in ev:
                det["eventos"].append({
                    "min": e["time"]["elapsed"], "tipo": e["type"], "detalle": e.get("detail"),
                    "equipo": e["team"]["name"], "jugador": (e.get("player") or {}).get("name"),
                    "asist": (e.get("assist") or {}).get("name"),
                })
        except Exception as e:
            print(f"  ! eventos {fid}: {e}", file=sys.stderr)
        try:
            lu = api_get("/fixtures/lineups", {"fixture": fid})
            for L in lu:
                det["formaciones"].append({
                    "equipo": L["team"]["name"], "esquema": L.get("formation"),
                    "titulares": [p["player"]["name"] for p in (L.get("startXI") or [])],
                })
        except Exception as e:
            print(f"  ! lineups {fid}: {e}", file=sys.stderr)
        out[str(fid)] = det
    print(f"OK detalles: {len(out)} partidos de Boca")
    return out


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

    # Tabla anual + promedios + descensos + clasificacion 2027 (0 requests)
    try:
        anual = tabla_anual_y_promedios(comps)
        if anual:
            with open(D("anual.json"), "w", encoding="utf-8") as f:
                json.dump({"generatedAt": now, **anual}, f, ensure_ascii=False, indent=2)
            print("OK anual.json (tabla anual + promedios + descensos)")
    except Exception as e:
        print(f"  ! anual: {e}", file=sys.stderr)

    # Rankings (solo en corrida "heavy")
    if os.environ.get("HEAVY", "0") == "1":
        try:
            rk = trae_rankings()
            with open(D("stats.json"), "w", encoding="utf-8") as f:
                json.dump({"generatedAt": now, "liga": "Liga Profesional", "season": SEASON, **rk},
                          f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"  ! rankings: {e}", file=sys.stderr)
        # Fichas de partido de Boca
        try:
            det = detalles_boca(comps)
            if det:
                with open(D("details.json"), "w", encoding="utf-8") as f:
                    json.dump({"generatedAt": now, "partidos": det}, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"  ! detalles: {e}", file=sys.stderr)

    print("MODE=full listo.")


if __name__ == "__main__":
    main()
