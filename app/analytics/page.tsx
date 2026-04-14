"use client";

import { useTelemetry, type Pkt } from "../context/TelemetryContext";

// ── scatter plot (SVG) ────────────────────────────────────────────────────────
function Scatter({
  data, xKey, yKey, xLabel, yLabel, color, W=340, H=200,
}: {
  data: Pkt[]; xKey: keyof Pkt; yKey: keyof Pkt;
  xLabel: string; yLabel: string; color: string; W?: number; H?: number;
}) {
  if (data.length < 2) {
    return (
      <div style={{ width:W, height:H, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:"0.56rem", color:"var(--txt-label)" }} className="blink">AWAITING DATA…</span>
      </div>
    );
  }
  const pad = { t:10, r:10, b:28, l:40 };
  const xs  = data.map(p => Number(p[xKey]));
  const ys  = data.map(p => Number(p[yKey]));
  const mnX = Math.min(...xs), mxX = Math.max(...xs), rgX = mxX-mnX||1;
  const mnY = Math.min(...ys), mxY = Math.max(...ys), rgY = mxY-mnY||1;
  const cx  = (x:number) => pad.l + ((x-mnX)/rgX)*(W-pad.l-pad.r);
  const cy  = (y:number) => H-pad.b - ((y-mnY)/rgY)*(H-pad.t-pad.b);
  const pts = data.map((p,i)=>({x:cx(xs[i]),y:cy(ys[i])}));
  const linePts = pts.map(p=>`${p.x},${p.y}`).join(" ");

  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:H }}>
      {/* Grid */}
      {Array.from({length:ticks+1},(_,i)=>{
        const yv = mnY + (i/ticks)*rgY;
        const ypos = cy(yv);
        return <g key={i}>
          <line x1={pad.l} y1={ypos} x2={W-pad.r} y2={ypos} stroke="var(--dim)" strokeWidth="0.5" />
          <text x={pad.l-4} y={ypos+4} textAnchor="end" fontSize="7" fill="var(--txt-label)" fontFamily="monospace">{yv.toFixed(0)}</text>
        </g>;
      })}
      {/* X ticks */}
      {Array.from({length:ticks+1},(_,i)=>{
        const xv = mnX+(i/ticks)*rgX;
        const xpos = cx(xv);
        return <text key={i} x={xpos} y={H-pad.b+10} textAnchor="middle" fontSize="7" fill="var(--txt-label)" fontFamily="monospace">{xv.toFixed(1)}</text>;
      })}
      {/* Axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H-pad.b} stroke="var(--muted)" strokeWidth="1" />
      <line x1={pad.l} y1={H-pad.b} x2={W-pad.r} y2={H-pad.b} stroke="var(--muted)" strokeWidth="1" />
      {/* Axis labels */}
      <text x={pad.l-30} y={(H-pad.t-pad.b)/2+pad.t} textAnchor="middle" fontSize="7" fill="var(--txt-dim)" fontFamily="monospace" transform={`rotate(-90,${pad.l-30},${(H-pad.t-pad.b)/2+pad.t})`}>{yLabel}</text>
      <text x={(W-pad.l-pad.r)/2+pad.l} y={H-2} textAnchor="middle" fontSize="7" fill="var(--txt-dim)" fontFamily="monospace">{xLabel}</text>
      {/* Line */}
      <polyline points={linePts} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" opacity="0.7" />
      {/* Dots */}
      {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="2" fill={color} opacity="0.6" />)}
      {/* Latest */}
      {pts.length>0 && <circle cx={pts.at(-1)!.x} cy={pts.at(-1)!.y} r="3.5" fill={color} />}
    </svg>
  );
}

