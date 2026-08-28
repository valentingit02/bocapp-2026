# 🔴🔵 Mejora v2 — Datos en vivo, automáticos y con fechas correctas

## Qué cambió
El motor ahora usa **API-Football** (fechas y horarios EXACTOS, verificación multi-fuente)
en vez de la fuente crowd-sourced. El robot de GitHub Actions:
- baja el fixture del equipo con fecha/hora reales (ya en hora de Argentina),
- arma los **cuadros de copa solos** (agrupa ida/vuelta, calcula global y ganador),
- corre **cada 2 horas** y commitea los cambios.
Vos no tocás nada.

## Archivos que reemplaza / agrega
- scripts/fetch_data.py            (NUEVO motor con API-Football)
- .github/workflows/update-data.yml (corre cada 2h, usa el secret)
- assets/app.js, assets/style.css, index.html (front, ya con pestaña Cuadros)
- data/data.json, data/brackets.json (semillas; el robot las reemplaza)

## PASOS (una sola vez)

### 1) Sacá tu API key gratis (2 min, sin tarjeta)
- Entrá a https://www.api-football.com/  → "Sign in" / crear cuenta.
- En el dashboard vas a ver tu **API key** (plan Free = 100 requests/día).

### 2) Guardala como secret en tu repo (NO va en el código)
- GitHub → tu repo → **Settings → Secrets and variables → Actions**
- **New repository secret**
  - Name:  APIFOOTBALL_KEY
  - Secret: (pegá tu key)
- **Add secret**

### 3) Subí los archivos nuevos
```powershell
cd C:\Users\valen\bocapp-2026
# copiá acá los archivos del ZIP (reemplazando)
git add .
git commit -m "v2: datos en vivo con API-Football + cuadros automaticos"
git push
```

### 4) Encendé el robot
- Repo → pestaña **Actions** → workflow "Actualizar fixture (API-Football)" → **Run workflow**.
- A los ~30-60 s se generan data.json y brackets.json con datos reales.
- Desde ahí corre solo cada 2 h.

## Notas de consumo (para no pasarte del free)
- Cada corrida usa ~4 requests (equipo + 3 copas).
- Cada 2 h = 12 corridas/día ≈ 48 requests/día. Entra cómodo en los 100/día. 
- Si querés más frecuencia durante partidos, cambiá el cron a '*/30 * * * *'
  (ojo: sube el consumo).

## Cambiar de equipo
En el workflow, cambiá TEAM_ID y TEAM_NAME. IDs API-Football:
Boca=451, River=435, Racing=436, Independiente=452, San Lorenzo=460.
