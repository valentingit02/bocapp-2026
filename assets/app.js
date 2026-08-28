/* =====================================================================
   app.js · App INTEGRAL multi-competencia
   Lee: fixtures.json, standings.json, brackets.json, stats.json, live.json
   ===================================================================== */
const TZ = "America/Argentina/Buenos_Aires";
const BOCA = "boca";

// estado
let FIX = [];          // competencias con partidos
let STAND = [];         // ligas con grupos
let BRACKETS = [];      // torneos (copas + proyeccion liga)
let STATS = {};         // rankings liga
let LIVE = [];          // en vivo
let GEN = {};           // generatedAt por archivo

let compSel = "128";    // competencia seleccionada
let subView = "partidos"; // partidos | tabla | cuadro | figuras
let activeZona = 0, activeBrk = 0, activeStat = "goleadores";
let filtroBoca = false;

const $ = s => document.querySelector(s);
const COMP_NOMBRES = {
  "128":"Liga Profesional","130":"Copa Argentina","11":"Copa Sudamericana","13":"Copa Libertadores"
};
const esBoca = n => (n||"").toLowerCase().includes(BOCA);

/* ---------- fechas ---------- */
function parseDate(m){
  let iso=m.timestamp;
  if(iso && !/[zZ]|[+-]\d\d:?\d\d$/.test(iso)) iso+="Z";
  let d=iso?new Date(iso):null;
  if((!d||isNaN(d))&&m.date){const t=(m.time&&m.time!=="00:00:00")?m.time:"00:00:00";d=new Date(m.date+"T"+t+"Z");}
  return (d&&!isNaN(d))?d:null;
}
function fmt(m){
  const d=parseDate(m), noTime=!m.time||m.time==="00:00:00";
  if(!d) return {hh:"?",dd:m.date||"",key:m.date||"z",full:m.date||""};
  return {
    hh: noTime?"A conf.":d.toLocaleTimeString("es-AR",{timeZone:TZ,hour:"2-digit",minute:"2-digit"}),
    dd: d.toLocaleDateString("es-AR",{timeZone:TZ,weekday:"short",day:"2-digit",month:"short"}),
    key:d.toLocaleDateString("en-CA",{timeZone:TZ}),
    full:d.toLocaleDateString("es-AR",{timeZone:TZ,weekday:"long",day:"numeric",month:"long"}),
    date:d
  };
}
const LIVE_ST=["1H","HT","2H","ET","BT","P","LIVE"];
function estadoMatch(m){
  const lv=LIVE.find(x=>x.id===m.id);
  if(lv) return {...m, homeScore:lv.homeScore, awayScore:lv.awayScore, status:lv.status, _live:true};
  return m;
}
function isFin(m){ return m.status==="FT"||m.status==="AET"||m.status==="PEN"; }

/* ---------- tarjeta ---------- */
function condBadge(m){
  if(m.neutral) return '<span class="badge b-neutral">◈ NEUTRAL</span>';
  return "";
}
function card(m){
  m=estadoMatch(m);
  const w=fmt(m), fin=isFin(m), live=m._live;
  const hb=m.homeLogo?`<img src="${m.homeLogo}" onerror="this.remove()">`:"";
  const ab=m.awayLogo?`<img src="${m.awayLogo}" onerror="this.remove()">`:"";
  const hs=m.homeScore??"", as=m.awayScore??"";
  const hw=(fin||live)&&hs!==""&&+hs>+as, aw=(fin||live)&&as!==""&&+as>+hs;
  const bocaCls=(esBoca(m.home)||esBoca(m.away))?"is-boca":"";
  let estado;
  if(live) estado=`<span class="hh live">● ${m.status}</span>`;
  else if(fin) estado='<span class="hh" style="font-size:12px;color:var(--muted)">FIN</span>';
  else estado=`<span class="hh">${w.hh==="A conf."?"?":w.hh}</span>`;
  const venue=m.venue?`📍 ${m.venue}`:"";
  return `<div class="match ${bocaCls}">
    <div class="comp-strip">${m.round?m.round:""} ${condBadge(m)}</div>
    <div class="whenbox">${estado}<div class="dd">${w.dd}</div></div>
    <div class="sides">
      <div class="side ${aw?'dim':''}">${hb}${esBoca(m.home)?'⭐ ':''}${m.home}<span class="sc">${hs}</span></div>
      <div class="side ${hw?'dim':''}">${ab}${esBoca(m.away)?'⭐ ':''}${m.away}<span class="sc">${as}</span></div>
    </div>
    ${venue?`<div class="venue">${venue}</div>`:""}
  </div>`;
}
function groupDays(list){
  const now=new Date();
  const g={};
  list.forEach(m=>{const w=fmt(m);(g[w.key]=g[w.key]||{label:w.full,items:[]}).items.push(m);});
  const keys=Object.keys(g).sort();
  return keys.map(k=>`<div class="dayhead">${g[k].label}</div>${g[k].items.map(card).join("")}`).join("");
}

