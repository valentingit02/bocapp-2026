/* =====================================================================
   app.js  -  Lee data/data.json (fixture) y data/brackets.json (cuadros).
   Si data.json no existe, cae a la API en vivo. CERO datos hardcodeados.
   ===================================================================== */
const TZ = "America/Argentina/Buenos_Aires";
const API = "https://www.thesportsdb.com/api/v1/json/3";
let TEAM = "Boca Juniors", COUNTRY = "Argentina";
let MATCHES = [], TEAMINFO = {}, activeComp = "all";
let BRACKETS = [], activeBrk = 0;

const $ = s => document.querySelector(s);

/* ---------- utilidades de fecha ---------- */
function parseDate(m){
  let iso = m.timestamp;
  if(iso && !/[zZ]|[+-]\d\d:?\d\d$/.test(iso)) iso += "Z";
  let d = iso ? new Date(iso) : null;
  if((!d || isNaN(d)) && m.date){
    const t = (m.time && m.time !== "00:00:00") ? m.time : "00:00:00";
    d = new Date(m.date + "T" + t + "Z");
  }
  return (d && !isNaN(d)) ? d : null;
}
function fmt(m){
  const d = parseDate(m);
  const noTime = !m.time || m.time === "00:00:00";
  if(!d) return {hh:"?", dd:m.date||"", key:m.date||"z", full:m.date||""};
  return {
    hh: noTime ? "A conf." : d.toLocaleTimeString("es-AR",{timeZone:TZ,hour:"2-digit",minute:"2-digit"}),
    dd: d.toLocaleDateString("es-AR",{timeZone:TZ,weekday:"short",day:"2-digit",month:"short"}),
    key: d.toLocaleDateString("en-CA",{timeZone:TZ}),
    full: d.toLocaleDateString("es-AR",{timeZone:TZ,weekday:"long",day:"numeric",month:"long",year:"numeric"}),
    date: d
  };
}
function isFinished(m){
  return (m.homeScore !== null && m.homeScore !== undefined && m.homeScore !== "");
}
function badge(c){
  if(c==="local")  return '<span class="badge b-local">🏟️ LOCAL</span>';
  if(c==="visita") return '<span class="badge b-visita">✈️ VISITANTE</span>';
  return '<span class="badge b-neutral">◈ NEUTRAL</span>';
}

/* ---------- tarjeta de partido ---------- */
function card(m, fin){
  const w = fmt(m);
  const hb = m.homeBadge ? `<img src="${m.homeBadge}/tiny" onerror="this.remove()">` : "";
  const ab = m.awayBadge ? `<img src="${m.awayBadge}/tiny" onerror="this.remove()">` : "";
  const hs = m.homeScore ?? "", as = m.awayScore ?? "";
  const hw = fin && +hs > +as, aw = fin && +as > +hs;
  const lb = m.ligaBadge ? `<img src="${m.ligaBadge}" onerror="this.remove()">` : "";
  const venue = m.venue ? `📍 ${m.venue}` : (m.cond==="local" ? "📍 La Bombonera" : "📍 Estadio a confirmar");
  return `<div class="match">
    <div class="comp-strip">${lb}${m.liga||"Partido"}${m.round?` · ${m.round}`:""}</div>
    <div class="whenbox">
      ${fin ? '<div class="hh" style="font-size:12px;color:var(--muted)">FIN</div>'
            : `<div class="hh">${w.hh}</div>`}
      <div class="dd">${w.dd}</div>
    </div>
    <div class="sides">
      <div class="side ${aw?'dim':''}">${hb}${m.home}<span class="sc">${hs}</span></div>
      <div class="side ${hw?'dim':''}">${ab}${m.away}<span class="sc">${as}</span></div>
    </div>
    <div>${fin ? "" : badge(m.cond)}</div>
    <div class="venue">${venue}</div>
  </div>`;
}
function group(list, fin){
  const g = {};
  list.forEach(m=>{ const w=fmt(m); (g[w.key]=g[w.key]||{label:w.full,items:[]}).items.push(m); });
  let keys = Object.keys(g).sort();
  if(fin) keys.reverse();
  return keys.map(k=>`<div class="dayhead">${g[k].label}</div>${g[k].items.map(m=>card(m,fin)).join("")}`).join("");
}

/* ---------- vistas fixture ---------- */
function upcoming(){ const now=new Date(); return MATCHES.filter(m=>{const d=parseDate(m); return !isFinished(m) && (!d || d>=now-3.6e6);}); }
function played(){ return MATCHES.filter(isFinished); }

function renderProx(){
  let arr = upcoming();
  if(activeComp!=="all") arr = arr.filter(m=>m.liga===activeComp);
  $("#listProx").innerHTML = arr.length ? group(arr,false)
    : `<div class="state">No hay próximos partidos cargados.</div>`;
  renderCountdown();
}
function renderResult(){
  const arr = played();
  $("#listResult").innerHTML = arr.length ? group(arr,true)
    : `<div class="state">Sin resultados todavía.</div>`;
}
function buildChips(){
  const comps=[...new Set(upcoming().map(m=>m.liga).filter(Boolean))];
  const box=$("#chipsProx");
  box.innerHTML = `<span class="chip on" data-c="all">Todas</span>`+
    comps.map(c=>`<span class="chip" data-c="${c}">${c}</span>`).join("");
  box.querySelectorAll(".chip").forEach(ch=>ch.onclick=()=>{
    box.querySelectorAll(".chip").forEach(x=>x.classList.remove("on"));
    ch.classList.add("on"); activeComp=ch.dataset.c; renderProx();
  });
}

