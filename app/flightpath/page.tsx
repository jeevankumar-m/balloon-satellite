"use client";

import dynamic from "next/dynamic";
import { useTelemetry } from "../context/TelemetryContext";

const FlightPath3D = dynamic(() => import("../components/FlightPath3D"), { ssr: false });

export default function FlightPathPage() {
  const { gpsTrack, pkt, connected, pkts } = useTelemetry();

  const origin = gpsTrack[0] ?? null;
  const latest = gpsTrack[gpsTrack.length - 1] ?? null;

  const maxAlt  = gpsTrack.length ? Math.max(...gpsTrack.map(p => p.bmpalt)) : null;
  const minAlt  = gpsTrack.length ? Math.min(...gpsTrack.map(p => p.bmpalt)) : null;
  const distM   = gpsTrack.length >= 2
    ? (() => {
        const R = 6_371_000;
        const a = origin!;
        const b = gpsTrack[gpsTrack.length - 1];
        const dLat = (b.lat - a.lat) * Math.PI / 180;
        const dLon = (b.lon - a.lon) * Math.PI / 180;
        const s = Math.sin(dLat/2)**2
          + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
      })()
    : null;

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* Header */}
      <header style={{ height:40, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 14px", background:"rgba(2,8,18,.98)", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:"0.52rem", letterSpacing:"0.22em", color:"var(--accent)", fontWeight:700 }}>◈ BALLOON·SAT</span>
          <div style={{ width:1, height:14, background:"var(--border)" }} />
          <span style={{ fontSize:"0.5rem", letterSpacing:"0.14em", color:"var(--txt-dim)" }}>3D FLIGHT PATH</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          {[
            { l:"GPS FIXES",   v:String(gpsTrack.length) },
            { l:"MAX ALT",     v:maxAlt!=null?`${maxAlt.toFixed(1)} m`:"--" },
            { l:"DISTANCE",    v:distM!=null?`${(distM/1000).toFixed(2)} km`:"--" },
            { l:"TOTAL PKTS",  v:String(pkts) },
          ].map(({l,v})=>(
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:"0.46rem", letterSpacing:"0.12em", color:"var(--txt-label)" }}>{l}</div>
              <div style={{ fontSize:"0.82rem", fontWeight:700, color:"var(--hi)", textShadow:"0 0 8px rgba(112,232,255,.4)" }}>{v}</div>
            </div>
          ))}
          <div style={{ width:1, height:14, background:"var(--border)" }} />
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div className={`pulse${connected?"":" dead"}`} />
            <span style={{ fontSize:"0.5rem", color:"var(--txt-dim)" }}>{connected?"LIVE":"OFFLINE"}</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <div style={{ flex:1, minHeight:0, display:"grid", gridTemplateColumns:"1fr 190px", gap:5, padding:5 }}>

        {/* 3-D viewport */}
        <div className="p" style={{ position:"relative", overflow:"hidden" }}>
          <div className="ph">
            <span className="ph-dot" />3D TRAJECTORY — LAT · LON · ALT
            <span style={{ marginLeft:"auto", fontSize:"0.46rem", color:"var(--txt-label)", letterSpacing:"0.1em" }}>
              DRAG TO ORBIT  ·  SCROLL TO ZOOM  ·  RIGHT-DRAG TO PAN
            </span>
          </div>

          {gpsTrack.length < 2 ? (
            <div style={{ position:"absolute", inset:0, top:26, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
              <div style={{ fontSize:"0.58rem", letterSpacing:"0.14em", color:"var(--txt-dim)" }} className="blink">
                AWAITING GPS FIX…
              </div>
              <div style={{ fontSize:"0.52rem", color:"var(--txt-label)" }}>
                Flight path will render once FIX = 1 and 2+ packets are received
              </div>
              {pkt && (
                <div style={{ marginTop:8, padding:"6px 14px", border:"1px solid var(--border)", fontSize:"0.56rem", color:"var(--txt-dim)" }}>
                  CURRENT FIX: <span style={{ color: pkt.fix ? "var(--green)" : "var(--red)" }}>{pkt.fix ? "3D LOCK" : "SEARCHING"}</span>
                  <span style={{ marginLeft:16 }}>SAT: {pkt.sat}</span>
                  <span style={{ marginLeft:16 }}>ALT: {pkt.bmpalt.toFixed(1)} m</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ position:"absolute", inset:0, top:26 }}>
              <FlightPath3D track={gpsTrack} />
            </div>
          )}

          {/* Legend */}
          {gpsTrack.length >= 2 && (
            <div style={{ position:"absolute", bottom:12, left:14, zIndex:2, display:"flex", flexDirection:"column", gap:4 }}>
              {[
                { c:"#f4a522", l:"LAUNCH POINT" },
                { c:"#00c8f0", l:"CURRENT POSITION" },
                { c:"#ff3b5c", l:"PEAK ALTITUDE" },
              ].map(({c,l})=>(
                <div key={l} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:c, boxShadow:`0 0 5px ${c}` }} />
                  <span style={{ fontSize:"0.5rem", letterSpacing:"0.1em", color:"var(--txt-dim)" }}>{l}</span>
                </div>
              ))}
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
                <svg width="40" height="6" viewBox="0 0 40 6">
                  <defs>
                    <linearGradient id="lg">
                      <stop offset="0%" stopColor="#00b4d8" />
                      <stop offset="50%" stopColor="#00e07a" />
                      <stop offset="100%" stopColor="#ff3b5c" />
                    </linearGradient>
                  </defs>
                  <rect width="40" height="6" rx="2" fill="url(#lg)" />
                </svg>
                <span style={{ fontSize:"0.5rem", color:"var(--txt-dim)" }}>LOW → HIGH ALT</span>
              </div>
            </div>
          )}
        </div>

        {/* Right stats panel */}
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>

          <div className="p" style={{ flexShrink:0 }}>
            <div className="ph"><span className="ph-dot" />LAUNCH POINT</div>
            <div className="pb">
              {origin ? (
                <>
                  <div style={{ fontSize:"0.58rem", color:"var(--txt-dim)", marginBottom:2 }}>LAT</div>
                  <div className="val" style={{ fontSize:"0.78rem" }}>{origin.lat.toFixed(6)}°</div>
                  <div style={{ fontSize:"0.58rem", color:"var(--txt-dim)", marginTop:5, marginBottom:2 }}>LON</div>
                  <div className="val" style={{ fontSize:"0.78rem" }}>{origin.lon.toFixed(6)}°</div>
                  <div style={{ fontSize:"0.58rem", color:"var(--txt-dim)", marginTop:5, marginBottom:2 }}>ALT</div>
                  <div className="val">{origin.bmpalt.toFixed(1)}<span className="u">m</span></div>
                </>
              ) : (
                <span className="lbl blink">WAITING…</span>
              )}
            </div>
          </div>

          <div className="p" style={{ flexShrink:0 }}>
            <div className="ph"><span className="ph-dot" />CURRENT POSITION</div>
            <div className="pb">
              {latest ? (
                <>
                  <div style={{ fontSize:"0.58rem", color:"var(--txt-dim)", marginBottom:2 }}>LAT</div>
                  <div className="val" style={{ fontSize:"0.78rem" }}>{latest.lat.toFixed(6)}°</div>
                  <div style={{ fontSize:"0.58rem", color:"var(--txt-dim)", marginTop:5, marginBottom:2 }}>LON</div>
                  <div className="val" style={{ fontSize:"0.78rem" }}>{latest.lon.toFixed(6)}°</div>
                  <div style={{ fontSize:"0.58rem", color:"var(--txt-dim)", marginTop:5, marginBottom:2 }}>ALT</div>
                  <div className="val-lg">{latest.bmpalt.toFixed(1)}<span className="u">m</span></div>
                </>
              ) : (
                <span className="lbl blink">WAITING…</span>
              )}
            </div>
          </div>

          <div className="p" style={{ flex:1 }}>
            <div className="ph"><span className="ph-dot" />FLIGHT STATS</div>
            <div className="pb" style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { l:"MAX ALTITUDE",  v:maxAlt!=null?`${maxAlt.toFixed(1)} m`:"--",   c:"var(--red)"    },
                { l:"MIN ALTITUDE",  v:minAlt!=null?`${minAlt.toFixed(1)} m`:"--",   c:"var(--accent)" },
                { l:"ALT RANGE",     v:maxAlt!=null&&minAlt!=null?`${(maxAlt-minAlt).toFixed(1)} m`:"--", c:"var(--purple)" },
                { l:"HORIZ DIST",    v:distM!=null?`${(distM/1000).toFixed(3)} km`:"--", c:"var(--green)"  },
                { l:"GPS POINTS",    v:String(gpsTrack.length),                       c:"var(--hi)"     },
              ].map(({l,v,c})=>(
                <div key={l}>
                  <div style={{ fontSize:"0.56rem", letterSpacing:"0.1em", color:"var(--txt-label)" }}>{l}</div>
                  <div style={{ fontSize:"0.9rem", fontWeight:700, color:c, textShadow:`0 0 6px ${c}70` }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
