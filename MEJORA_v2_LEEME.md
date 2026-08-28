# ⚽ Fútbol Argentino 2026 · App INTEGRAL (versión final)

App multi-competencia con datos reales en vivo, automática, para iPhone.

## Qué trae ahora
Selector de 4 competencias, cada una con TODOS sus partidos (no solo Boca):
- **Liga Profesional** (Zona A y B): partidos, tabla por zona, 👟 figuras (goles/asist/amarillas)
  y **🧮 Playoffs proyectados**: la app CALCULA los cruces de octavos según la tabla,
  con desempate (pts → diferencia de gol → goles a favor), y podés simular hasta la final.
- **Copa Argentina**: partidos + cuadro de eliminación.
- **Copa Sudamericana**: partidos + tabla de grupos + cuadro.
- **Copa Libertadores**: partidos + tabla de grupos + cuadro.
Boca aparece resaltado ⭐ en todos lados. Cuenta regresiva al próximo partido de Boca.
Marcadores en vivo (●) que refrescan solos.

## Cómo se mantiene solo (sin pasar los 100 req/día)
El robot corre CADA HORA y elige el modo por la hora (UTC):
- **00, 06, 12, 18 h → full**: baja los 4 fixtures + 3 tablas + 3 rankings (~10 req).
- **resto → live**: 1 request (/fixtures?live=all) para marcadores en vivo.
- **Total ~60 requests/día** (límite 100). Los playoffs de Liga se recalculan solos
  en cada corrida full, según cómo va la tabla.

## Instalar en iPhone
1. Abrí la URL en **Safari**.
2. **Compartir** → **«Agregar a inicio»**. Queda con ícono, a pantalla completa.

## Archivos de datos (los genera el robot)
- data/fixtures.json   -> partidos de las 4 competencias
- data/standings.json  -> tablas (liga + grupos de copas)
- data/brackets.json   -> cuadros de copa + proyección de playoffs de Liga
- data/stats.json      -> goleadores / asistidores / amarillas
- data/live.json       -> partidos en vivo

## Pasos para actualizar tu repo
```powershell
cd C:\Users\valen\bocapp-2026
# borrá el data.json viejo si existe (cambió el formato):
del data\data.json
# copiá TODO lo del ZIP reemplazando
git add .
git commit -m "app integral: 4 competencias + playoffs Liga calculados"
git push
```
Luego: Actions → Run workflow (mode: full) para poblar todo con datos reales.

## Config
- Requiere el secret APIFOOTBALL_KEY (ya lo tenés).
- IDs de liga usados: 128 Liga, 130 Copa Arg, 11 Sudamericana, 13 Libertadores.