/* ---------- cuenta regresiva ---------- */
let cdTimer=null;
function renderCountdown(){
  const next = upcoming().map(m=>({m,d:parseDate(m)})).filter(x=>x.d).sort((a,b)=>a.d-b.d)[0];
  const box=$("#countdown");
  if(!next){ box.style.display="none"; return; }
  box.style.display="flex";
  const {m,d}=next;
  clearInterval(cdTimer);
  const tick=()=>{
    const diff=d-new Date();
    if(diff<=0){ $("#cdClock").textContent="¡EN JUEGO!"; return; }
    const dd=Math.floor(diff/864e5), hh=Math.floor(diff%864e5/36e5),
          mm=Math.floor(diff%36e5/6e4), ss=Math.floor(diff%6e4/1e3);
    $("#cdClock").textContent = (dd?dd+"d ":"")+String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0")+":"+String(ss).padStart(2,"0");
  };
  box.querySelector(".mt").textContent = `${m.home} vs ${m.away}`;
  box.querySelector(".sub").textContent = `${m.liga} · ${fmt(m).full}`;
  tick(); cdTimer=setInterval(tick,1000);
}

/* =====================================================================
   CUADROS DE ELIMINATORIAS (bracket) + simulador interactivo integrado
   ===================================================================== */
// estado de simulación por torneo: sim[torneoId][rondaIdx][llaveIdx] = "Equipo ganador"
const sim = {};

function isBoca(name){ return name && name.toLowerCase().includes(TEAM.split(" ")[0].toLowerCase()); }

function buildBrkTabs(){
  const box=$("#brkTabs");
  box.innerHTML = BRACKETS.map((t,i)=>
    `<span class="brk-tab ${i===activeBrk?'on':''}" data-i="${i}">${t.nombre}</span>`).join("");
  box.querySelectorAll(".brk-tab").forEach(el=>el.onclick=()=>{
    activeBrk=+el.dataset.i; buildBrkTabs(); renderBracket();
  });
}

// Devuelve el ganador efectivo de una llave: primero el real (json), si no el simulado
function winnerOf(tId, r, k, llave){
  if(llave.ganador) return llave.ganador;
  return (sim[tId] && sim[tId][r] && sim[tId][r][k]) || "";
}

// Propaga ganadores hacia la ronda siguiente (2 llaves -> 1 llave)
function computeRounds(t){
  const tId=t.id;
  const rounds = t.rondas.map(r=>({nombre:r.nombre, llaves:r.llaves.map(l=>({...l}))}));
  for(let r=0;r<rounds.length-1;r++){
    const cur=rounds[r], next=rounds[r+1];
    cur.llaves.forEach((ll,k)=>{
      const w=winnerOf(tId,r,k,ll);
      const nk=Math.floor(k/2);      // dos llaves alimentan una
      const slot=(k%2===0)?"a":"b";
      if(next.llaves[nk] && !next.llaves[nk][slot+"_fixed"]){
        // solo autocompleto si la llave siguiente no trae equipos reales cargados
        if(!next.llaves[nk].ganador){
          next.llaves[nk][slot] = w || next.llaves[nk][slot] || "";
        }
      }
    });
  }
  return rounds;
}

function rowHTML(t, r, k, team, score, other, ll){
  const tId=t.id;
  if(!team) return `<div class="row empty">Por definir</div>`;
  const w=winnerOf(tId,r,k,ll);
  const cls = w ? (w===team?"win":"lose") : "";
  const canClick = !ll.ganador; // si hay resultado real, no se puede cambiar
  return `<div class="row ${cls}" ${canClick?`data-t="${tId}" data-r="${r}" data-k="${k}" data-team="${team}"`:''}
      style="${canClick?'':'cursor:default'}">
      <span>${isBoca(team)?'⭐ ':''}${team}</span>
      <span class="sc">${score||''}</span>
    </div>`;
}

function tieHTML(t, r, k, ll){
  const boca = ll.boca || isBoca(ll.a) || isBoca(ll.b) ||
    isBoca(winnerOf(t.id,r,k,ll));
  return `<div class="tie ${boca?'boca':''}">
    ${rowHTML(t,r,k,ll.a,ll.ga,ll.b,ll)}
    ${rowHTML(t,r,k,ll.b,ll.gb,ll.a,ll)}
    ${ll.detalle?`<div class="det">${ll.detalle}</div>`:''}
  </div>`;
}