/* ---------- vista PARTIDOS ---------- */
function renderPartidos(){
  const comp=FIX.find(c=>c.id===compSel);
  const box=$("#panel");
  if(!comp){ box.innerHTML=`<div class="state">No hay partidos cargados.</div>`; return; }
  let arr=comp.matches.slice();
  if(filtroBoca) arr=arr.filter(m=>m.boca);
  // separar futuros/en vivo de jugados
  const now=new Date();
  const prox=arr.filter(m=>!isFin(estadoMatch(m)));
  const jug=arr.filter(m=>isFin(estadoMatch(m)));
  const bocaChip = comp.id==="128"||comp.matches.some(m=>m.boca)
    ? `<span class="chip ${filtroBoca?'on':''}" id="chipBoca">⭐ Solo Boca</span>` : "";
  box.innerHTML=`
    <div class="chips">
      ${bocaChip}
      <span class="chip on" data-sub="prox2">Próximos (${prox.length})</span>
      <span class="chip" data-sub="jug2">Jugados (${jug.length})</span>
    </div>
    <div id="subPart"></div>`;
  const render2=(which)=>{
    $("#subPart").innerHTML = which==="jug2"
      ? (jug.length?groupDays(jug.reverse()):`<div class="state">Sin resultados.</div>`)
      : (prox.length?groupDays(prox):`<div class="state">Sin próximos partidos.</div>`);
  };
  render2("prox2");
  box.querySelectorAll(".chip[data-sub]").forEach(c=>c.onclick=()=>{
    box.querySelectorAll(".chip[data-sub]").forEach(x=>x.classList.remove("on"));
    c.classList.add("on"); render2(c.dataset.sub);
  });
  const cb=$("#chipBoca"); if(cb) cb.onclick=()=>{filtroBoca=!filtroBoca; renderPartidos();};
}

/* ---------- vista TABLA ---------- */
function formaHTML(f){ return f?`<span class="forma">${f.slice(-5).split("").map(c=>`<span class="f-${c}">${c}</span>`).join("")}</span>`:""; }
function zonaClase(pos,total){ if(pos<=1)return"zona-lib"; if(pos<=(total>10?8:4))return"zona-sud"; return ""; }
function renderTabla(){
  const box=$("#panel");
  const liga=STAND.find(l=>l.id===compSel);
  if(!liga){ box.innerHTML=`<div class="state">Esta competencia no tiene tabla (es eliminación directa).</div>`; return; }
  const tabs = liga.grupos.length>1
    ? `<div class="tbl-tabs">${liga.grupos.map((g,i)=>`<span class="tbl-tab ${i===activeZona?'on':''}" data-i="${i}">${g.grupo}</span>`).join("")}</div>`:"";
  const g=liga.grupos[activeZona]||liga.grupos[0], total=g.filas.length;
  const rows=g.filas.map(r=>`
    <tr class="${r.boca?'boca-row':''}">
      <td class="pos-n ${zonaClase(r.pos,total)}">${r.pos}</td>
      <td class="eq"><img src="${r.logo}" onerror="this.remove()">${r.boca?'⭐ ':''}${r.equipo}</td>
      <td>${r.pj}</td><td class="hide-m">${r.g}</td><td class="hide-m">${r.e}</td><td class="hide-m">${r.p}</td>
      <td class="hide-m">${r.gf}:${r.gc}</td><td>${r.dg>0?'+':''}${r.dg}</td>
      <td class="pts">${r.pts}</td><td class="hide-m">${formaHTML(r.forma)}</td>
    </tr>`).join("");
  box.innerHTML=`${tabs}
    <div class="tabla-wrap">
      <div class="tabla-head">📊 ${g.grupo} · ${liga.name}</div>
      <table class="pos"><thead><tr>
        <th>#</th><th class="eq">Equipo</th><th>PJ</th>
        <th class="hide-m">G</th><th class="hide-m">E</th><th class="hide-m">P</th>
        <th class="hide-m">GF:GC</th><th>DG</th><th>Pts</th><th class="hide-m">Últ.5</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <div class="tbl-leyenda">
        <span><b class="zona-lib" style="padding-left:6px">▍</b> Clasifica arriba</span>
        <span><b class="zona-sud" style="padding-left:6px">▍</b> Zona playoff</span>
      </div>
    </div>`;
  box.querySelectorAll(".tbl-tab").forEach(el=>el.onclick=()=>{activeZona=+el.dataset.i; renderTabla();});
}

