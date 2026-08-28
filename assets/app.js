/* =====================================================================
   app.js · App INTEGRAL FULL · todas las mejoras (client-side, 0 requests extra)
   ===================================================================== */
const TZ="America/Argentina/Buenos_Aires";
let FIX=[],STAND=[],BRACKETS=[],STATS={},LIVE=[],ANUAL=null,DETAILS={},GEN={};
let compSel="128", subView="partidos";
let activeZona=0, activeBrk=0, activeStat="goleadores", anualView="anual";
let filtroBoca=false, buscando="";
const $=s=>document.querySelector(s);
const COMP_NOMBRES={"128":"Liga Profesional","130":"Copa Argentina","11":"Copa Sudamericana","13":"Copa Libertadores"};
const esBoca=n=>(n||"").toLowerCase().includes("boca");

/* ---------- preferencias (localStorage) ---------- */
const PREF={
  get fav(){return localStorage.getItem("favTeam")||"Boca Juniors";},
  set fav(v){localStorage.setItem("favTeam",v);},
  get dark(){return localStorage.getItem("dark")==="1";},
  set dark(v){localStorage.setItem("dark",v?"1":"0");},
  get compact(){return localStorage.getItem("compact")==="1";},
  set compact(v){localStorage.setItem("compact",v?"1":"0");}
};
const esFav=n=>(n||"").toLowerCase().includes(PREF.fav.toLowerCase().split(" ")[0]);
function aplicarTema(){
  document.body.classList.toggle("dark",PREF.dark);
  document.body.classList.toggle("compact",PREF.compact);
}

/* ---------- fechas ---------- */
function parseDate(m){let iso=m.timestamp;if(iso&&!/[zZ]|[+-]\d\d:?\d\d$/.test(iso))iso+="Z";let d=iso?new Date(iso):null;
  if((!d||isNaN(d))&&m.date){const t=(m.time&&m.time!=="00:00:00")?m.time:"00:00:00";d=new Date(m.date+"T"+t+"Z");}return(d&&!isNaN(d))?d:null;}
function fmt(m){const d=parseDate(m),noTime=!m.time||m.time==="00:00:00";
  if(!d)return{hh:"?",dd:m.date||"",key:m.date||"z",full:m.date||""};
  return{hh:noTime?"A conf.":d.toLocaleTimeString("es-AR",{timeZone:TZ,hour:"2-digit",minute:"2-digit"}),
    dd:d.toLocaleDateString("es-AR",{timeZone:TZ,weekday:"short",day:"2-digit",month:"short"}),
    key:d.toLocaleDateString("en-CA",{timeZone:TZ}),
    full:d.toLocaleDateString("es-AR",{timeZone:TZ,weekday:"long",day:"numeric",month:"long"}),date:d};}
function estadoMatch(m){const lv=LIVE.find(x=>x.id===m.id);return lv?{...m,homeScore:lv.homeScore,awayScore:lv.awayScore,status:lv.status,_live:true}:m;}
function isFin(m){return["FT","AET","PEN"].includes(m.status);}

