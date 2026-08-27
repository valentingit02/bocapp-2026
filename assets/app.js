/* =====================================================================
   app.js  -  Lee data/data.json (generado por el robot). Si no existe,
   cae a la API en vivo. CERO datos hardcodeados.
   ===================================================================== */
const TZ = "America/Argentina/Buenos_Aires";
const API = "https://www.thesportsdb.com/api/v1/json/3";
let TEAM = "Boca Juniors", COUNTRY = "Argentina";
let MATCHES = [], TEAMINFO = {}, activeComp = "all";

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

/* ---------- badges ---------- */
function badge(c){
  if(c==="local")  return '<span class="badge b-local">🏟️ LOCAL</span>';
  if(c==="visita") return '<span class="badge b-visita">✈️ VISITANTE</span>';
  return '<span class="badge b-neutral">◈ NEUTRAL</span>';
}

/* ---------- tarjeta ---------- */
function card(m, fin){
  const w = fmt(m);
  const hb = m.homeBadge ? `<img src="${m.homeBadge}/tiny" onerror="this.remove()">` : "";
  const ab = m.awayBadge ? `<img src="${m.awayBadge}/tiny" onerror="this.remove()">` : "";
  const hs = m.homeScore ?? "", as = m.awayScore ?? "";
  const hw = fin && +hs > +as, aw = fin && +as > +hs;
  const lb = m.ligaBadge ? `<img src="${m.ligaBadge}" onerror="this.remove()">` : "";
  const venue = m.venue ? `📍 ${m.venue}` : (m.cond==="local" ? "📍 La Bombonera" : "📍 Estadio a confirmar");
  return `<div class="match">
    <div class="comp-strip">${lb}${m.liga||"Partido"}${m.round?` · Fecha ${m.round}`:""}</div>
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

/* ---------- agrupar por día ---------- */
function group(list, fin){
  const g = {};
  list.forEach(m=>{ const w=fmt(m); (g[w.key]=g[w.key]||{label:w.full,items:[]}).items.push(m); });
  let keys = Object.keys(g).sort();
  if(fin) keys.reverse();
  return keys.map(k=>`<div class="dayhead">${g[k].label}</div>${g[k].items.map(m=>card(m,fin)).join("")}`).join("");
}

/* ---------- render de vistas ---------- */
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

/* ---------- cuenta regresiva al próximo partido ---------- */
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

/* ---------- simulador con partidos de copa reales ---------- */
function buildSim(){
  const cups = upcoming().filter(m=>/copa|sudamericana|libertadores/i.test(m.liga||""));
  const box=$("#simSteps"); window._picks={};
  if(!cups.length){ box.innerHTML=`<p style="color:var(--muted);font-size:13px">Cuando haya partidos de copa en el fixture aparecerán acá.</p>`; return; }
  box.innerHTML=cups.map((m,i)=>`
    <div class="step"><span class="dot">${i+1}</span>
      <span style="font-size:11px;color:var(--muted);font-weight:800;text-transform:uppercase">${m.liga}</span>
      <button class="pick" data-k="${i}" data-t="${m.home}">${m.home}</button>
      <span style="color:var(--muted)">vs</span>
      <button class="pick" data-k="${i}" data-t="${m.away}">${m.away}</button>
    </div>`).join("");
  box.querySelectorAll(".pick").forEach(b=>b.onclick=()=>{
    box.querySelectorAll(`.pick[data-k="${b.dataset.k}"]`).forEach(x=>x.classList.remove("sel"));
    b.classList.add("sel"); window._picks[b.dataset.k]=b.dataset.t; evalSim(cups);
  });
}
function evalSim(cups){
  const p=window._picks||{}, done=Object.keys(p).length, tot=cups.length;
  const adv=Object.values(p).filter(t=>t.toLowerCase().includes(TEAM.split(" ")[0].toLowerCase())).length;
  const c=$("#champ");
  if(done<tot){ c.style.display="none"; return; }
  c.style.display="block";
  if(adv===tot){ c.style.background="linear-gradient(120deg,var(--oro),#e6b400)"; c.style.color="var(--azul)";
    c.innerHTML=`🏆 ¡${TEAM} gana todas sus llaves y sigue con vida!`; }
  else{ c.style.background="linear-gradient(120deg,#adb5bd,#868e96)"; c.style.color="#fff";
    c.innerHTML=`⚑ ${TEAM} queda eliminado según tu simulación.`; }
}

/* ---------- carga: primero data.json, luego API en vivo ---------- */
async function fromLive(){
  const s=await (await fetch(`${API}/searchteams.php?t=${encodeURIComponent(TEAM)}`)).json();
  const t=(s.teams||[]).find(x=>x.strCountry===COUNTRY)||(s.teams||[])[0];
  if(!t) throw new Error("equipo no encontrado");
  TEAMINFO={name:t.strTeam,badge:t.strBadge};
  const [nx,lx]=await Promise.all([
    fetch(`${API}/eventsnext.php?id=${t.idTeam}`).then(r=>r.json()),
    fetch(`${API}/eventslast.php?id=${t.idTeam}`).then(r=>r.json())
  ]);
  const norm=ev=>({id:ev.idEvent,liga:ev.strLeague,ligaBadge:ev.strLeagueBadge,home:ev.strHomeTeam,away:ev.strAwayTeam,
    homeBadge:ev.strHomeTeamBadge,awayBadge:ev.strAwayTeamBadge,homeScore:ev.intHomeScore,awayScore:ev.intAwayScore,
    date:ev.dateEvent,time:ev.strTime,timestamp:ev.strTimestamp,venue:ev.strVenue,round:ev.intRound,
    cond:(TEAM.split(" ")[0].toLowerCase() in {} ),});
  const cond=ev=>{const h=(ev.strHomeTeam||"").toLowerCase();const isH=h.includes(TEAM.split(" ")[0].toLowerCase());
    return /copa argentina/i.test(ev.strLeague||"")?"neutral":(isH?"local":"visita");};
  MATCHES=[...(nx.events||[]),...(lx.results||lx.events||[])].map(ev=>({...norm(ev),cond:cond(ev)}));
}

async function load(){
  $("#listProx").innerHTML=`<div class="state"><div class="spin"></div>Cargando fixture…</div>`;
  try{
    // 1) intento leer el JSON generado por el robot (lo ideal)
    const r=await fetch("data/data.json",{cache:"no-store"});
    if(!r.ok) throw new Error("no json");
    const j=await r.json();
    MATCHES=j.matches||[]; TEAMINFO=j.team||{}; TEAM=TEAMINFO.name||TEAM;
    $("#updated").innerHTML=`Actualizado<br><b>${new Date(j.generatedAt).toLocaleString("es-AR",{timeZone:TZ})}</b>`;
  }catch(e){
    // 2) fallback: API en vivo (por si todavía no generaste el data.json)
    try{ await fromLive(); $("#updated").innerHTML=`Fuente<br><b>API en vivo</b>`; }
    catch(err){ $("#listProx").innerHTML=`<div class="state">No se pudo cargar el fixture.<br>${err.message}</div>`; return; }
  }
  if(TEAMINFO.badge) $("#crest").innerHTML=`<img src="${TEAMINFO.badge}/tiny">`;
  $("#title").innerHTML=`${TEAM} <small>FIXTURE 2026 · DATOS REALES</small>`;
  buildChips(); renderProx(); renderResult(); buildSim();
}

/* ---------- tabs ---------- */
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  t.classList.add("active"); $("#"+t.dataset.v).classList.add("active");
});
$("#btnRefresh").onclick=load;
load();
