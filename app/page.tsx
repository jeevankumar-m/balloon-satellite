"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useTelemetry } from "./context/TelemetryContext";

const CubeIMU = dynamic(() => import("./components/CubeIMU"), { ssr: false });

// ── helpers ───────────────────────────────────────────────────────────────────
const f = (n: number | null | undefined, d = 2) => n == null ? "--" : n.toFixed(d);

// ── sparkline ─────────────────────────────────────────────────────────────────
function Spark({ data, color, h = 38 }: { data: number[]; color: string; h?: number }) {
  if (data.length < 2) return <div style={{ height: h }} />;
  const W = 240, pad = 2;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (W - pad * 2));
  const ys = data.map(v => pad + (1 - (v - mn) / rng) * (h - pad * 2));
  const pts = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const area = `M${xs[0]} ${h} ` + xs.map((x, i) => `L${x} ${ys[i]}`).join(" ") + ` L${xs.at(-1)} ${h}Z`;
  const gid = `g${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width: "100%", height: h, display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx={xs.at(-1)!} cy={ys.at(-1)!} r="2.5" fill={color} />
    </svg>
  );
}

// ── compass ───────────────────────────────────────────────────────────────────
function Compass({ deg }: { deg: number }) {
  const r = 22, cx = 26, cy = 26, a = (deg - 90) * (Math.PI / 180);
  return (
    <svg viewBox="0 0 52 52" width={52} height={52}>
      <circle cx={cx} cy={cy} r={r} fill="rgba(2,12,28,.7)" stroke="var(--border)" />
      <circle cx={cx} cy={cy} r={r - 5} fill="none" stroke="var(--dim)" strokeWidth="0.5" strokeDasharray="2 3" />
      {["N","E","S","W"].map((d, i) => {
        const ta = (i * 90 - 90) * (Math.PI / 180);
        return <text key={d} x={cx+(r-7)*Math.cos(ta)} y={cy+(r-7)*Math.sin(ta)} textAnchor="middle" dominantBaseline="middle" fontSize="6" fill={d==="N"?"var(--red)":"var(--muted)"} fontFamily="monospace" fontWeight="bold">{d}</text>;
      })}
      <line x1={cx-Math.cos(a)*7} y1={cy-Math.sin(a)*7} x2={cx+Math.cos(a)*(r-3)} y2={cy+Math.sin(a)*(r-3)} stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="2" fill="var(--accent)" />
    </svg>
  );
}

// ── signal bars ───────────────────────────────────────────────────────────────
function SigBars({ rssi }: { rssi: number | null }) {
  const b = rssi == null ? 0 : Math.max(0, Math.min(5, Math.round((rssi + 30) / 12)));
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:2 }}>
      {[1,2,3,4,5].map(n => (
        <div key={n} style={{ width:4, height:3+n*2.5, borderRadius:1, background:n<=b?"var(--green)":"var(--dim)", boxShadow:n<=b?"0 0 3px var(--green)":"none", transition:"background .3s" }} />
      ))}
    </div>
  );
}

// ── data row ──────────────────────────────────────────────────────────────────
function DR({ label, value, unit="", color }: { label:string; value:string; unit?:string; color?:string }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"2.5px 0" }}>
      <span className="lbl">{label}</span>
      <span className="val" style={color ? { color, textShadow:`0 0 6px ${color}90` } : undefined}>
        {value}{unit && <span className="u">{unit}</span>}
      </span>
    </div>
  );
}

// ── bar ───────────────────────────────────────────────────────────────────────
function Bar({ v, min, max, color }: { v:number; min:number; max:number; color:string }) {
  const pct = Math.max(0, Math.min(100, ((v-min)/(max-min))*100));
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width:`${pct}%`, background:color, boxShadow:`0 0 4px ${color}` }} />
    </div>
  );
}

// ── panel ─────────────────────────────────────────────────────────────────────
function P({ title, children, style }: { title:string; children:React.ReactNode; style?:React.CSSProperties }) {
  return (
    <div className="p" style={style}>
      <div className="ph"><span className="ph-dot" />{title}</div>
      <div className="pb">{children}</div>
    </div>
  );
}

// ── sensor widget (top row of center) ─────────────────────────────────────────
function Widget({ title, value, unit, history, color, dec=1 }: {
  title:string; value:number|null; unit:string; history:number[]; color:string; dec?:number
}) {
  const mn = history.length ? Math.min(...history) : null;
  const mx = history.length ? Math.max(...history) : null;
  return (
    <div className="p" style={{ flex:1 }}>
      <div className="ph"><span className="ph-dot" style={{ background:color, boxShadow:`0 0 5px ${color}` }} />{title}</div>
      <div className="pb" style={{ padding:"5px 9px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
          <div>
            <span className="val-lg" style={{ color, textShadow:`0 0 10px ${color}70` }}>{value!=null?value.toFixed(dec):"--"}</span>
            <span className="u">{unit}</span>
          </div>
          {mn!=null && (
            <div style={{ textAlign:"right" }}>
              <div className="lbl" style={{ fontSize:"0.5rem" }}>↑ {mx!.toFixed(dec)}</div>
              <div className="lbl" style={{ fontSize:"0.5rem", color:"var(--txt-dim)" }}>↓ {mn.toFixed(dec)}</div>
            </div>
          )}
        </div>
        <Spark data={history} color={color} h={32} />
      </div>
    </div>
  );
}

// ── elapsed ───────────────────────────────────────────────────────────────────
function useElapsed(on: boolean) {
  const [s, setS] = useState(0);
  const t0 = useRef<number|null>(null);
  useEffect(() => {
    if (!on) return;
    if (!t0.current) t0.current = Date.now();
    const id = setInterval(() => setS(Math.floor((Date.now()-t0.current!)/1000)), 1000);
    return () => clearInterval(id);
  }, [on]);
  return [String(Math.floor(s/3600)).padStart(2,"0"), String(Math.floor((s%3600)/60)).padStart(2,"0"), String(s%60).padStart(2,"0")].join(":");
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { pkt, connected, pkts, altH, tmpH, humH, preH, rsiH, log } = useTelemetry();
  const logRef  = useRef<HTMLDivElement>(null);
  const elapsed = useElapsed(connected);

  const g     = pkt ? Math.sqrt(pkt.ax**2+pkt.ay**2+pkt.az**2)/16384 : null;
  const pitch = pkt ? Math.atan2(pkt.ay,Math.sqrt(pkt.ax**2+pkt.az**2))*180/Math.PI : null;
  const roll  = pkt ? Math.atan2(-pkt.ax,pkt.az)*180/Math.PI : null;

  const sigC = pkt?.rssi==null?"var(--muted)":pkt.rssi>-65?"var(--green)":pkt.rssi>-80?"var(--amber)":"var(--red)";
  const sigL = pkt?.rssi==null?"NO SIGNAL":pkt.rssi>-65?"STRONG":pkt.rssi>-80?"MODERATE":"WEAK";

  const AX = pkt?.ax??0, AY = pkt?.ay??0, AZ = pkt?.az??16384;

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* HEADER */}
      <header style={{ height:40, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 14px", background:"rgba(2,8,18,.98)", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:"0.52rem", letterSpacing:"0.22em", color:"var(--accent)", fontWeight:700 }}>◈ BALLOON·SAT</span>
          <div style={{ width:1, height:14, background:"var(--border)" }} />
          <span style={{ fontSize:"0.5rem", letterSpacing:"0.14em", color:"var(--txt-dim)" }}>GROUND CONTROL</span>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:"0.46rem", letterSpacing:"0.14em", color:"var(--txt-label)" }}>MET</div>
          <div style={{ fontSize:"0.95rem", fontWeight:700, letterSpacing:"0.1em", color:"var(--hi)", textShadow:"0 0 10px rgba(112,232,255,.5)" }}>{elapsed}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div className={`pulse${connected?"":" dead"}`} />
            <span style={{ fontSize:"0.5rem", letterSpacing:"0.1em", color:"var(--txt-dim)" }}>{connected?"LIVE · COM3":"DISCONNECTED"}</span>
          </div>
          <div style={{ width:1, height:12, background:"var(--border)" }} />
          <span style={{ fontSize:"0.5rem", color:"var(--txt-dim)" }}>PKT <span style={{ color:"var(--hi)", fontWeight:700 }}>{pkts}</span></span>
          <div style={{ width:1, height:12, background:"var(--border)" }} />
          <span style={{ fontSize:"0.5rem", color:"var(--txt-dim)" }}>{pkt?.date??"--/--/----"}<span style={{ color:"var(--txt)", marginLeft:8 }}>{pkt?.time??"--:--:--"}</span></span>
        </div>
      </header>

      {/* BODY */}
      <div style={{ flex:1, minHeight:0, display:"grid", gridTemplateColumns:"190px 1fr 190px", gridTemplateRows:"1fr 52px", gap:5, padding:5 }}>

        {/* LEFT */}
        <div style={{ display:"flex", flexDirection:"column", gap:5, gridRow:"1" }}>
          <P title="GPS · POSITION">
            <DR label="Latitude"   value={f(pkt?.lat,6)}  unit="°" />
            <DR label="Longitude"  value={f(pkt?.lon,6)}  unit="°" />
            <DR label="GPS Alt"    value={f(pkt?.gpsalt)} unit="m" />
            <div className="div" />
            <DR label="Fix" value={pkt?(pkt.fix?"3D LOCK":"SEARCHING"):"--"} color={pkt?.fix?"var(--green)":"var(--red)"} />
            <DR label="Satellites" value={String(pkt?.sat??"--")} />
          </P>
          <P title="RF SIGNAL">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:6 }}>
              <div><span className="val-xl" style={{ fontSize:"1.3rem" }}>{f(pkt?.rssi,0)}</span><span className="u">dBm</span></div>
              <SigBars rssi={pkt?.rssi??null} />
            </div>
            <DR label="SNR" value={f(pkt?.snr)} unit="dB" />
            <div style={{ margin:"5px 0 4px", padding:"2px 6px", border:`1px solid ${sigC}35`, background:`${sigC}0e`, fontSize:"0.56rem", letterSpacing:"0.14em", textAlign:"center", color:sigC }}>{sigL}</div>
            <div className="lbl" style={{ fontSize:"0.5rem", marginBottom:3 }}>RSSI HISTORY</div>
            <Spark data={rsiH} color="var(--green)" h={32} />
          </P>
          <P title="MOTION · COURSE" style={{ flex:1 }}>
            <DR label="Speed"  value={f(pkt?.spd)}    unit="km/h" />
            <DR label="Course" value={pkt?`${pkt.crs.toFixed(1)}°`:"--"} />
            <div style={{ display:"flex", justifyContent:"center", marginTop:8 }}><Compass deg={pkt?.crs??0} /></div>
          </P>
        </div>

        {/* CENTER */}
        <div style={{ display:"flex", flexDirection:"column", gap:5, gridRow:"1", minHeight:0 }}>
          {/* Top widgets */}
          <div style={{ display:"flex", gap:5, height:100, flexShrink:0 }}>
            <Widget title="ALTITUDE"    value={pkt?.bmpalt??null}    unit="m"    history={altH} color="var(--accent)" />
            <Widget title="TEMPERATURE" value={pkt?.temp??null}      unit="°C"   history={tmpH} color="var(--amber)"  />
            <Widget title="HUMIDITY"    value={pkt?.humidity??null}  unit="%"    history={humH} color="var(--green)"  />
            <Widget title="PRESSURE"    value={pkt?.pressure??null}  unit="hPa"  history={preH} color="var(--purple)" />
          </div>
          {/* Cube */}
          <div className="p" style={{ flex:1, position:"relative", minHeight:0 }}>
            <div className="ph">
              <span className="ph-dot" />IMU ORIENTATION — MPU6050
              <span style={{ marginLeft:"auto", fontSize:"0.46rem", letterSpacing:"0.1em", color:"var(--txt-label)" }}>X · Y · Z  REALTIME</span>
            </div>
            <div style={{ position:"absolute", inset:0, top:26, overflow:"hidden" }}>
              <CubeIMU ax={AX} ay={AY} az={AZ} />
            </div>
            <div style={{ position:"absolute", bottom:10, left:12, zIndex:2 }}>
              {[{l:"PITCH",v:pitch},{l:"ROLL ",v:roll}].map(({l,v})=>(
                <div key={l} style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
                  <span className="lbl" style={{ fontSize:"0.52rem" }}>{l}</span>
                  <span className="val" style={{ fontSize:"1rem" }}>{v!=null?`${v.toFixed(1)}°`:"--"}</span>
                </div>
              ))}
            </div>
            <div style={{ position:"absolute", bottom:10, right:14, zIndex:2, textAlign:"right" }}>
              <div className="lbl" style={{ fontSize:"0.5rem" }}>G · FORCE</div>
              <div className="val-xl" style={{ fontSize:"1.7rem" }}>{g!=null?g.toFixed(3):"--"}<span className="u">g</span></div>
            </div>
          </div>
          {/* Accel bars */}
          <div className="p" style={{ height:82, flexShrink:0 }}>
            <div className="ph"><span className="ph-dot" />ACCELEROMETER RAW</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0 14px", padding:"5px 9px" }}>
              {(["AX","AY","AZ"] as const).map(axis => {
                const raw = axis==="AX"?AX:axis==="AY"?AY:AZ;
                const c   = axis==="AX"?"var(--red)":axis==="AY"?"var(--green)":"var(--accent)";
                const pct = Math.min(100,Math.abs(raw)/163);
                return (
                  <div key={axis}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span className="lbl">{axis}</span>
                      <span className="val" style={{ fontSize:"0.8rem", color:c, textShadow:`0 0 5px ${c}80` }}>{pkt?raw:"--"}</span>
                    </div>
                    <div style={{ height:3, background:"var(--dim)", borderRadius:1, position:"relative" }}>
                      <div style={{ position:"absolute", top:0, height:"100%", left:raw>=0?"50%":`${50-pct/2}%`, width:`${pct/2}%`, background:c, borderRadius:1, boxShadow:`0 0 4px ${c}`, transition:"all .25s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display:"flex", flexDirection:"column", gap:5, gridRow:"1" }}>
          <P title="ENVIRONMENT" style={{ flex:1 }}>
            {([
              {l:"TEMPERATURE",v:pkt?.temp??null,    u:"°C",  mn:-20,mx:60,   c:"var(--amber)"},
              {l:"HUMIDITY",   v:pkt?.humidity??null, u:"% RH",mn:0,  mx:100, c:"var(--green)"},
              {l:"PRESSURE",   v:pkt?.pressure??null, u:"hPa", mn:900,mx:1100,c:"var(--purple)"},
            ] as const).map(({l,v,u,mn,mx,c})=>(
              <div key={l} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:2 }}>
                  <span className="lbl">{l}</span>
                  <span className="val" style={{ fontSize:"0.9rem", color:c, textShadow:`0 0 6px ${c}80` }}>{v!=null?v.toFixed(1):"--"}<span className="u">{u}</span></span>
                </div>
                <Bar v={v??mn} min={mn} max={mx} color={c} />
              </div>
            ))}
          </P>
          <P title="IMU SUMMARY">
            <DR label="Pitch" value={pitch!=null?`${pitch.toFixed(1)}°`:"--"} />
            <DR label="Roll"  value={roll!=null?`${roll.toFixed(1)}°`:"--"}  />
            <div className="div" />
            <div style={{ marginBottom:4 }}><span className="lbl">G-FORCE</span></div>
            <div className="val-xl" style={{ fontSize:"1.5rem" }}>{g!=null?g.toFixed(3):"--"}<span className="u">g</span></div>
            <div className="div" style={{ marginTop:6 }} />
            {(["AX","AY","AZ"] as const).map(axis=>{
              const raw=axis==="AX"?AX:axis==="AY"?AY:AZ;
              return <DR key={axis} label={axis} value={pkt?String(raw):"--"} />;
            })}
          </P>
        </div>

        {/* LOG */}
        <div className="p" style={{ gridColumn:"1 / -1", gridRow:2, overflow:"hidden" }}>
          <div className="ph" style={{ padding:"3px 9px" }}>
            <span className="ph-dot" />TELEMETRY FEED
            <span style={{ marginLeft:"auto", fontSize:"0.46rem", color:"var(--txt-label)" }}>
              {connected?<span className="blink" style={{ color:"var(--green)" }}>● RECEIVING</span>:"● OFFLINE"}
            </span>
          </div>
          <div ref={logRef} className="sc" style={{ height:"calc(100% - 22px)", overflowY:"auto", padding:"1px 9px" }}>
            {log.length===0
              ? <span className="lbl blink">AWAITING SIGNAL…</span>
              : log.map((line,i)=>(
                <div key={i} style={{ fontSize:"0.6rem", lineHeight:1.6, color:i===0?"var(--hi)":"var(--txt-dim)", borderBottom:"1px solid rgba(11,34,56,.4)" }}>{line}</div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
