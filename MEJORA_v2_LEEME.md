# ⚽ Fútbol Argentino 2026 · App COMPLETA (todas las mejoras)

App integral, en vivo, automática, para iPhone. Presupuesto: ~55 requests/día (límite 100).

## ✅ TODO lo incluido

### Datos (4 competencias completas)
- Liga Profesional, Copa Argentina, Copa Sudamericana, Copa Libertadores.
- Todos los partidos (no solo Boca), con fecha/hora exactas en hora AR.
- Tablas: Liga por Zona A/B, y grupos de las copas.
- 🧮 **Playoffs de Liga proyectados**: cruces calculados por clasificación con
  desempate (pts → dif. gol → goles a favor). Simulables hasta la final.
- 📅 **Tabla anual + Promedios + Descensos** (se calcula de los partidos jugados).
- Clasificación a copas 2027 marcada en la tabla anual.
- 👟 Figuras: goleadores, asistidores, amarillas.
- ⓘ **Ficha de partido** de Boca: eventos (goles/tarjetas/cambios) y formaciones.
- Marcadores **en vivo** (●) que refrescan solos cada minuto.

### Experiencia
- 🔎 **Buscador de equipo** (filtra partidos por nombre).
- ⭐ **Equipo favorito** configurable (resalta y arma la cuenta regresiva).
- 🌙 **Modo oscuro** / claro (se recuerda).
- ▦ **Vista compacta** / detallada.
- 📅 **Agregar al calendario** (.ics con recordatorio 1h antes).
- ↗ **Compartir** partido (WhatsApp / hoja nativa de iOS).
- ⏱ Cuenta regresiva al próximo partido de tu equipo.

### iPhone
- Instalable (PWA): Safari → Compartir → «Agregar a inicio».
- Ícono propio, pantalla completa, respeta el notch, funciona offline.

## 🔋 Presupuesto de requests (para no pasar 100/día)
El robot corre CADA HORA y elige modo por la hora (UTC):
- 00,06,18 h → full liviano: 4 fixtures + 3 tablas = 7 req.
- 12 h → full+heavy: lo anterior + 3 rankings + fichas de 2 partidos de Boca = 14 req.
- resto → live: 1 req (/fixtures?live=all).
Total ≈ 55 req/día. Tabla anual, promedios, descensos, buscador, modo oscuro,
favoritos, calendario, compartir, simuladores = 0 requests (navegador o cálculo).

## 🚀 Subir al repo
```powershell
cd C:\Users\valen\bocapp-2026
del data\data.json    2>$null
git add .
git commit -m "app completa: todas las mejoras (anual, promedios, ficha, dark, favoritos, calendario)"
git push
```
Luego: Actions → Run workflow (mode: full) para poblar todo con datos reales.

## Archivos de datos (los genera el robot)
fixtures.json · standings.json · brackets.json · stats.json · live.json · anual.json · details.json