function renderBracket(){
  const t=BRACKETS[activeBrk];
  if(!t){ $("#bracket").innerHTML=`<div class="state">Sin cuadros cargados.</div>`; return; }
  $("#brkInfo").innerHTML = `🏆 <b>Final:</b> ${t.final.fecha} · ${t.final.sede}. `+
    `<span class="brk-hint">Tocá un equipo en cada llave para simular quién avanza.</span>`;
  const rounds=computeRounds(t);
  $("#bracket").innerHTML = rounds.map((r,ri)=>`
    <div class="round"><h3>${r.nombre}</h3>
      ${r.llaves.map((ll,ki)=>tieHTML(t,ri,ki,ll)).join("")}
    </div>`).join("");
  // clicks para simular
  $("#bracket").querySelectorAll(".row[data-team]").forEach(row=>row.onclick=()=>{
    const {t:tId,r,k,team}=row.dataset;
    sim[tId]=sim[tId]||{}; sim[tId][r]=sim[tId][r]||{};
    sim[tId][r][k]=team;
    renderBracket();
  });
  // campeón
  const last=rounds[rounds.length-1].llaves[0];
  const champ=last?winnerOf(t.id,rounds.length-1,0,last):"";
  const box=$("#champBox");
  if(champ){
    box.style.display="block";
    box.innerHTML = isBoca(champ) ? `🏆🎉 ¡${champ} CAMPEÓN de la ${t.nombre}!`
                                  : `🏆 ${champ} — Campeón simulado`;
    box.style.background = isBoca(champ)
      ? "linear-gradient(120deg,var(--oro),#e6b400)"
      : "linear-gradient(120deg,#adb5bd,#868e96)";
    box.style.color = isBoca(champ) ? "var(--azul)" : "#fff";
  } else box.style.display="none";
}
$("#brkReset") && ($("#brkReset").onclick=()=>{ const t=BRACKETS[activeBrk]; if(t){delete sim[t.id];} renderBracket(); });

/* =====================================================================
   CARGA: data.json (fixture) + brackets.json (cuadros) + fallback API
   ===================================================================== */
async function fromLive(){
  const s=await (await fetch(`${API}/searchteams.php?t=${encodeURIComponent(TEAM)}`)).json();
  const t=(s.teams||[]).find(x=>x.strCountry===COUNTRY)||(s.teams||[])[0];
  if(!t) throw new Error("equipo no encontrado");
  TEAMINFO={name:t.strTeam,badge:t.strBadge};
  const [nx,lx]=await Promise.all([
    fetch(`${API}/eventsnext.php?id=${t.idTeam}`).then(r=>r.json()),
    fetch(`${API}/eventslast.php?id=${t.idTeam}`).then(r=>r.json())
  ]);
  const cond=ev=>{const h=(ev.strHomeTeam||"").toLowerCase();const isH=h.includes(TEAM.split(" ")[0].toLowerCase());
    return /copa argentina/i.test(ev.strLeague||"")?"neutral":(isH?"local":"visita");};
  const norm=ev=>({id:ev.idEvent,liga:ev.strLeague,ligaBadge:ev.strLeagueBadge,home:ev.strHomeTeam,away:ev.strAwayTeam,
    homeBadge:ev.strHomeTeamBadge,awayBadge:ev.strAwayTeamBadge,homeScore:ev.intHomeScore,awayScore:ev.intAwayScore,
    date:ev.dateEvent,time:ev.strTime,timestamp:ev.strTimestamp,venue:ev.strVenue,round:ev.intRound,cond:cond(ev)});
  MATCHES=[...(nx.events||[]),...(lx.results||lx.events||[])].map(norm);
}

async function loadBrackets(){
  try{
    const r=await fetch("data/brackets.json",{cache:"no-store"});
    if(r.ok){ const j=await r.json(); BRACKETS=j.torneos||[]; }
  }catch(e){ BRACKETS=[]; }
  if(BRACKETS.length){ buildBrkTabs(); renderBracket(); }
  else $("#bracket").innerHTML=`<div class="state">No se pudo cargar brackets.json</div>`;
}

async function load(){
  $("#listProx").innerHTML=`<div class="state"><div class="spin"></div>Cargando fixture…</div>`;
  try{
    const r=await fetch("data/data.json",{cache:"no-store"});
    if(!r.ok) throw new Error("no json");
    const j=await r.json();
    MATCHES=j.matches||[]; TEAMINFO=j.team||{}; TEAM=TEAMINFO.name||TEAM;
    $("#updated").innerHTML=`Actualizado<br><b>${new Date(j.generatedAt).toLocaleString("es-AR",{timeZone:TZ})}</b>`;
  }catch(e){
    try{ await fromLive(); $("#updated").innerHTML=`Fuente<br><b>API en vivo</b>`; }
    catch(err){ $("#listProx").innerHTML=`<div class="state">No se pudo cargar el fixture.<br>${err.message}</div>`; }
  }
  if(TEAMINFO.badge) $("#crest").innerHTML=`<img src="${TEAMINFO.badge}/tiny">`;
  $("#title").innerHTML=`${TEAM} <small>FIXTURE 2026 · DATOS REALES</small>`;
  buildChips(); renderProx(); renderResult();
  loadBrackets();
}

/* ---------- tabs ---------- */
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  t.classList.add("active"); $("#"+t.dataset.v).classList.add("active");
});
$("#btnRefresh").onclick=load;
load();