// ── time-series ───────────────────────────────────────────────────────────────
function TimeSeries({ data, yKey, yLabel, color, W=340, H=140 }: {
  data: Pkt[]; yKey: keyof Pkt; yLabel: string; color: string; W?: number; H?: number;
}) {
  if (data.length < 2) {
    return (
      <div style={{ width:W, height:H, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:"0.56rem", color:"var(--txt-label)" }} className="blink">AWAITING DATA…</span>
      </div>
    );
  }
  const pad = { t:8, r:10, b:24, l:40 };
  const ys  = data.map(p => Number(p[yKey]));
  const mnY = Math.min(...ys), mxY = Math.max(...ys), rgY = mxY-mnY||1;
  const cx  = (_:unknown,i:number) => pad.l + (i/(data.length-1))*(W-pad.l-pad.r);
  const cy  = (y:number) => H-pad.b - ((y-mnY)/rgY)*(H-pad.t-pad.b);
  const pts = ys.map((y,i)=>`${cx(null,i)},${cy(y)}`).join(" ");
  const area= `M${cx(null,0)} ${H-pad.b} ` + ys.map((y,i)=>`L${cx(null,i)} ${cy(y)}`).join(" ") + ` L${cx(null,ys.length-1)} ${H-pad.b}Z`;
  const gid = `ts${color.replace(/[^a-z0-9]/gi,"")}`;
  const ticks=3;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:H }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({length:ticks+1},(_,i)=>{
        const yv=mnY+(i/ticks)*rgY, ypos=cy(yv);
        return <g key={i}>
          <line x1={pad.l} y1={ypos} x2={W-pad.r} y2={ypos} stroke="var(--dim)" strokeWidth="0.5" />
          <text x={pad.l-4} y={ypos+4} textAnchor="end" fontSize="7" fill="var(--txt-label)" fontFamily="monospace">{yv.toFixed(1)}</text>
        </g>;
      })}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H-pad.b} stroke="var(--muted)" strokeWidth="1" />
      <line x1={pad.l} y1={H-pad.b} x2={W-pad.r} y2={H-pad.b} stroke="var(--muted)" strokeWidth="1" />
      <text x={pad.l-30} y={(H-pad.t-pad.b)/2+pad.t} textAnchor="middle" fontSize="7" fill="var(--txt-dim)" fontFamily="monospace" transform={`rotate(-90,${pad.l-30},${(H-pad.t-pad.b)/2+pad.t})`}>{yLabel}</text>
      <path d={area} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={cx(null,ys.length-1)} cy={cy(ys.at(-1)!)} r="3" fill={color} />
    </svg>
  );
}

