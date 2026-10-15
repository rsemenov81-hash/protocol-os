import {buildLevels, levelSeries, remainingAt, formatLevel, LEVEL_MODELS_KEY, HOUR} from './levels.js';
const {useState, useEffect, useMemo} = React;
const routeLabels = {unknown:'Route not recorded',inj:'Injection route unspecified',sc:'Subcutaneous',im:'Intramuscular',oral:'Oral',sl:'Sublingual',nasal:'Intranasal',iv:'Intravenous'};
const dateText = time => new Date(time).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});

function Trend({group, now}) {
  const [days,setDays] = useState(7);
  const [cursor,setCursor] = useState(120);
  const m = group.model;
  const points = useMemo(()=>levelSeries(group.entries,now,m.hours,days),[group.entries,now,m,days]);
  const high = useMemo(()=>m.range ? levelSeries(group.entries,now,m.range[1],days) : points,[group.entries,now,m,days,points]);
  const low = useMemo(()=>m.range ? levelSeries(group.entries,now,m.range[0],days) : points,[group.entries,now,m,days,points]);
  const max = Math.max(1,...high.map(p=>p.amount));
  const start = now-days*24*HOUR, x=t=>12+336*(t-start)/(now-start), y=a=>150-126*a/max;
  const path = p=>p.map((v,i)=>`${i?'L':'M'}${x(v.time).toFixed(2)},${y(v.amount).toFixed(2)}`).join(' ');
  const time = start+(now-start)*cursor/120;
  const value = remainingAt(group.entries,time,m.hours);
  return <div className="level-trend">
    <div className="level-toolbar"><span>Logged-dose trend</span><div className="level-ranges" aria-label="Chart time range">
      {[7,30,90].map(d=><button key={d} aria-pressed={days===d} onClick={()=>{setDays(d);setCursor(120);}}>{d}d</button>)}
    </div></div>
    <svg viewBox="0 0 360 178" role="img" aria-label={`${group.name}: estimated dose remaining over ${days} days. Current estimate ${formatLevel(group.remaining,group.unit)}. Use the slider below to inspect history.`}>
      {[24,87,150].map(v=><line key={v} x1="12" x2="348" y1={v} y2={v} stroke="var(--border)"/>)}
      <text x="12" y="14" fill="var(--text-dim)" fontSize="10">{formatLevel(max,group.unit)}</text>
      {m.range && <path d={`${path(high)} ${path([...low].reverse()).replace(/^M/,'L')} Z`} fill="var(--accent)" opacity=".14"/>}
      <path d={`${path(points)} L348,150 L12,150 Z`} fill="var(--accent)" opacity=".07"/>
      <path d={path(points)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round"/>
      <line x1={x(time)} x2={x(time)} y1="24" y2="150" stroke="var(--text-dim)" strokeDasharray="3 4"/>
      <circle cx={x(time)} cy={y(value)} r="4" fill="var(--accent)"/>
      <text x="12" y="172" fill="var(--text-dim)" fontSize="10">{days} days ago</text><text x="348" y="172" textAnchor="end" fill="var(--text-dim)" fontSize="10">Now</text>
    </svg>
    <label className="level-scrubber">Inspect history
      <input type="range" min="0" max="120" value={cursor} aria-label={`Inspect ${group.name} history`} aria-valuetext={`${dateText(time)}: ${formatLevel(value,group.unit)}`} onChange={e=>setCursor(+e.target.value)}/>
    </label>
    <div className="level-readout"><time>{cursor===120?'Now':dateText(time)}</time><strong>{formatLevel(value,group.unit)}</strong></div>
    <p className="level-caption">Steps mark recorded doses. No future doses are included.{m.range?' Shading: published half-life range.':''}</p>
  </div>;
}

function LevelCard({group:g, now, onModel}) {
  const [open,setOpen] = useState(false);
  const [limit,setLimit] = useState(6);
  const m=g.model;
  const unavailable = g.unit==='unknown' ? 'The dose unit needs confirmation in History before a level can be calculated.' : g.blend ? 'A blend has no single half-life. Historical component amounts and a suitable model for each ingredient are needed.' : 'No sourced human half-life model is available here for this compound and recorded route.';
  return <article className={`level-card ${open?'is-open':''}`}>
    <button className="level-card-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}>
      <span className="level-card-heading"><span className="level-eyebrow">{m ? (m.kind==='depot'?'Depot estimate':'Decay estimate') : g.models.length?'Choose a reference':'No estimate'}</span><strong>{g.name}</strong><span className="level-card-meta">{g.entries.length} logged dose{g.entries.length!==1?'s':''} · {routeLabels[g.route]}</span></span>
      <span className="level-card-value"><strong>{m?formatLevel(g.remaining,g.unit):'—'}</strong><span aria-hidden="true">{open?'−':'+'}</span></span>
    </button>
    {open && <div className="level-card-body">
      {g.models.length>0 ? <>
        <label className="level-model-label">Half-life reference
          <select className="input" aria-label={`Half-life reference for ${g.name}`} value={m?.id||''} onChange={e=>onModel(g.key,e.target.value)}>
            <option value="">Select matching route / preparation</option>
            {g.models.map(model=><option key={model.id} value={model.id}>{model.label}</option>)}
          </select>
        </label>
        {!m && <p className="level-note">Choose the reference matching these doses. This sets a modeling assumption for this group; it does not change your protocol.</p>}
        {m && <>
          <div className="level-current"><span>{m.kind==='depot'?'Estimated depot remaining':'Estimated dose remaining'} · now</span><strong>{formatLevel(g.remaining,g.unit)}</strong><span>{m.label}</span></div>
          {(g.route==='unknown'||g.route==='inj') && <p className="level-note">Route / preparation assumed from your selection. The original logs do not confirm this reference.</p>}
          <Trend group={g} now={now}/>
          <details className="level-source"><summary>Model details & source</summary><p>{m.note}</p><a href={m.source} target="_blank" rel="noopener noreferrer">Read the half-life source ↗</a><p>Remaining = sum of each logged dose × ½^(hours elapsed ÷ half-life). Amounts use the logged compound or ester, not an active-moiety conversion. This is a simplified dose-equivalent calculation.</p></details>
        </>}
      </> : <p className="level-note">{unavailable}</p>}
      {!!(g.localTimes||g.backfilled||g.review) && <p className="level-caption">{g.localTimes?`${g.localTimes} timestamps have no saved time zone and use this device’s local time. `:''}{g.backfilled?`${g.backfilled} backfilled entries included; times may be approximate. `:''}{g.review?`${g.review} entries are marked for review in History.`:''}</p>}
      <h3 className="level-history-title">Recorded doses</h3>
      <ol className="level-dose-list">{g.entries.slice(0,limit).map((e,i)=><li key={e.id||i}><time>{dateText(e.at)}</time><strong>{formatLevel(e.amount,g.unit)}</strong></li>)}</ol>
      {limit<g.entries.length && <button className="btn btn-ghost level-more" onClick={()=>setLimit(limit+20)}>Show older doses ({g.entries.length-limit})</button>}
    </div>}
  </article>;
}

export function LevelsView({logs,protocols,activeProfile}) {
  const [now,setNow]=useState(Date.now);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [saveError,setSaveError]=useState(false);
  const [selections,setSelections]=useState(()=>{try {const s=JSON.parse(localStorage.getItem(LEVEL_MODELS_KEY)||'{}'); return s&&typeof s==='object'&&!Array.isArray(s)?s:{};}catch{return {};}});
  useEffect(()=>{const tick=()=>setNow(Date.now()); const id=setInterval(()=>{if(document.visibilityState==='visible')tick();},30000); const visible=()=>{if(document.visibilityState==='visible')tick();}; window.addEventListener('focus',tick);document.addEventListener('visibilitychange',visible);return()=>{clearInterval(id);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',visible);};},[]);
  const result=useMemo(()=>buildLevels({logs,protocols,profile:activeProfile,now,selections}),[logs,protocols,activeProfile,now,selections]);
  const modeled=result.groups.filter(g=>g.model).length;
  const available=result.groups.filter(g=>g.models.length).length;
  const groups=result.groups.filter(g=>(filter==='all'||(filter==='modeled'?g.model:!g.model))&&g.name.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(!!b.model-!!a.model)||(!!b.models.length-!!a.models.length)||(b.last.at-a.last.at));
  const onModel=(key,value)=>{const next={...selections,[key]:value};setSelections(next);try{localStorage.setItem(LEVEL_MODELS_KEY,JSON.stringify(next));setSaveError(false);}catch{setSaveError(true);}};
  const excluded=result.ignored;
  return <section className="levels-view" aria-labelledby="levels-title">
    <div className="levels-hero"><div className="level-eyebrow">Your recorded exposure</div><h1 id="levels-title">Levels</h1><p>See how logged doses decline over time.</p><div className="levels-stats"><div><strong>{modeled}</strong><span>modeled</span></div><div><strong>{available-modeled}</strong><span>need a reference</span></div><div><strong>{result.groups.length-available}</strong><span>unavailable</span></div></div><div className="levels-updated"><span className="levels-live-dot"/>Calculated {new Date(now).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})} · updates while open</div></div>
    <div className="levels-explainer"><strong>Estimated remaining, not a blood test.</strong><p>Half-life models cannot determine your blood concentration. These estimates are not a guide to dose timing or safety.</p><details><summary>How to read this view</summary><p>Each calculation adds up the remaining fraction of every recorded dose, including finished cycles. Planned doses and skipped entries do not count. Missing logs mean missing exposure.</p><p>The model assumes immediate input and constant exponential decay. Absorption, bioavailability, tissue distribution, metabolites, organ function and endogenous hormones are not modeled. Effects can persist after the displayed amount becomes very small.</p><p>Route-specific references are used only with a matching recorded route or your explicit selection. Selections are saved on this device. Unknown compounds and blends stay visible without fabricated half-lives.</p></details></div>
    {saveError && <p role="alert" className="level-note">Your reference choice works in this session but could not be saved on this device.</p>}
    {!result.groups.length ? <div className="levels-empty"><h2>No recorded doses yet</h2><p>Log a dose in Today or add an existing dose in History. Your compounds will appear here automatically.</p></div> : <>
      <label className="level-search"><span className="sr-only">Search logged compounds</span><input className="input" type="search" placeholder="Find a compound…" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search logged compounds"/></label>
      <div className="level-filters" aria-label="Filter levels">{[['all','All compounds'],['modeled','Modeled'],['pending','Without estimate']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
      <div className="level-results" aria-live="polite">{groups.length} compound group{groups.length!==1?'s':''} · as of now</div>
      {groups.map(g=><LevelCard key={g.key} group={g} now={now} onModel={onModel}/>)}
      {!groups.length && <p className="levels-empty">No compounds match this search and filter.</p>}
    </>}
    {!!Object.values(excluded).some(Boolean) && <details className="levels-exclusions"><summary>Entries outside this calculation</summary><p>{excluded.skipped} skipped · {excluded.future} future-dated · {excluded.invalid} invalid dose / time · {excluded.duplicate} duplicate IDs · {excluded.unassigned} without a profile. Review entries in History. Unassigned records are never attributed to the selected profile.</p></details>}
  </section>;
}