/* ---------- vista CUADRO (copas + proyeccion liga) ---------- */
const sim={};
function winnerOf(tId,r,k,ll){ if(ll.ganador) return ll.ganador; return (sim[tId]&&sim[tId][r]&&sim[tId][r][k])||""; }
function computeRounds(t){
  const rounds=t.rondas.map(r=>({nombre:r.nombre,llaves:r.llaves.map(l=>({...l}))}));
  for(let r=0;r<rounds.length-1;r++){
    rounds[r].llaves.forEach((ll,k)=>{
      const w=winnerOf(t.id,r,k,ll), nk=Math.floor(k/2), slot=(k%2===0)?"a":"b";
      if(rounds[r+1].llaves[nk] && !rounds[r+1].llaves[nk].ganador){
        rounds[r+1].llaves[nk][slot]=w||rounds[r+1].llaves[nk][slot]||"";
      }
    });
  }
  return rounds;
}
function rowB(t,r,k,team,score,ll){
  if(!team) return `<div class="row empty">Por definir</div>`;
  const w=winnerOf(t.id,r,k,ll), cls=w?(w===team?"win":"lose"):"", canClick=!ll.ganador;
  return `<div class="row ${cls}" ${canClick?`data-t="${t.id}" data-r="${r}" data-k="${k}" data-team="${team}"`:''} ${canClick?'':'style="cursor:default"'}>
    <span>${esBoca(team)?'⭐ ':''}${team}</span><span class="sc">${score||''}</span></div>`;
}
function tieB(t,r,k,ll){
  const boca=ll.boca||esBoca(ll.a)||esBoca(ll.b)||esBoca(winnerOf(t.id,r,k,ll));
  return `<div class="tie ${boca?'boca':''}">${rowB(t,r,k,ll.a,ll.ga,ll)}${rowB(t,r,k,ll.b,ll.gb,ll)}
    ${ll.detalle?`<div class="det">${ll.detalle}</div>`:''}</div>`;
}
function renderCuadro(){
  const box=$("#panel");
  const torneos=BRACKETS.filter(t=>{
    if(compSel==="128") return t.tipo==="liga-proy";
    return COMP_NOMBRES[compSel] && t.nombre.toLowerCase().includes(COMP_NOMBRES[compSel].toLowerCase());
  });
  if(!torneos.length){ box.innerHTML=`<div class="state">No hay cuadro para esta competencia todavía.</div>`; return; }
  const t=torneos[Math.min(activeBrk,torneos.length-1)];
  const multi = torneos.length>1
    ? `<div class="brk-tabs">${torneos.map((x,i)=>`<span class="brk-tab ${i===activeBrk?'on':''}" data-i="${i}">${x.nombre}</span>`).join("")}</div>`:"";
  const nota=t.nota?`<div class="brk-info">📐 ${t.nota}</div>`:
    `<div class="brk-info"><span class="brk-hint">Tocá un equipo para simular quién avanza.</span></div>`;
  const rounds=computeRounds(t);
  box.innerHTML=`${multi}${nota}
    <div class="bracket">${rounds.map((r,ri)=>`<div class="round"><h3>${r.nombre}</h3>
      ${r.llaves.map((ll,ki)=>tieB(t,ri,ki,ll)).join("")}</div>`).join("")}</div>
    <div class="champ-box" id="champBox"></div>
    <button class="chip" id="brkReset" style="margin-top:12px">↺ Reiniciar simulación</button>`;
  box.querySelectorAll(".row[data-team]").forEach(row=>row.onclick=()=>{
    const {t:tId,r,k,team}=row.dataset;
    sim[tId]=sim[tId]||{}; sim[tId][r]=sim[tId][r]||{}; sim[tId][r][k]=team; renderCuadro();
  });
  box.querySelectorAll(".brk-tab").forEach(el=>el.onclick=()=>{activeBrk=+el.dataset.i; renderCuadro();});
  const rst=$("#brkReset"); if(rst) rst.onclick=()=>{delete sim[t.id]; renderCuadro();};
  // campeon
  const last=rounds[rounds.length-1].llaves[0];
  const champ=last?winnerOf(t.id,rounds.length-1,0,last):"";
  const cb=$("#champBox");
  if(champ&&cb){ cb.style.display="block";
    cb.innerHTML=esBoca(champ)?`🏆🎉 ¡${champ} CAMPEÓN!`:`🏆 ${champ} — Campeón simulado`;
    cb.style.background=esBoca(champ)?"linear-gradient(120deg,var(--oro),#e6b400)":"linear-gradient(120deg,#adb5bd,#868e96)";
    cb.style.color=esBoca(champ)?"var(--azul)":"#fff";
  }
}

