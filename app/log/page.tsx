"use client";

import { useRef } from "react";
import { useTelemetry, type Pkt } from "../context/TelemetryContext";

function csvRow(p: Pkt): string {
  return [
    p.date, p.time, p.lat, p.lon, p.fix, p.sat,
    p.gpsalt, p.bmpalt, p.spd, p.crs,
    p.temp, p.humidity, p.pressure, p.mq,
    p.ax, p.ay, p.az,
    p.rssi ?? "", p.snr ?? "",
  ].join(",");
}

const CSV_HEADER = "date,time,lat,lon,fix,sat,gpsalt,bmpalt,spd,crs,temp,humidity,pressure,mq,ax,ay,az,rssi,snr";

function downloadCSV(data: Pkt[], filename: string) {
  const content = [CSV_HEADER, ...data.map(csvRow)].join("\n");
  const blob = new Blob([content], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(data: Pkt[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LogPage() {
  const { history, gpsTrack, connected, pkts, pkt } = useTelemetry();
  const tableRef = useRef<HTMLDivElement>(null);

  const ts = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0,19);

  const altArr  = history.map(p=>p.bmpalt);
  const tempArr = history.map(p=>p.temp);
  const rssiArr = history.map(p=>p.rssi).filter(r=>r!=null) as number[];

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <header style={{ height:40, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 14px", background:"rgba(2,8,18,.98)", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:"0.52rem", letterSpacing:"0.22em", color:"var(--accent)", fontWeight:700 }}>◈ BALLOON·SAT</span>
          <div style={{ width:1, height:14, background:"var(--border)" }} />
          <span style={{ fontSize:"0.5rem", letterSpacing:"0.14em", color:"var(--txt-dim)" }}>EXPORT & LOG</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ fontSize:"0.5rem", color:"var(--txt-dim)" }}>RECORDS <span style={{ color:"var(--hi)", fontWeight:700 }}>{history.length}</span></span>
          <div style={{ width:1, height:12, background:"var(--border)" }} />
          <div className={`pulse${connected?"":" dead"}`} />
          <span style={{ fontSize:"0.5rem", color:"var(--txt-dim)" }}>{connected?"LIVE":"OFFLINE"}</span>
        </div>
      </header>

      <div style={{ flex:1, minHeight:0, display:"grid", gridTemplateColumns:"200px 1fr", gap:5, padding:5 }}>

        {/* Left: export + summary */}
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>

          {/* Export */}
          <div className="p" style={{ flexShrink:0 }}>
            <div className="ph"><span className="ph-dot"/>EXPORT DATA</div>
            <div className="pb" style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { label:"ALL PACKETS — CSV",  disabled:history.length===0,  fn:()=>downloadCSV(history,  `balloonsat_${ts()}.csv`) },
                { label:"ALL PACKETS — JSON", disabled:history.length===0,  fn:()=>downloadJSON(history, `balloonsat_${ts()}.json`) },
                { label:"GPS TRACK — CSV",    disabled:gpsTrack.length===0, fn:()=>downloadCSV(gpsTrack, `balloonsat_gps_${ts()}.csv`) },
                { label:"GPS TRACK — JSON",   disabled:gpsTrack.length===0, fn:()=>downloadJSON(gpsTrack,`balloonsat_gps_${ts()}.json`) },
              ].map(({label,disabled,fn})=>(
                <button
                  key={label}
                  onClick={fn}
                  disabled={disabled}
                  style={{
                    width:"100%", padding:"6px 8px",
                    background: disabled ? "rgba(11,34,56,.4)" : "rgba(0,180,220,0.1)",
                    border:`1px solid ${disabled?"var(--border)":"rgba(0,180,220,0.35)"}`,
                    color: disabled ? "var(--txt-label)" : "var(--accent)",
                    fontSize:"0.58rem", letterSpacing:"0.1em",
                    cursor: disabled ? "not-allowed" : "pointer",
                    fontFamily:"monospace", textAlign:"left",
                    transition:"all .15s",
                  }}
                >
                  ↓ {label}
                </button>
              ))}
            </div>
          </div>

          {/* Session summary */}
          <div className="p" style={{ flex:1 }}>
            <div className="ph"><span className="ph-dot"/>SESSION SUMMARY</div>
            <div className="pb" style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {[
                { l:"TOTAL PACKETS",  v:String(pkts),                                          c:"var(--hi)"     },
                { l:"GPS FIXES",      v:String(gpsTrack.length),                               c:"var(--green)"  },
                { l:"MAX ALTITUDE",   v:altArr.length?`${Math.max(...altArr).toFixed(1)} m`:"--", c:"var(--red)"    },
                { l:"MIN ALTITUDE",   v:altArr.length?`${Math.min(...altArr).toFixed(1)} m`:"--", c:"var(--accent)" },
                { l:"AVG TEMP",       v:tempArr.length?`${(tempArr.reduce((a,b)=>a+b,0)/tempArr.length).toFixed(1)} °C`:"--", c:"var(--amber)"  },
                { l:"BEST RSSI",      v:rssiArr.length?`${Math.max(...rssiArr).toFixed(0)} dBm`:"--", c:"var(--green)"  },
                { l:"WORST RSSI",     v:rssiArr.length?`${Math.min(...rssiArr).toFixed(0)} dBm`:"--", c:"var(--red)"    },
                { l:"LAST FIX",       v:pkt?(pkt.fix?"YES":"NO"):"--",                         c:pkt?.fix?"var(--green)":"var(--red)" },
              ].map(({l,v,c})=>(
                <div key={l}>
                  <div className="lbl" style={{ fontSize:"0.5rem" }}>{l}</div>
                  <div className="val" style={{ fontSize:"0.88rem", color:c, textShadow:`0 0 6px ${c}70` }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: packet table */}
        <div className="p" style={{ overflow:"hidden" }}>
          <div className="ph">
            <span className="ph-dot"/>PACKET LOG
            <span style={{ marginLeft:"auto", fontSize:"0.46rem", color:"var(--txt-label)" }}>
              {history.length} records · newest first
            </span>
          </div>

          {/* Table header */}
          <div style={{
            display:"grid",
            gridTemplateColumns:"52px 56px 72px 72px 40px 38px 38px 44px 44px 44px 40px 36px",
            padding:"3px 8px",
            borderBottom:"1px solid var(--border)",
            background:"rgba(0,0,0,.3)",
          }}>
            {["TIME","DATE","LAT","LON","ALT","TEMP","HUM","BAR","CO₂","RSSI","SPD","FIX"].map(h=>(
              <span key={h} style={{ fontSize:"0.48rem", letterSpacing:"0.1em", color:"var(--txt-label)" }}>{h}</span>
            ))}
          </div>

          <div ref={tableRef} className="sc" style={{ height:"calc(100% - 48px)", overflowY:"auto" }}>
            {history.length === 0
              ? (
                <div style={{ padding:"20px 8px" }}>
                  <span style={{ fontSize:"0.58rem", color:"var(--txt-label)" }} className="blink">AWAITING PACKETS…</span>
                </div>
              )
              : [...history].reverse().map((p, i) => (
                <div
                  key={i}
                  style={{
                    display:"grid",
                    gridTemplateColumns:"52px 56px 72px 72px 40px 38px 38px 44px 44px 44px 40px 36px",
                    padding:"2px 8px",
                    borderBottom:"1px solid rgba(11,34,56,.3)",
                    background: i===0 ? "rgba(0,180,220,0.04)" : "transparent",
                  }}
                >
                  {[
                    p.time,
                    p.date,
                    p.lat.toFixed(4),
                    p.lon.toFixed(4),
                    p.bmpalt.toFixed(1),
                    p.temp.toFixed(1),
                    p.humidity.toFixed(1),
                    p.pressure.toFixed(1),
                    p.mq.toFixed(0),
                    String(p.rssi ?? "--"),
                    p.spd.toFixed(1),
                    p.fix ? "✓" : "✗",
                  ].map((v, j) => (
                    <span key={j} style={{
                      fontSize:"0.56rem",
                      fontFamily:"monospace",
                      color: j===11 ? (p.fix?"var(--green)":"var(--red)") : i===0 ? "var(--hi)" : "var(--txt-dim)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    }}>
                      {v}
                    </span>
                  ))}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
