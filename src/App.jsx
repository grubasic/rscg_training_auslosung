import React, { useEffect, useMemo, useState } from "react";

const MASTER = ["Andreas Moitzi","Annina Ebhardt","Anton Pleva","Bernd Engelbrecht","Christian Grasgruber","Christoph Krainer","David Edlinger","Georg Schenn","Gerwin Hofmeister","Jakob Beck","Marc Trummer","Martin Ehrenreich","Mathias Heschl","Nikolaus Kronabitter","Patrick Gruber","Patrick Tatzer","Simon Kampitsch","Stefan Gruber","Stefan Steiner"];
const TIMES=["00:00–00:30","00:30–01:00","01:00–01:30","01:30–02:00"];
const GUEST="__guest__", SELECT_KEY="rscg-select-v5", HISTORY_KEY="rscg-history-v5";
const empty=()=>Array.from({length:8},()=>({kind:"fixed",name:"",guest:""}));
const shuffle=x=>{const a=[...x];for(let i=a.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const idxKey=(a,b)=>[a,b].sort((x,y)=>x-y).join("-");
const nameKey=(a,b)=>[a.toLocaleLowerCase("de"),b.toLocaleLowerCase("de")].sort().join("|");
function matchings(a){if(!a.length)return[[]];const f=a[0],out=[];for(let i=1;i<a.length;i++){const rest=a.filter((_,n)=>n!==0&&n!==i);for(const m of matchings(rest))out.push([[f,a[i]],...m]);}return out;}
const ALL=matchings([0,1,2,3,4,5,6,7]);

function drawSchedule(players, fixedPairs, history){
  const past=new Map(); history.forEach(h=>(h.pairs||[]).forEach(k=>past.set(k,(past.get(k)||0)+1)));
  const used=new Set(), rounds=[];
  const required=Array.from({length:4},(_,r)=>fixedPairs.filter(p=>p.rounds>r).map(p=>[players.indexOf(p.a),players.indexOf(p.b)]));
  function search(r){
    if(r===4)return true;
    const req=new Set(required[r].map(p=>idxKey(...p)));
    const choices=ALL.filter(m=>{
      const keys=new Set(m.map(p=>idxKey(...p)));
      if(![...req].every(k=>keys.has(k)))return false;
      return m.every(([a,b])=>!used.has(nameKey(players[a],players[b]))||req.has(idxKey(a,b)));
    }).map(m=>({m,score:m.reduce((s,[a,b])=>s+(past.get(nameKey(players[a],players[b]))||0),0)+Math.random()*.15})).sort((a,b)=>a.score-b.score);
    for(const {m} of choices){
      const added=[];m.forEach(([a,b])=>{const k=nameKey(players[a],players[b]);if(!used.has(k)){used.add(k);added.push(k);}});rounds.push(shuffle(m));
      if(search(r+1))return true;rounds.pop();added.forEach(k=>used.delete(k));
    } return false;
  }
  if(!search(0))return null;
  return rounds.map((teams,r)=>{const t=shuffle(teams);return {fixed:required[r],matches:[{court:1,a:t[0],b:t[1]},{court:2,a:t[2],b:t[3]}]};});
}

function whatsapp(schedule,players){const lines=["🎾 *RSCG Training*",""];schedule.forEach((round,r)=>{const fixed=new Set(round.fixed.map(p=>idxKey(...p)));lines.push(`*Runde ${r+1} (${TIMES[r]})*`);round.matches.forEach(m=>{const fa=fixed.has(idxKey(...m.a))?" 🔒":"",fb=fixed.has(idxKey(...m.b))?" 🔒":"";lines.push(`Platz ${m.court}: ${players[m.a[0]]} / ${players[m.a[1]]}${fa} vs. ${players[m.b[0]]} / ${players[m.b[1]]}${fb}`);});lines.push("");});return lines.join("\n");}
function Team({pair,players,fixed,tone}){return <div className={`team ${tone} ${fixed?"is-fixed":""}`}>{fixed&&<span className="fix">FIX</span>}<div>{players[pair[0]]}</div><small>&amp;</small><div>{players[pair[1]]}</div></div>}

export default function App(){
 const[slots,setSlots]=useState(empty);const[players,setPlayers]=useState([]);const[editing,setEditing]=useState(true);const[fixed,setFixed]=useState([]);const[schedule,setSchedule]=useState(null);const[history,setHistory]=useState([]);const[showHistory,setShowHistory]=useState(false);const[msg,setMsg]=useState("");
 useEffect(()=>{try{const s=JSON.parse(localStorage.getItem(SELECT_KEY)||"null"),h=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");if(Array.isArray(s)&&s.length===8)setSlots(s);if(Array.isArray(h))setHistory(h);}catch{}},[]);
 const names=useMemo(()=>slots.map(s=>s.kind==="guest"?s.guest.trim():s.name.trim()),[slots]);
 const selected=new Set(slots.filter(s=>s.kind==="fixed"&&s.name).map(s=>s.name));
 const valid=names.every(Boolean)&&new Set(names.map(n=>n.toLocaleLowerCase("de"))).size===8;
 const fixedValid=fixed.every(p=>p.a&&p.b&&p.a!==p.b)&&fixed.every((p,i)=>fixed.every((q,j)=>i===j||(![p.a,p.b].includes(q.a)&&![p.a,p.b].includes(q.b))));
 const changeSlot=(i,v)=>{setSlots(x=>x.map((s,n)=>n!==i?s:v===GUEST?{kind:"guest",name:"",guest:""}:{kind:"fixed",name:v,guest:""}));setSchedule(null)};
 const accept=()=>{setPlayers(names);setFixed([]);setEditing(false);setSchedule(null);localStorage.setItem(SELECT_KEY,JSON.stringify(slots));};
 const addPair=()=>fixed.length<4&&setFixed(x=>[...x,{id:crypto.randomUUID(),a:"",b:"",rounds:1}]);
 const updatePair=(id,v)=>{setFixed(x=>x.map(p=>p.id===id?{...p,...v}:p));setSchedule(null)};
 const run=()=>{const result=drawSchedule(players,fixed,history);if(!result)setMsg("Mit diesen Fixpaarungen ist keine gültige Auslosung möglich.");else{setSchedule(result);setMsg("");}};
 const save=()=>{const pairs=schedule.flatMap(r=>r.matches.flatMap(m=>[nameKey(players[m.a[0]],players[m.a[1]]),nameKey(players[m.b[0]],players[m.b[1]])]));const next=[{id:Date.now(),date:new Date().toLocaleDateString("de-AT"),players:[...players],pairs},...history];setHistory(next);localStorage.setItem(HISTORY_KEY,JSON.stringify(next));setMsg("Training wurde in der Partnerhistorie gespeichert.")};
 return <main><div className="container"><header><div className="badges"><b>2 Plätze</b><span>8 Teilnehmer</span><span>Fixpaarung: 1–4 Runden</span></div><h1>RSCG <em>Training</em></h1><p>Jede Fixpaarung wird nur einmal erfasst. Direkt daneben bestimmst du, für wie viele aufeinanderfolgende Runden sie gilt.</p></header><div className="layout">
 <aside className="panel sidebar"><div className="title"><h2>Teilnehmer</h2>{!editing&&<button className="link" onClick={()=>setEditing(true)}>Ändern</button>}</div>{editing?<div className="list">{slots.map((s,i)=><div className="slot" key={i}><label><b>{i+1}</b> Teilnehmer {i+1}</label><select value={s.kind==="guest"?GUEST:s.name} onChange={e=>changeSlot(i,e.target.value)}><option value="">Namen auswählen …</option>{MASTER.map(n=><option value={n} key={n} disabled={selected.has(n)&&s.name!==n}>{n}</option>)}<option value={GUEST}>+ Gastspieler eintragen</option></select>{s.kind==="guest"&&<input value={s.guest} placeholder="Name des Gastes" onChange={e=>setSlots(x=>x.map((q,n)=>n===i?{...q,guest:e.target.value}:q))}/>}</div>)}{!valid&&<div className="warning">Bitte acht unterschiedliche Teilnehmer auswählen.</div>}<button className="primary" disabled={!valid} onClick={accept}>Teilnehmer übernehmen</button></div>:<div className="grid">{players.map((n,i)=><div key={n}><b>{i+1}.</b> {n}</div>)}</div>}
 {!editing&&<section className="fixed"><div className="title"><h2>Fixe Paarungen</h2><button className="link" onClick={addPair}>+ Paarung</button></div>{!fixed.length&&<p className="hint">Optional. Jede Paarung nur einmal anlegen.</p>}{fixed.map((p,i)=><div className="pair" key={p.id}><div className="pair-title"><b>Paarung {i+1}</b><button onClick={()=>setFixed(x=>x.filter(q=>q.id!==p.id))}>×</button></div><div className="pair-row"><select value={p.a} onChange={e=>updatePair(p.id,{a:e.target.value})}><option value="">Spieler A</option>{players.map(n=><option key={n} value={n} disabled={fixed.some(q=>q.id!==p.id&&(q.a===n||q.b===n))}>{n}</option>)}</select><span>+</span><select value={p.b} onChange={e=>updatePair(p.id,{b:e.target.value})}><option value="">Spieler B</option>{players.map(n=><option key={n} value={n} disabled={n===p.a||fixed.some(q=>q.id!==p.id&&(q.a===n||q.b===n))}>{n}</option>)}</select></div><div className="round-count"><label>Anzahl Runden</label><select value={p.rounds} onChange={e=>updatePair(p.id,{rounds:Number(e.target.value)})}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} Runde{n>1?"n":""}</option>)}</select></div></div>)}{!fixedValid&&<div className="warning">Jeder Spieler darf nur in einer Fixpaarung vorkommen.</div>}</section>}
 <div className="actions"><button className="primary big" disabled={editing||players.length!==8||!fixedValid} onClick={run}>{schedule?"Neu auslosen":"Vier Runden auslosen"}</button>{schedule&&<><button className="wa" onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent(whatsapp(schedule,players))}`,"_blank")}>Per WhatsApp teilen</button><button className="secondary" onClick={()=>window.print()}>Drucken / als PDF speichern</button><button className="secondary cyan" onClick={save}>In Historie speichern</button></>}<button className="secondary" onClick={()=>setShowHistory(!showHistory)}>Partnerhistorie ({history.length})</button>{msg&&<div className="notice">{msg}</div>}</div><div className="rule"><strong>Logik</strong><br/>Eine Fixpaarung mit „3 Runden“ gilt automatisch für Runde 1, 2 und 3. Ab Runde 4 werden beide Spieler wieder normal ausgelost.</div></aside>
 <section className="content">{showHistory&&<div className="panel history"><div className="title"><h2>Partnerhistorie</h2>{history.length>0&&<button className="link danger" onClick={()=>{setHistory([]);localStorage.removeItem(HISTORY_KEY)}}>Löschen</button>}</div>{history.length?history.map(h=><div className="history-row" key={h.id}><b>{h.date}</b><span>{h.players.join(", ")}</span></div>):<p>Noch keine Trainings gespeichert.</p>}</div>}{!schedule?<div className="empty"><div>↻</div><h2>Bereit zur Auslosung</h2><p>Teilnehmer wählen, Fixpaarungen einmal anlegen und Rundenzahl bestimmen.</p></div>:schedule.map((r,i)=>{const fs=new Set(r.fixed.map(p=>idxKey(...p)));return <article className="panel round" key={i}><div className="round-head"><h2>Runde {i+1}</h2><span>{TIMES[i]}</span></div><div className="courts">{r.matches.map(m=><div className="court" key={m.court}><div className="court-head"><b>Platz {m.court}</b><span>MATCH</span></div><div className="vs"><Team pair={m.a} players={players} fixed={fs.has(idxKey(...m.a))} tone="blue"/><b>VS</b><Team pair={m.b} players={players} fixed={fs.has(idxKey(...m.b))} tone="pink"/></div></div>)}</div></article>})}</section>
 </div></div></main>;
}