/* ---------- vista FIGURAS ---------- */
const STAT_META={goleadores:{tab:"⚽ Goles",lbl:"Goles",cls:"goles",head:"⚽ Goleadores"},
  asistidores:{tab:"🅰️ Asist.",lbl:"Asist.",cls:"asist",head:"🅰️ Asistidores"},
  amarillas:{tab:"🟨 Amar.",lbl:"Amar.",cls:"amaril",head:"🟨 Amarillas"}};
function renderFiguras(){
  const box=$("#panel");
  if(compSel!=="128"){ box.innerHTML=`<div class="state">Los rankings están disponibles para la Liga Profesional.</div>`; return; }
  const tabs=`<div class="stat-tabs">${Object.keys(STAT_META).map(k=>`<span class="stat-tab ${k===activeStat?'on':''}" data-k="${k}">${STAT_META[k].tab}</span>`).join("")}</div>`;
  const meta=STAT_META[activeStat], filas=STATS[activeStat]||[];
  const rows=filas.length?filas.map((r,i)=>{
    const pos=i+1, pc=pos<=3?`top${pos}`:"";
    const foto=r.foto?`<img class="rank-foto" src="${r.foto}" onerror="this.style.visibility='hidden'">`:`<div class="rank-foto"></div>`;
    const logo=r.logoEquipo?`<img src="${r.logoEquipo}" onerror="this.remove()">`:"";
    const val=activeStat==="amarillas"?`${r.valor} <span class="card-amar"></span>`:r.valor;
    return `<div class="rank-row ${r.boca?'boca-row':''}"><div class="rank-pos ${pc}">${pos}</div>${foto}
      <div class="rank-info"><div class="rank-nombre">${r.boca?'⭐ ':''}${r.jugador}</div>
      <div class="rank-eq">${logo}${r.equipo}</div></div>
      <div class="rank-val"><div class="rank-num ${meta.cls}">${val}</div><div class="rank-lbl">${meta.lbl}</div>
      <div class="rank-pj">${r.partidos} PJ</div></div></div>`;
  }).join(""):`<div class="state">Sin datos.</div>`;
  box.innerHTML=`${tabs}<div class="rank-wrap"><div class="rank-head">${meta.head} · Liga Profesional</div>${rows}</div>`;
  box.querySelectorAll(".stat-tab").forEach(el=>el.onclick=()=>{activeStat=el.dataset.k; renderFiguras();});
}

