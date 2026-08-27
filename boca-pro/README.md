# ⚽ Boca 2026 — Fixture real + Simulador (100% gratis)

App web que muestra **todos los partidos de Boca** (Liga Profesional, Copa Sudamericana y Copa Argentina) con **datos reales**, cuenta regresiva al próximo partido, filtros por torneo y un **simulador** de copas. Indica **local (Bombonera) / visitante / neutral**, fecha, hora (en hora de Argentina) y estadio.

## 🧠 Arquitectura (por qué es la mejor sin invertir)

```
TheSportsDB (API gratis)
        │
        ▼
scripts/fetch_data.py  ──►  data/data.json   (fixture completo)
        ▲                        │
        │ cada 6 h               ▼
GitHub Actions (robot gratis)   index.html + assets/  (sitio estático)
                                 │
                                 ▼
                          GitHub Pages (hosting gratis)
```

- **Sin backend ni servidor** → no hay costo mensual.
- **Sin límite de 5 partidos**: el robot baja la **temporada completa** por liga (`eventsseason.php`) y la guarda en `data.json`, que la web lee de una.
- **Sin problema de CORS**: la web lee un archivo propio, no llama a la API desde el navegador (aunque tiene fallback a la API en vivo por las dudas).
- **Datos siempre frescos**: GitHub Actions corre solo cada 6 h y commitea los cambios.

## 📁 Estructura

```
boca-pro/
├── index.html                     # entry point
├── assets/
│   ├── style.css                  # estilos (visual estilo Promiedos)
│   └── app.js                     # lógica: lee data.json, render, simulador
├── data/
│   └── data.json                  # fixture (lo genera/actualiza el robot)
├── scripts/
│   └── fetch_data.py              # baja los datos de TheSportsDB
└── .github/workflows/
    └── update-data.yml            # robot: cron cada 6 h
```

## 🚀 Paso a paso desde 0

### 1) Crear el repositorio
1. Entrá a github.com → **New repository**.
2. Nombre: `boca-2026` · marcá **Public** (necesario para minutos gratis ilimitados).
3. **Create repository**.

### 2) Subir los archivos
- Opción fácil: **Add file → Upload files** y arrastrá toda la carpeta.
- Opción consola:
  ```bash
  git clone https://github.com/TU_USUARIO/boca-2026.git
  cd boca-2026
  # copiá aquí todos los archivos de este proyecto
  git add . && git commit -m "primer commit" && git push
  ```

### 3) Activar GitHub Pages (el hosting gratis)
1. Repo → **Settings → Pages**.
2. En **Source** elegí `Deploy from a branch` → rama `main` → carpeta `/ (root)` → **Save**.
3. En 1–2 min tu app queda online en:
   `https://TU_USUARIO.github.io/boca-2026/`

### 4) Encender el robot (datos automáticos)
1. Repo → pestaña **Actions** → si pregunta, **Enable workflows**.
2. Abrí el workflow **"Actualizar fixture"** → **Run workflow** (para probar ya).
3. A los ~30 s se genera/actualiza `data/data.json`. Desde ahí corre solo cada 6 h.

> (Opcional) Si sacás tu propia API key gratis en TheSportsDB, guardala en
> **Settings → Secrets and variables → Actions → New secret** con nombre `TSDB_KEY`.

### 5) Listo ✅
Abrí tu URL de GitHub Pages. Cada vez que entres, la web lee el `data.json` más reciente.

## 🔧 Adaptarlo a otro equipo
En `.github/workflows/update-data.yml` cambiá `TEAM_NAME` (ej: `'River Plate'`) y `COUNTRY`.
Nada más: el script busca el ID solo.

## 🧩 Probar el fetch localmente (sin esperar al robot)
```bash
python scripts/fetch_data.py        # genera data/data.json
python -m http.server               # servidor local
# abrí http://localhost:8000
```

## 💡 Mejoras futuras
- Cuadros de eliminatorias completos (combinando fuentes o plan Premium US$9/mes).
- PWA (instalable en el celu) agregando `manifest.json` + service worker.
- Notificaciones push antes de cada partido.

---
Datos: [TheSportsDB](https://www.thesportsdb.com) (API pública gratuita). Hecho para Valentín.
