"use client";

import { useEffect, useRef } from "react";
import { useTelemetry } from "../context/TelemetryContext";

// Leaflet is loaded from CDN via script tag to avoid SSR issues
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

function LeafletMap() {
  const mapRef   = useRef<HTMLDivElement>(null);
  const leafRef  = useRef<{ map: unknown; marker: unknown; poly: unknown } | null>(null);
  const { gpsTrack, pkt } = useTelemetry();

  // Init map once Leaflet loads
  useEffect(() => {
    if (!mapRef.current) return;

    const init = () => {
      if (!window.L || leafRef.current) return;
      const L = window.L;

      const map = L.map(mapRef.current!, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // Custom icon
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#00c8f0;box-shadow:0 0 10px #00c8f0;border:2px solid #fff;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([0, 0], { icon }).addTo(map);
      const poly   = L.polyline([], { color: "#00c8f0", weight: 2, opacity: 0.8 }).addTo(map);

      map.setView([0, 0], 14);
      leafRef.current = { map, marker, poly };
    };

    if (window.L) { init(); return; }

    // Load Leaflet CSS + JS from CDN
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src   = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = init;
    document.head.appendChild(script);
  }, []);

  // Update marker + polyline when gpsTrack changes
  useEffect(() => {
    if (!leafRef.current) return;
    const { map, marker, poly } = leafRef.current as { map: any; marker: any; poly: any };
    const fixed = gpsTrack.filter(p => p.fix === 1 && (p.lat !== 0 || p.lon !== 0));
    if (!fixed.length) return;

    const latest = fixed[fixed.length - 1];
    marker.setLatLng([latest.lat, latest.lon]);
    marker.bindPopup(`
      <b style="font-family:monospace">ALT: ${latest.bmpalt.toFixed(1)} m</b><br/>
      T: ${latest.temp.toFixed(1)}°C &nbsp; H: ${latest.humidity.toFixed(1)}%<br/>
      CO₂ (MQ): ${latest.mq.toFixed(0)} ppm<br/>
      RSSI: ${latest.rssi ?? "--"} dBm
    `);

    const latlngs = fixed.map(p => [p.lat, p.lon]);
    poly.setLatLngs(latlngs);
    map.setView([latest.lat, latest.lon], map.getZoom());
  }, [gpsTrack]);

  return (
    <div ref={mapRef} style={{ width:"100%", height:"100%", borderRadius:0 }} />
  );
}

export default function MapPage() {
  const { pkt, connected, gpsTrack } = useTelemetry();

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <header style={{ height:40, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 14px", background:"rgba(2,8,18,.98)", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:"0.52rem", letterSpacing:"0.22em", color:"var(--accent)", fontWeight:700 }}>◈ BALLOON·SAT</span>
          <div style={{ width:1, height:14, background:"var(--border)" }} />
          <span style={{ fontSize:"0.5rem", letterSpacing:"0.14em", color:"var(--txt-dim)" }}>MAP VIEW</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          {[
            { l:"GPS FIXES",  v:String(gpsTrack.length) },
            { l:"LATITUDE",   v:pkt?.fix ? pkt.lat.toFixed(6)+"°" : "--" },
            { l:"LONGITUDE",  v:pkt?.fix ? pkt.lon.toFixed(6)+"°" : "--" },
            { l:"ALTITUDE",   v:pkt ? pkt.bmpalt.toFixed(1)+" m"  : "--" },
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

      <div style={{ flex:1, minHeight:0, display:"grid", gridTemplateColumns:"1fr 180px", gap:5, padding:5 }}>

        {/* Map */}
        <div className="p" style={{ position:"relative", overflow:"hidden" }}>
          <div className="ph"><span className="ph-dot" />LIVE TRACKING — OPENSTREETMAP</div>
          {gpsTrack.length === 0 ? (
            <div style={{ position:"absolute", inset:0, top:26, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
              <span style={{ fontSize:"0.58rem", letterSpacing:"0.14em", color:"var(--txt-dim)" }} className="blink">AWAITING GPS FIX…</span>
              <span style={{ fontSize:"0.52rem", color:"var(--txt-label)" }}>Map will appear once FIX = 1</span>
            </div>
          ) : (
            <div style={{ position:"absolute", inset:0, top:26 }}>
              <LeafletMap />
            </div>
          )}
        </div>

        {/* Side stats */}
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {[
            { title:"POSITION",   rows:[
              {l:"LAT",  v:pkt?.fix?pkt.lat.toFixed(6)+"°":"--"},
              {l:"LON",  v:pkt?.fix?pkt.lon.toFixed(6)+"°":"--"},
              {l:"ALT",  v:pkt?pkt.bmpalt.toFixed(1)+" m":"--"},
              {l:"GPS ALT", v:pkt?pkt.gpsalt.toFixed(1)+" m":"--"},
            ]},
            { title:"MOTION",    rows:[
              {l:"SPEED",  v:pkt?pkt.spd.toFixed(2)+" km/h":"--"},
              {l:"COURSE", v:pkt?pkt.crs.toFixed(1)+"°":"--"},
              {l:"SAT",    v:pkt?String(pkt.sat):"--"},
              {l:"FIX",    v:pkt?(pkt.fix?"3D LOCK":"SEARCHING"):"--"},
            ]},
          ].map(({title,rows})=>(
            <div key={title} className="p" style={{ flexShrink:0 }}>
              <div className="ph"><span className="ph-dot" />{title}</div>
              <div className="pb">
                {rows.map(({l,v})=>(
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"2.5px 0" }}>
                    <span className="lbl">{l}</span>
                    <span className="val" style={{ fontSize:"0.8rem" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="p" style={{ flex:1 }}>
            <div className="ph"><span className="ph-dot" />TRACK LOG</div>
            <div className="pb sc" style={{ overflowY:"auto", height:"100%" }}>
              {gpsTrack.slice().reverse().map((p,i)=>(
                <div key={i} style={{ fontSize:"0.54rem", lineHeight:1.7, color:i===0?"var(--hi)":"var(--txt-dim)", borderBottom:"1px solid rgba(11,34,56,.4)" }}>
                  [{p.time}] {p.lat.toFixed(4)}, {p.lon.toFixed(4)} @ {p.bmpalt.toFixed(0)}m
                </div>
              ))}
              {gpsTrack.length===0 && <span className="lbl blink">NO GPS FIXES YET</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
