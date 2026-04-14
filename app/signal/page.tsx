"use client";

import { useTelemetry } from "../context/TelemetryContext";

function TimeSeries({ ys, color, yLabel, H=120 }: { ys:number[]; color:string; yLabel:string; H?:number }) {
  if (ys.length < 2) return (
    <div style={{ height:H, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontSize:"0.56rem", color:"var(--txt-label)" }} className="blink">AWAITING DATA…</span>
    </div>
  );
  const W=320, pad={t:8,r:8,b:22,l:36};
  const mn=Math.min(...ys), mx=Math.max(...ys), rg=mx-mn||1;
  const cx=(_:unknown,i:number)=>pad.l+(i/(ys.length-1))*(W-pad.l-pad.r);
  const cy=(y:number)=>H-pad.b-((y-mn)/rg)*(H-pad.t-pad.b);
  const pts=ys.map((y,i)=>`${cx(null,i)},${cy(y)}`).join(" ");
  const area=`M${cx(null,0)} ${H-pad.b} `+ys.map((y,i)=>`L${cx(null,i)} ${cy(y)}`).join(" ")+` L${cx(null,ys.length-1)} ${H-pad.b}Z`;
  const gid=`sg${color.replace(/[^a-z0-9]/gi,"")}${yLabel.replace(/\s/g,"")}`;
  const ticks=3;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:H }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {Array.from({length:ticks+1},(_,i)=>{
        const yv=mn+(i/ticks)*rg, ypos=cy(yv);
        return <g key={i}>
          <line x1={pad.l} y1={ypos} x2={W-pad.r} y2={ypos} stroke="var(--dim)" strokeWidth="0.5"/>
          <text x={pad.l-4} y={ypos+4} textAnchor="end" fontSize="7" fill="var(--txt-label)" fontFamily="monospace">{yv.toFixed(0)}</text>
        </g>;
      })}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H-pad.b} stroke="var(--muted)" strokeWidth="1"/>
      <line x1={pad.l} y1={H-pad.b} x2={W-pad.r} y2={H-pad.b} stroke="var(--muted)" strokeWidth="1"/>
      <text x={pad.l-28} y={(H-pad.t-pad.b)/2+pad.t} textAnchor="middle" fontSize="7" fill="var(--txt-dim)" fontFamily="monospace" transform={`rotate(-90,${pad.l-28},${(H-pad.t-pad.b)/2+pad.t})`}>{yLabel}</text>
      <path d={area} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx={cx(null,ys.length-1)} cy={cy(ys.at(-1)!)} r="3" fill={color}/>
    </svg>
  );
}