export default function AnalyticsPage() {
  const { history, connected, pkts, pkt } = useTelemetry();

  const stdDev = (arr: number[]) => {
    if (arr.length < 2) return 0;
    const m = arr.reduce((a,b)=>a+b,0)/arr.length;
    return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length);
  };

  const tempArr  = history.map(p=>p.temp);
  const pressArr = history.map(p=>p.pressure);
  const altArr   = history.map(p=>p.bmpalt);
  const humArr   = history.map(p=>p.humidity);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <header style={{ height:40, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 14px", background:"rgba(2,8,18,.98)", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:"0.52rem", letterSpacing:"0.22em", color:"var(--accent)", fontWeight:700 }}>◈ BALLOON·SAT</span>
          <div style={{ width:1, height:14, background:"var(--border)" }} />
          <span style={{ fontSize:"0.5rem", letterSpacing:"0.14em", color:"var(--txt-dim)" }}>ANALYTICS</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ fontSize:"0.5rem", color:"var(--txt-dim)" }}>SAMPLES <span style={{ color:"var(--hi)", fontWeight:700 }}>{history.length}</span></span>
          <div style={{ width:1, height:12, background:"var(--border)" }} />
          <div className={`pulse${connected?"":" dead"}`} />
          <span style={{ fontSize:"0.5rem", color:"var(--txt-dim)" }}>{connected?"LIVE":"OFFLINE"}</span>
        </div>
      </header>

      <div style={{ flex:1, minHeight:0, overflowY:"auto", padding:5 }} className="sc">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>

          {/* Temp vs Altitude */}
          <div className="p">
            <div className="ph"><span className="ph-dot" style={{ background:"var(--amber)" }} />TEMPERATURE vs ALTITUDE</div>
            <div className="pb">
              <Scatter data={history} xKey="temp" yKey="bmpalt" xLabel="Temp (°C)" yLabel="Alt (m)" color="var(--amber)" />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <span className="lbl">STD DEV T: <span style={{ color:"var(--amber)" }}>{stdDev(tempArr).toFixed(2)}°C</span></span>
                <span className="lbl">CURRENT: <span style={{ color:"var(--amber)" }}>{pkt?pkt.temp.toFixed(1)+"°C":"--"}</span></span>
              </div>
            </div>
          </div>

          {/* Pressure vs Altitude */}
          <div className="p">
            <div className="ph"><span className="ph-dot" style={{ background:"var(--purple)" }} />PRESSURE vs ALTITUDE</div>
            <div className="pb">
              <Scatter data={history} xKey="pressure" yKey="bmpalt" xLabel="Pressure (hPa)" yLabel="Alt (m)" color="var(--purple)" />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <span className="lbl">STD DEV P: <span style={{ color:"var(--purple)" }}>{stdDev(pressArr).toFixed(2)} hPa</span></span>
                <span className="lbl">CURRENT: <span style={{ color:"var(--purple)" }}>{pkt?pkt.pressure.toFixed(1)+" hPa":"--"}</span></span>
              </div>
            </div>
          </div>

          {/* Altitude time series */}
          <div className="p">
            <div className="ph"><span className="ph-dot" style={{ background:"var(--accent)" }} />ALTITUDE OVER TIME</div>
            <div className="pb">
              <TimeSeries data={history} yKey="bmpalt" yLabel="Alt (m)" color="var(--accent)" />
              <div style={{ display:"flex", gap:16, marginTop:4 }}>
                <span className="lbl">MAX: <span style={{ color:"var(--accent)" }}>{altArr.length?Math.max(...altArr).toFixed(1):"--"} m</span></span>
                <span className="lbl">MIN: <span style={{ color:"var(--txt-dim)" }}>{altArr.length?Math.min(...altArr).toFixed(1):"--"} m</span></span>
                <span className="lbl">RANGE: <span style={{ color:"var(--accent)" }}>{altArr.length?(Math.max(...altArr)-Math.min(...altArr)).toFixed(1):"--"} m</span></span>
              </div>
            </div>
          </div>

          {/* Humidity vs Temp */}
          <div className="p">
            <div className="ph"><span className="ph-dot" style={{ background:"var(--green)" }} />HUMIDITY vs TEMPERATURE</div>
            <div className="pb">
              <Scatter data={history} xKey="humidity" yKey="temp" xLabel="Humidity (%)" yLabel="Temp (°C)" color="var(--green)" />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <span className="lbl">STD DEV H: <span style={{ color:"var(--green)" }}>{stdDev(humArr).toFixed(2)}%</span></span>
                <span className="lbl">CURRENT: <span style={{ color:"var(--green)" }}>{pkt?pkt.humidity.toFixed(1)+"%":"--"}</span></span>
              </div>
            </div>
          </div>

          {/* Pressure time series */}
          <div className="p">
            <div className="ph"><span className="ph-dot" style={{ background:"var(--purple)" }} />PRESSURE OVER TIME</div>
            <div className="pb">
              <TimeSeries data={history} yKey="pressure" yLabel="hPa" color="var(--purple)" />
            </div>
          </div>

          {/* Temperature time series */}
          <div className="p">
            <div className="ph"><span className="ph-dot" style={{ background:"var(--amber)" }} />TEMPERATURE OVER TIME</div>
            <div className="pb">
              <TimeSeries data={history} yKey="temp" yLabel="°C" color="var(--amber)" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