/* ---------- calendario .ics ---------- */
function descargarICS(m){
  const d=parseDate(m); if(!d) return;
  const dt=x=>x.toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
  const fin=new Date(d.getTime()+2*3600*1000);
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","BEGIN:VEVENT",
    "UID:"+m.id+"@futbolar","DTSTAMP:"+dt(new Date()),
    "DTSTART:"+dt(d),"DTEND:"+dt(fin),
    "SUMMARY:"+m.home+" vs "+m.away+" ("+m.liga+")",
    "LOCATION:"+(m.venue||""),"DESCRIPTION:Partido de "+m.liga,
    "BEGIN:VALARM","TRIGGER:-PT60M","ACTION:DISPLAY","DESCRIPTION:Falta 1h para el partido","END:VALARM",
    "END:VEVENT","END:VCALENDAR"].join("\r\n");
  const blob=new Blob([ics],{type:"text/calendar"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download=(m.home+"-"+m.away).replace(/\s/g,"_")+".ics";a.click();
}
function compartir(m){
  const w=fmt(m);
  const txt=`⚽ ${m.home} vs ${m.away}\n🏆 ${m.liga}\n📅 ${w.full} ${w.hh}\n📍 ${m.venue||""}`;
  if(navigator.share){navigator.share({title:"Partido",text:txt}).catch(()=>{});}
  else{window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank");}
}

/* ---------- tarjeta de partido ---------- */
function condBadge(m){return m.neutral?'<span class="badge b-neutral">◈ NEUTRAL</span>':"";}
function card(m){
  m=estadoMatch(m);
  const w=fmt(m),fin=isFin(m),live=m._live;
  const hb=m.homeLogo?`<img src="${m.homeLogo}" onerror="this.remove()">`:"";
  const ab=m.awayLogo?`<img src="${m.awayLogo}" onerror="this.remove()">`:"";
  const hs=m.homeScore??"",as=m.awayScore??"";
  const hw=(fin||live)&&hs!==""&&+hs>+as,aw=(fin||live)&&as!==""&&+as>+hs;
  const favCls=(esFav(m.home)||esFav(m.away))?"is-boca":"";
  const star=n=>esFav(n)?'⭐ ':'';
  let estado;
  if(live)estado=`<span class="hh live">● ${m.status}</span>`;
  else if(fin)estado='<span class="hh" style="font-size:12px;color:var(--muted)">FIN</span>';
  else estado=`<span class="hh">${w.hh==="A conf."?"?":w.hh}</span>`;
  const tieneDet=DETAILS[m.id];
  const acciones=!fin?`<div class="mrow-actions">
      <button class="mini" onclick="event.stopPropagation();window._ics(${m.id})">📅</button>
      <button class="mini" onclick="event.stopPropagation();window._share(${m.id})">↗</button>
    </div>`:"";
  return `<div class="match ${favCls}" ${tieneDet?`onclick="window._ficha(${m.id})" style="cursor:pointer"`:""}>
    <div class="comp-strip">${m.round||""} ${condBadge(m)} ${tieneDet?'<span class="hasdet">ⓘ ficha</span>':''}</div>
    <div class="whenbox">${estado}<div class="dd">${w.dd}</div></div>
    <div class="sides">
      <div class="side ${aw?'dim':''}">${hb}${star(m.home)}${m.home}<span class="sc">${hs}</span></div>
      <div class="side ${hw?'dim':''}">${ab}${star(m.away)}${m.away}<span class="sc">${as}</span></div>
    </div>
    ${m.venue?`<div class="venue">📍 ${m.venue}</div>`:""}
    ${acciones}
  </div>`;
}
function groupDays(list){const g={};list.forEach(m=>{const w=fmt(m);(g[w.key]=g[w.key]||{label:w.full,items:[]}).items.push(m);});
  return Object.keys(g).sort().map(k=>`<div class="dayhead">${g[k].label}</div>${g[k].items.map(card).join("")}`).join("");}
window._ics=id=>{const m=allMatches().find(x=>x.id===id);if(m)descargarICS(m);};
window._share=id=>{const m=allMatches().find(x=>x.id===id);if(m)compartir(m);};
function allMatches(){return FIX.flatMap(c=>c.matches);}

/* ---------- ficha de partido (modal) ---------- */
window._ficha=id=>{
  const m=allMatches().find(x=>x.id===id); const det=DETAILS[id]; if(!m||!det)return;
  const evs=(det.eventos||[]).map(e=>{
    const ic=e.tipo==="Goal"?"⚽":e.tipo==="Card"?(e.detalle&&e.detalle.includes("Red")?"🟥":"🟨"):e.tipo==="subst"?"🔁":"•";
    return `<div class="ev"><span class="ev-min">${e.min??""}'</span><span>${ic} ${e.jugador||""} <b style="color:var(--muted);font-weight:600">${e.equipo}</b>${e.asist?` · asist. ${e.asist}`:""}</span></div>`;
  }).join("")||'<div class="state" style="padding:16px">Sin eventos cargados.</div>';
  const forms=(det.formaciones||[]).map(f=>`<div class="form-col"><div class="form-eq">${f.equipo} <span style="color:var(--muted)">${f.esquema||""}</span></div>${(f.titulares||[]).map(t=>`<div class="form-p">${t}</div>`).join("")}</div>`).join("");
  $("#modalBody").innerHTML=`<h3 style="margin-bottom:4px">${m.home} vs ${m.away}</h3>
    <div style="color:var(--muted);font-size:13px;margin-bottom:12px">${m.liga} · ${fmt(m).full}</div>
    <h4 class="modal-h">Eventos</h4>${evs}
    ${forms?`<h4 class="modal-h">Formaciones</h4><div class="forms">${forms}</div>`:""}`;
  $("#modal").classList.add("show");
};
window._closeModal=()=>$("#modal").classList.remove("show");

/* ---------- vista PARTIDOS ---------- */
function renderPartidos(){
  const comp=FIX.find(c=>c.id===compSel); const box=$("#panel");
  if(!comp){box.innerHTML=`<div class="state">No hay partidos.</div>`;return;}
  let arr=comp.matches.slice();
  if(buscando){const q=buscando.toLowerCase();arr=arr.filter(m=>(m.home+m.away).toLowerCase().includes(q));}
  if(filtroBoca)arr=arr.filter(m=>esFav(m.home)||esFav(m.away));
  const prox=arr.filter(m=>!isFin(estadoMatch(m))),jug=arr.filter(m=>isFin(estadoMatch(m)));
  const favChip=comp.matches.some(m=>esFav(m.home)||esFav(m.away))?`<span class="chip ${filtroBoca?'on':''}" id="chipFav">⭐ Solo ${PREF.fav.split(" ")[0]}</span>`:"";
  box.innerHTML=`<div class="chips">${favChip}
      <span class="chip on" data-sub="prox2">Próximos (${prox.length})</span>
      <span class="chip" data-sub="jug2">Jugados (${jug.length})</span></div><div id="subPart"></div>`;
  const r2=w=>{$("#subPart").innerHTML=w==="jug2"?(jug.length?groupDays(jug.slice().reverse()):`<div class="state">Sin resultados.</div>`):(prox.length?groupDays(prox):`<div class="state">Sin próximos.</div>`);};
  r2("prox2");
  box.querySelectorAll(".chip[data-sub]").forEach(c=>c.onclick=()=>{box.querySelectorAll(".chip[data-sub]").forEach(x=>x.classList.remove("on"));c.classList.add("on");r2(c.dataset.sub);});
  const cf=$("#chipFav");if(cf)cf.onclick=()=>{filtroBoca=!filtroBoca;renderPartidos();};
}

/* ---------- vista TABLA ---------- */
function formaHTML(f){return f?`<span class="forma">${f.slice(-5).split("").map(c=>`<span class="f-${c}">${c}</span>`).join("")}</span>`:"";}
function zonaClase(pos,total){if(pos<=1)return"zona-lib";if(pos<=(total>10?8:4))return"zona-sud";return"";}
function renderTabla(){
  const box=$("#panel"),liga=STAND.find(l=>l.id===compSel);
  if(!liga){box.innerHTML=`<div class="state">Esta competencia es de eliminación directa (sin tabla).</div>`;return;}
  const tabs=liga.grupos.length>1?`<div class="tbl-tabs">${liga.grupos.map((g,i)=>`<span class="tbl-tab ${i===activeZona?'on':''}" data-i="${i}">${g.grupo}</span>`).join("")}</div>`:"";
  const g=liga.grupos[activeZona]||liga.grupos[0],total=g.filas.length;
  const rows=g.filas.map(r=>`<tr class="${esFav(r.equipo)?'boca-row':''}">
    <td class="pos-n ${zonaClase(r.pos,total)}">${r.pos}</td>
    <td class="eq"><img src="${r.logo}" onerror="this.remove()">${esFav(r.equipo)?'⭐ ':''}${r.equipo}</td>
    <td>${r.pj}</td><td class="hide-m">${r.g}</td><td class="hide-m">${r.e}</td><td class="hide-m">${r.p}</td>
    <td class="hide-m">${r.gf}:${r.gc}</td><td>${r.dg>0?'+':''}${r.dg}</td><td class="pts">${r.pts}</td><td class="hide-m">${formaHTML(r.forma)}</td></tr>`).join("");
  box.innerHTML=`${tabs}<div class="tabla-wrap"><div class="tabla-head">📊 ${g.grupo} · ${liga.name}</div>
    <table class="pos"><thead><tr><th>#</th><th class="eq">Equipo</th><th>PJ</th>
    <th class="hide-m">G</th><th class="hide-m">E</th><th class="hide-m">P</th><th class="hide-m">GF:GC</th><th>DG</th><th>Pts</th><th class="hide-m">Últ.5</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="tbl-leyenda"><span><b class="zona-lib" style="padding-left:6px">▍</b> Puntero</span><span><b class="zona-sud" style="padding-left:6px">▍</b> Zona playoff</span></div></div>`;
  box.querySelectorAll(".tbl-tab").forEach(el=>el.onclick=()=>{activeZona=+el.dataset.i;renderTabla();});
}

/* ---------- vista ANUAL (anual / promedios / descensos) ---------- */
function renderAnual(){
  const box=$("#panel");
  if(!ANUAL){box.innerHTML=`<div class="state">La tabla anual se genera cuando haya partidos jugados.</div>`;return;}
  const sub=`<div class="tbl-tabs">
    <span class="tbl-tab ${anualView==='anual'?'on':''}" data-v="anual">Tabla anual</span>
    <span class="tbl-tab ${anualView==='promedios'?'on':''}" data-v="promedios">Promedios / Descensos</span></div>`;
  let rows,head,leyenda;
  if(anualView==="anual"){
    rows=ANUAL.anual.map(r=>`<tr class="${esFav(r.equipo)?'boca-row':''}">
      <td class="pos-n ${r.copa2027==='Libertadores'?'zona-lib':(r.copa2027?'zona-sud':'')}">${r.pos}</td>
      <td class="eq"><img src="${r.logo}" onerror="this.remove()">${esFav(r.equipo)?'⭐ ':''}${r.equipo}</td>
      <td>${r.pj}</td><td>${r.pts}</td><td class="hide-m">${r.dg>0?'+':''}${r.dg}</td>
      <td class="hide-m" style="font-size:11px;color:var(--muted)">${r.copa2027||''}</td></tr>`).join("");
    head=`<th>#</th><th class="eq">Equipo</th><th>PJ</th><th>Pts</th><th class="hide-m">DG</th><th class="hide-m">Copa 2027</th>`;
    leyenda=`<span><b class="zona-lib" style="padding-left:6px">▍</b> Libertadores 2027</span><span><b class="zona-sud" style="padding-left:6px">▍</b> Sudamericana 2027</span>`;
  }else{
    rows=ANUAL.promedios.map(r=>`<tr class="${esFav(r.equipo)?'boca-row':''} ${r.desciende?'desc-row':''}">
      <td class="pos-n ${r.desciende?'zona-desc':''}">${r.pos}</td>
      <td class="eq"><img src="${r.logo}" onerror="this.remove()">${esFav(r.equipo)?'⭐ ':''}${r.equipo}</td>
      <td>${r.pj}</td><td>${r.pts}</td><td class="pts">${r.prom.toFixed(3)}</td>
      <td class="hide-m">${r.desciende?'⬇ Desciende':''}</td></tr>`).join("");
    head=`<th>#</th><th class="eq">Equipo</th><th>PJ</th><th>Pts</th><th>Prom.</th><th class="hide-m"></th>`;
    leyenda=`<span><b class="zona-desc" style="padding-left:6px">▍</b> Zona de descenso (2 peores promedios)</span>`;
  }
  box.innerHTML=`${sub}<div class="tabla-wrap"><div class="tabla-head">📅 ${anualView==='anual'?'Tabla anual':'Promedios y descensos'} · Liga Profesional</div>
    <table class="pos"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
    <div class="tbl-leyenda">${leyenda}<span style="color:var(--muted)">Calculado con los partidos jugados de la temporada.</span></div></div>`;
  box.querySelectorAll(".tbl-tab").forEach(el=>el.onclick=()=>{anualView=el.dataset.v;renderAnual();});
}

/* ---------- vista CUADRO ---------- */
const sim={};
function winnerOf(tId,r,k,ll){if(ll.ganador)return ll.ganador;return(sim[tId]&&sim[tId][r]&&sim[tId][r][k])||"";}
function computeRounds(t){const rounds=t.rondas.map(r=>({nombre:r.nombre,llaves:r.llaves.map(l=>({...l}))}));
  for(let r=0;r<rounds.length-1;r++){rounds[r].llaves.forEach((ll,k)=>{const w=winnerOf(t.id,r,k,ll),nk=Math.floor(k/2),slot=(k%2===0)?"a":"b";
    if(rounds[r+1].llaves[nk]&&!rounds[r+1].llaves[nk].ganador)rounds[r+1].llaves[nk][slot]=w||rounds[r+1].llaves[nk][slot]||"";});}return rounds;}
function rowB(t,r,k,team,score,ll){if(!team)return`<div class="row empty">Por definir</div>`;
  const w=winnerOf(t.id,r,k,ll),cls=w?(w===team?"win":"lose"):"",cc=!ll.ganador;
  return`<div class="row ${cls}" ${cc?`data-t="${t.id}" data-r="${r}" data-k="${k}" data-team="${team}"`:'style="cursor:default"'}><span>${esFav(team)?'⭐ ':''}${team}</span><span class="sc">${score||''}</span></div>`;}
function tieB(t,r,k,ll){const boca=ll.boca||esFav(ll.a)||esFav(ll.b)||esFav(winnerOf(t.id,r,k,ll));
  return`<div class="tie ${boca?'boca':''}">${rowB(t,r,k,ll.a,ll.ga,ll)}${rowB(t,r,k,ll.b,ll.gb,ll)}${ll.detalle?`<div class="det">${ll.detalle}</div>`:''}</div>`;}
function renderCuadro(){
  const box=$("#panel");
  const torneos=BRACKETS.filter(t=>compSel==="128"?t.tipo==="liga-proy":(COMP_NOMBRES[compSel]&&t.nombre.toLowerCase().includes(COMP_NOMBRES[compSel].toLowerCase())));
  if(!torneos.length){box.innerHTML=`<div class="state">No hay cuadro para esta competencia todavía.</div>`;return;}
  const t=torneos[Math.min(activeBrk,torneos.length-1)];
  const multi=torneos.length>1?`<div class="brk-tabs">${torneos.map((x,i)=>`<span class="brk-tab ${i===activeBrk?'on':''}" data-i="${i}">${x.nombre}</span>`).join("")}</div>`:"";
  const nota=t.nota?`<div class="brk-info">📐 ${t.nota}</div>`:`<div class="brk-info"><span class="brk-hint">Tocá un equipo para simular quién avanza.</span></div>`;
  const rounds=computeRounds(t);
  box.innerHTML=`${multi}${nota}<div class="bracket">${rounds.map((r,ri)=>`<div class="round"><h3>${r.nombre}</h3>${r.llaves.map((ll,ki)=>tieB(t,ri,ki,ll)).join("")}</div>`).join("")}</div>
    <div class="champ-box" id="champBox"></div><button class="chip" id="brkReset" style="margin-top:12px">↺ Reiniciar simulación</button>`;
  box.querySelectorAll(".row[data-team]").forEach(row=>row.onclick=()=>{const{t:tId,r,k,team}=row.dataset;sim[tId]=sim[tId]||{};sim[tId][r]=sim[tId][r]||{};sim[tId][r][k]=team;renderCuadro();});
  box.querySelectorAll(".brk-tab").forEach(el=>el.onclick=()=>{activeBrk=+el.dataset.i;renderCuadro();});
  const rst=$("#brkReset");if(rst)rst.onclick=()=>{delete sim[t.id];renderCuadro();};
  const last=rounds[rounds.length-1].llaves[0],champ=last?winnerOf(t.id,rounds.length-1,0,last):"",cb=$("#champBox");
  if(champ&&cb){cb.style.display="block";cb.innerHTML=esFav(champ)?`🏆🎉 ¡${champ} CAMPEÓN!`:`🏆 ${champ} — Campeón simulado`;
    cb.style.background=esFav(champ)?"linear-gradient(120deg,var(--oro),#e6b400)":"linear-gradient(120deg,#adb5bd,#868e96)";cb.style.color=esFav(champ)?"var(--azul)":"#fff";}
}

/* ---------- vista FIGURAS ---------- */
const STAT_META={goleadores:{tab:"⚽ Goles",lbl:"Goles",cls:"goles",head:"⚽ Goleadores"},asistidores:{tab:"🅰️ Asist.",lbl:"Asist.",cls:"asist",head:"🅰️ Asistidores"},amarillas:{tab:"🟨 Amar.",lbl:"Amar.",cls:"amaril",head:"🟨 Amarillas"}};
function renderFiguras(){
  const box=$("#panel");
  if(compSel!=="128"){box.innerHTML=`<div class="state">Los rankings están disponibles para la Liga Profesional.</div>`;return;}
  const tabs=`<div class="stat-tabs">${Object.keys(STAT_META).map(k=>`<span class="stat-tab ${k===activeStat?'on':''}" data-k="${k}">${STAT_META[k].tab}</span>`).join("")}</div>`;
  const meta=STAT_META[activeStat],filas=STATS[activeStat]||[];
  const rows=filas.length?filas.map((r,i)=>{const pos=i+1,pc=pos<=3?`top${pos}`:"";
    const foto=r.foto?`<img class="rank-foto" src="${r.foto}" onerror="this.style.visibility='hidden'">`:`<div class="rank-foto"></div>`;
    const logo=r.logoEquipo?`<img src="${r.logoEquipo}" onerror="this.remove()">`:"";
    const val=activeStat==="amarillas"?`${r.valor} <span class="card-amar"></span>`:r.valor;
    return`<div class="rank-row ${esFav(r.equipo)?'boca-row':''}"><div class="rank-pos ${pc}">${pos}</div>${foto}
      <div class="rank-info"><div class="rank-nombre">${esFav(r.equipo)?'⭐ ':''}${r.jugador}</div><div class="rank-eq">${logo}${r.equipo}</div></div>
      <div class="rank-val"><div class="rank-num ${meta.cls}">${val}</div><div class="rank-lbl">${meta.lbl}</div><div class="rank-pj">${r.partidos} PJ</div></div></div>`;}).join(""):`<div class="state">Sin datos.</div>`;
  box.innerHTML=`${tabs}<div class="rank-wrap"><div class="rank-head">${meta.head} · Liga Profesional</div>${rows}</div>`;
  box.querySelectorAll(".stat-tab").forEach(el=>el.onclick=()=>{activeStat=el.dataset.k;renderFiguras();});
}

/* ---------- navegacion ---------- */
function renderSubTabs(){
  const c=compSel,tabs=[["partidos","📅 Partidos"]];
  if(STAND.find(l=>l.id===c))tabs.push(["tabla","📊 Tabla"]);
  if(c==="128"){tabs.push(["anual","📅 Anual"]);}
  const hayCuadro=c==="128"?BRACKETS.some(t=>t.tipo==="liga-proy"):BRACKETS.some(t=>t.nombre.toLowerCase().includes((COMP_NOMBRES[c]||"").toLowerCase()));
  if(hayCuadro)tabs.push(["cuadro",c==="128"?"🧮 Playoffs":"🏆 Cuadro"]);
  if(c==="128")tabs.push(["figuras","👟 Figuras"]);
  $("#subtabs").innerHTML=tabs.map(([v,l])=>`<div class="subtab ${v===subView?'on':''}" data-v="${v}">${l}</div>`).join("");
  $("#subtabs").querySelectorAll(".subtab").forEach(el=>el.onclick=()=>{subView=el.dataset.v;paint();});
}
function paint(){renderSubTabs();
  ({partidos:renderPartidos,tabla:renderTabla,anual:renderAnual,cuadro:renderCuadro,figuras:renderFiguras}[subView]||renderPartidos)();}
function renderCompTabs(){
  $("#comptabs").innerHTML=Object.entries(COMP_NOMBRES).map(([id,n])=>`<div class="comptab ${id===compSel?'on':''}" data-c="${id}">${n}</div>`).join("");
  $("#comptabs").querySelectorAll(".comptab").forEach(el=>el.onclick=()=>{compSel=el.dataset.c;subView="partidos";activeZona=0;activeBrk=0;renderCompTabs();paint();});
}

/* ---------- cuenta regresiva ---------- */
let cdTimer=null;
function renderCountdown(){
  const todos=allMatches().filter(m=>esFav(m.home)||esFav(m.away));
  const next=todos.map(m=>({m,d:parseDate(m)})).filter(x=>x.d&&!isFin(estadoMatch(x.m))&&x.d>new Date()-3.6e6).sort((a,b)=>a.d-b.d)[0];
  const box=$("#countdown");if(!next){box.style.display="none";return;}
  box.style.display="flex";const{m,d}=next;clearInterval(cdTimer);
  const tick=()=>{const diff=d-new Date();if(diff<=0){$("#cdClock").textContent="¡EN JUEGO!";return;}
    const dd=Math.floor(diff/864e5),hh=Math.floor(diff%864e5/36e5),mm=Math.floor(diff%36e5/6e4),ss=Math.floor(diff%6e4/1e3);
    $("#cdClock").textContent=(dd?dd+"d ":"")+String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0")+":"+String(ss).padStart(2,"0");};
  box.querySelector(".mt").textContent=`${m.home} vs ${m.away}`;
  box.querySelector(".sub").textContent=`${m.liga} · ${fmt(m).full}`;
  box.querySelector("#cdIcs").onclick=()=>descargarICS(m);
  tick();cdTimer=setInterval(tick,1000);
}

/* ---------- barra superior: buscador, favorito, tema, compacto ---------- */
function initTopBar(){
  $("#search").addEventListener("input",e=>{buscando=e.target.value;if(subView==="partidos")renderPartidos();});
  $("#btnDark").onclick=()=>{PREF.dark=!PREF.dark;aplicarTema();$("#btnDark").textContent=PREF.dark?"☀️":"🌙";};
  $("#btnCompact").onclick=()=>{PREF.compact=!PREF.compact;aplicarTema();$("#btnCompact").textContent=PREF.compact?"▤":"▦";};
  $("#btnDark").textContent=PREF.dark?"☀️":"🌙";
  $("#btnCompact").textContent=PREF.compact?"▤":"▦";
  // selector de equipo favorito
  $("#favSel").onchange=e=>{PREF.fav=e.target.value;paint();renderCountdown();};
}
function poblarFav(){
  const eqs=[...new Set(allMatches().flatMap(m=>[m.home,m.away]))].sort();
  $("#favSel").innerHTML=eqs.map(e=>`<option ${e.toLowerCase().includes(PREF.fav.toLowerCase().split(" ")[0])?"selected":""}>${e}</option>`).join("");
}

/* ---------- carga ---------- */
async function getJSON(f){const r=await fetch("data/"+f,{cache:"no-store"});if(!r.ok)throw 0;return r.json();}
async function load(){
  $("#panel").innerHTML=`<div class="state"><div class="spin"></div>Cargando datos…</div>`;
  const R=await Promise.allSettled([getJSON("fixtures.json"),getJSON("standings.json"),getJSON("brackets.json"),getJSON("stats.json"),getJSON("live.json"),getJSON("anual.json"),getJSON("details.json")]);
  const [fx,st,br,stt,lv,an,dt]=R;
  if(fx.status==="fulfilled"){FIX=fx.value.competencias||[];GEN.fix=fx.value.generatedAt;}
  if(st.status==="fulfilled")STAND=st.value.ligas||[];
  if(br.status==="fulfilled")BRACKETS=br.value.torneos||[];
  if(stt.status==="fulfilled")STATS=stt.value||{};
  if(lv.status==="fulfilled")LIVE=lv.value.matches||[];
  if(an.status==="fulfilled")ANUAL=an.value;
  if(dt.status==="fulfilled")DETAILS=dt.value.partidos||{};
  if(GEN.fix)$("#updated").innerHTML=`Actualizado<br><b>${new Date(GEN.fix).toLocaleString("es-AR",{timeZone:TZ,day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</b>`;
  poblarFav();renderCompTabs();paint();renderCountdown();
}
$("#btnRefresh")&&($("#btnRefresh").onclick=load);
aplicarTema();initTopBar();load();
setInterval(async()=>{try{const lv=await getJSON("live.json");LIVE=lv.matches||[];if(subView==="partidos")renderPartidos();renderCountdown();}catch(e){}},60000);