export default function SignalPage() {
  const { history, rsiH, connected, pkts, pkt } = useTelemetry();

  const rssiArr = history.map(p => p.rssi).filter(r => r != null) as number[];
  const snrArr  = history.map(p => p.snr).filter(s => s != null)  as number[];

  const avg = (a:number[]) => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
  const mn  = (a:number[]) => a.length ? Math.min(...a) : null;
  const mx  = (a:number[]) => a.length ? Math.max(...a) : null;

  const rssiAvg = avg(rssiArr);
  const rssiMin = mn(rssiArr);
  const rssiMax = mx(rssiArr);

  // Packet loss: count gaps > 5s between consecutive packets
  let gaps = 0;
  for (let i=1; i<history.length; i++) {
    if (history[i]._ts - history[i-1]._ts > 5000) gaps++;
  }
  const lossRate = history.length > 1 ? ((gaps / (history.length-1)) * 100).toFixed(1) : "--";

  const sigQual =
    pkt?.rssi == null ? { l:"NO SIGNAL",   c:"var(--muted)" } :
    pkt.rssi > -65    ? { l:"EXCELLENT",   c:"var(--green)"  } :
    pkt.rssi > -75    ? { l:"GOOD",        c:"var(--green)"  } :
    pkt.rssi > -85    ? { l:"FAIR",        c:"var(--amber)"  } :
                        { l:"POOR",        c:"var(--red)"    };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <header style={{ height:40, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 14px", background:"rgba(2,8,18,.98)", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:"0.52rem", letterSpacing:"0.22em", color:"var(--accent)", fontWeight:700 }}>◈ BALLOON·SAT</span>
          <div style={{ width:1, height:14, background:"var(--border)" }} />
          <span style={{ fontSize:"0.5rem", letterSpacing:"0.14em", color:"var(--txt-dim)" }}>SIGNAL HEALTH</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ fontSize:"0.5rem", color:"var(--txt-dim)" }}>PACKETS <span style={{ color:"var(--hi)", fontWeight:700 }}>{pkts}</span></span>
          <div style={{ width:1, height:12, background:"var(--border)" }} />
          <div className={`pulse${connected?"":" dead"}`} />
          <span style={{ fontSize:"0.5rem", color:"var(--txt-dim)" }}>{connected?"LIVE":"OFFLINE"}</span>
        </div>
      </header>

      <div style={{ flex:1, minHeight:0, display:"grid", gridTemplateColumns:"200px 1fr", gap:5, padding:5 }}>

        {/* Left: stats */}
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {/* Current */}
          <div className="p" style={{ flexShrink:0 }}>
            <div className="ph"><span className="ph-dot"/>CURRENT SIGNAL</div>
            <div className="pb">
              <div style={{ textAlign:"center", marginBottom:8 }}>
                <div style={{ fontSize:"2.2rem", fontWeight:700, color: sigQual.c, textShadow:`0 0 14px ${sigQual.c}80`, lineHeight:1 }}>{pkt?.rssi??'--'}</div>
                <div style={{ fontSize:"0.56rem", color:"var(--txt-dim)", marginTop:2 }}>dBm RSSI</div>
                <div style={{ fontSize:"0.62rem", fontWeight:700, color: sigQual.c, marginTop:6, letterSpacing:"0.12em" }}>{sigQual.l}</div>
              </div>
              {[{l:"SNR",v:pkt?.snr!=null?`${pkt.snr.toFixed(2)} dB`:"--"},{l:"PACKETS",v:String(pkts)},{l:"LOSS RATE",v:`${lossRate}%`}].map(({l,v})=>(
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"2.5px 0" }}>
                  <span className="lbl">{l}</span>
                  <span className="val" style={{ fontSize:"0.8rem" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Statistics */}
          <div className="p" style={{ flexShrink:0 }}>
            <div className="ph"><span className="ph-dot"/>RSSI STATISTICS</div>
            <div className="pb">
              {[
                {l:"AVERAGE",c:"var(--accent)",  v:rssiAvg!=null?`${rssiAvg.toFixed(1)} dBm`:"--"},
                {l:"BEST",   c:"var(--green)",   v:rssiMax!=null?`${rssiMax.toFixed(0)} dBm`:"--"},
                {l:"WORST",  c:"var(--red)",     v:rssiMin!=null?`${rssiMin.toFixed(0)} dBm`:"--"},
                {l:"SAMPLES",c:"var(--hi)",      v:String(rssiArr.length)},
              ].map(({l,c,v})=>(
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
                  <span className="lbl">{l}</span>
                  <span className="val" style={{ fontSize:"0.82rem", color:c, textShadow:`0 0 5px ${c}70` }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RSSI scale reference */}
          <div className="p" style={{ flex:1 }}>
            <div className="ph"><span className="ph-dot"/>RSSI REFERENCE</div>
            <div className="pb" style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[
                {r:">-65",  q:"EXCELLENT", c:"var(--green)"},
                {r:"-65..-75", q:"GOOD",  c:"var(--green)"},
                {r:"-75..-85", q:"FAIR",  c:"var(--amber)"},
                {r:"<-85", q:"POOR",      c:"var(--red)"},
              ].map(({r,q,c})=>(
                <div key={q} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:"0.56rem", fontFamily:"monospace", color:"var(--txt-dim)" }}>{r} dBm</span>
                  <span style={{ fontSize:"0.56rem", letterSpacing:"0.1em", color:c, fontWeight:700 }}>{q}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: charts */}
        <div style={{ display:"flex", flexDirection:"column", gap:5, minHeight:0, overflowY:"auto" }} className="sc">
          <div className="p">
            <div className="ph"><span className="ph-dot" style={{ background:"var(--green)" }}/>RSSI OVER TIME</div>
            <div className="pb"><TimeSeries ys={rssiArr} color="var(--green)" yLabel="dBm" H={130}/></div>
          </div>
          <div className="p">
            <div className="ph"><span className="ph-dot" style={{ background:"var(--accent)" }}/>SNR OVER TIME</div>
            <div className="pb"><TimeSeries ys={snrArr} color="var(--accent)" yLabel="dB" H={130}/></div>
          </div>
          <div className="p">
            <div className="ph"><span className="ph-dot" style={{ background:"var(--purple)" }}/>RSSI vs ALTITUDE</div>
            <div className="pb">
              {history.length >= 2 ? (
                (() => {
                  const W=400, H=160, pad={t:8,r:8,b:24,l:40};
                  const pts=history.filter(p=>p.rssi!=null).map(p=>({x:p.bmpalt,y:p.rssi!}));
                  if (pts.length<2) return <span className="lbl blink">AWAITING DATA…</span>;
                  const mnX=Math.min(...pts.map(p=>p.x)), mxX=Math.max(...pts.map(p=>p.x)), rgX=mxX-mnX||1;
                  const mnY=Math.min(...pts.map(p=>p.y)), mxY=Math.max(...pts.map(p=>p.y)), rgY=mxY-mnY||1;
                  const cx=(x:number)=>pad.l+((x-mnX)/rgX)*(W-pad.l-pad.r);
                  const cy=(y:number)=>H-pad.b-((y-mnY)/rgY)*(H-pad.t-pad.b);
                  return (
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:H }}>
                      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H-pad.b} stroke="var(--muted)" strokeWidth="1"/>
                      <line x1={pad.l} y1={H-pad.b} x2={W-pad.r} y2={H-pad.b} stroke="var(--muted)" strokeWidth="1"/>
                      <text x={(W-pad.l-pad.r)/2+pad.l} y={H-2} textAnchor="middle" fontSize="7" fill="var(--txt-dim)" fontFamily="monospace">Altitude (m)</text>
                      <text x={pad.l-28} y={(H-pad.t-pad.b)/2+pad.t} textAnchor="middle" fontSize="7" fill="var(--txt-dim)" fontFamily="monospace" transform={`rotate(-90,${pad.l-28},${(H-pad.t-pad.b)/2+pad.t})`}>RSSI (dBm)</text>
                      {pts.map((p,i)=><circle key={i} cx={cx(p.x)} cy={cy(p.y)} r="2" fill="var(--purple)" opacity="0.7"/>)}
                    </svg>
                  );
                })()
              ) : <span className="lbl blink">AWAITING DATA…</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