/* ---------- navegacion ---------- */
function renderSubTabs(){
  const comp=compSel;
  const tabs=[["partidos","📅 Partidos"]];
  if(STAND.find(l=>l.id===comp)) tabs.push(["tabla","📊 Tabla"]);
  const hayCuadro = comp==="128" ? BRACKETS.some(t=>t.tipo==="liga-proy")
    : BRACKETS.some(t=>t.nombre.toLowerCase().includes((COMP_NOMBRES[comp]||"").toLowerCase()));
  if(hayCuadro) tabs.push(["cuadro", comp==="128"?"🧮 Playoffs":"🏆 Cuadro"]);
  if(comp==="128") tabs.push(["figuras","👟 Figuras"]);
  $("#subtabs").innerHTML=tabs.map(([v,l])=>`<div class="subtab ${v===subView?'on':''}" data-v="${v}">${l}</div>`).join("");
  $("#subtabs").querySelectorAll(".subtab").forEach(el=>el.onclick=()=>{subView=el.dataset.v; paint();});
}
function paint(){
  renderSubTabs();
  if(subView==="partidos") renderPartidos();
  else if(subView==="tabla") renderTabla();
  else if(subView==="cuadro") renderCuadro();
  else if(subView==="figuras") renderFiguras();
}
function renderCompTabs(){
  $("#comptabs").innerHTML=Object.entries(COMP_NOMBRES).map(([id,n])=>
    `<div class="comptab ${id===compSel?'on':''}" data-c="${id}">${n}</div>`).join("");
  $("#comptabs").querySelectorAll(".comptab").forEach(el=>el.onclick=()=>{
    compSel=el.dataset.c; subView="partidos"; activeZona=0; activeBrk=0; renderCompTabs(); paint();
  });
}

/* ---------- cuenta regresiva proximo partido de Boca ---------- */
let cdTimer=null;
function renderCountdown(){
  const todos=FIX.flatMap(c=>c.matches).filter(m=>m.boca);
  const next=todos.map(m=>({m,d:parseDate(m)})).filter(x=>x.d&&!isFin(estadoMatch(x.m))&&x.d>new Date()-3.6e6).sort((a,b)=>a.d-b.d)[0];
  const box=$("#countdown");
  if(!next){ box.style.display="none"; return; }
  box.style.display="flex";
  const {m,d}=next; clearInterval(cdTimer);
  const tick=()=>{const diff=d-new Date();
    if(diff<=0){$("#cdClock").textContent="¡EN JUEGO!";return;}
    const dd=Math.floor(diff/864e5),hh=Math.floor(diff%864e5/36e5),mm=Math.floor(diff%36e5/6e4),ss=Math.floor(diff%6e4/1e3);
    $("#cdClock").textContent=(dd?dd+"d ":"")+String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0")+":"+String(ss).padStart(2,"0");};
  box.querySelector(".mt").textContent=`${m.home} vs ${m.away}`;
  box.querySelector(".sub").textContent=`${m.liga} · ${fmt(m).full}`;
  tick(); cdTimer=setInterval(tick,1000);
}

/* ---------- carga ---------- */
async function getJSON(f){ const r=await fetch("data/"+f,{cache:"no-store"}); if(!r.ok) throw 0; return r.json(); }
async function load(){
  $("#panel").innerHTML=`<div class="state"><div class="spin"></div>Cargando datos…</div>`;
  try{
    const [fx,st,br,stt,lv]=await Promise.allSettled([
      getJSON("fixtures.json"),getJSON("standings.json"),getJSON("brackets.json"),
      getJSON("stats.json"),getJSON("live.json")]);
    if(fx.status==="fulfilled"){ FIX=fx.value.competencias||[]; GEN.fix=fx.value.generatedAt; }
    if(st.status==="fulfilled") STAND=st.value.ligas||[];
    if(br.status==="fulfilled") BRACKETS=br.value.torneos||[];
    if(stt.status==="fulfilled") STATS=stt.value||{};
    if(lv.status==="fulfilled") LIVE=lv.value.matches||[];
    if(GEN.fix) $("#updated").innerHTML=`Actualizado<br><b>${new Date(GEN.fix).toLocaleString("es-AR",{timeZone:TZ,day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</b>`;
  }catch(e){ $("#panel").innerHTML=`<div class="state">No se pudieron cargar los datos.</div>`; return; }
  renderCompTabs(); paint(); renderCountdown();
}
$("#btnRefresh")&&($("#btnRefresh").onclick=load);
load();
// refresco liviano del "en vivo" cada 60s (solo relee el json local, sin API)
setInterval(async()=>{ try{const lv=await getJSON("live.json");LIVE=lv.value?lv.value.matches:lv.matches||[];if(subView==="partidos")renderPartidos();renderCountdown();}catch(e){} },60000);
