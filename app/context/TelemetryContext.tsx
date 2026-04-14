"use client";

import {
  createContext, useCallback, useContext,
  useEffect, useRef, useState, type ReactNode,
} from "react";

// ── Packet type ───────────────────────────────────────────────────────────────
export interface Pkt {
  lat: number; lon: number; fix: number; sat: number;
  gpsalt: number; bmpalt: number; spd: number; crs: number;
  date: string; time: string; temp: number; humidity: number;
  pressure: number; ax: number; ay: number; az: number;
  rssi: number | null; snr: number | null; raw: string;
  _ts: number;
}

// ── Context shape ─────────────────────────────────────────────────────────────
export interface TelemetryCtx {
  pkt:       Pkt | null;
  connected: boolean;
  pkts:      number;
  history:   Pkt[];     // every packet (capped at 2 000)
  gpsTrack:  Pkt[];     // fix=1 only — for 3-D graph & map
  altH:  number[];
  tmpH:  number[];
  humH:  number[];
  preH:  number[];
  rsiH:  number[];
  log:   string[];
}

const DEFAULTS: TelemetryCtx = {
  pkt: null, connected: false, pkts: 0,
  history: [], gpsTrack: [],
  altH: [], tmpH: [], humH: [], preH: [], rsiH: [],
  log: [],
};

const Ctx = createContext<TelemetryCtx>(DEFAULTS);

// ── Immutable ring-push ───────────────────────────────────────────────────────
function rp<T>(arr: T[], val: T, cap: number): T[] {
  return [...arr.slice(-(cap - 1)), val];
}

// ── Provider ──────────────────────────────────────────────────────────────────
const WS_URL  = "ws://localhost:8000/ws";
const SPARK   = 80;
const MAX_PKT = 2000;
const MAX_LOG = 60;

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TelemetryCtx>(DEFAULTS);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () =>
      setState(s => ({ ...s, connected: true,
        log: rp(s.log, `▶ LINK UP  ${new Date().toLocaleTimeString()}`, MAX_LOG) }));

    ws.onclose = () => {
      setState(s => ({ ...s, connected: false,
        log: rp(s.log, `✖ LINK LOST  ${new Date().toLocaleTimeString()}`, MAX_LOG) }));
      setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = ({ data }) => {
      try {
        const p: Pkt = { ...JSON.parse(data), _ts: Date.now() };
        setState(s => ({
          ...s,
          pkt:      p,
          pkts:     s.pkts + 1,
          history:  rp(s.history,  p,          MAX_PKT),
          gpsTrack: p.fix === 1 ? rp(s.gpsTrack, p, MAX_PKT) : s.gpsTrack,
          altH: rp(s.altH, p.bmpalt,   SPARK),
          tmpH: rp(s.tmpH, p.temp,     SPARK),
          humH: rp(s.humH, p.humidity, SPARK),
          preH: rp(s.preH, p.pressure, SPARK),
          rsiH: p.rssi != null ? rp(s.rsiH, p.rssi, SPARK) : s.rsiH,
          log:  rp(s.log,
            `[${p.time}]  ALT ${p.bmpalt.toFixed(1)} m  T ${p.temp.toFixed(1)} °C  RSSI ${p.rssi ?? "--"} dBm`,
            MAX_LOG),
        }));
      } catch { /* skip malformed */ }
    };
  }, []);

  useEffect(() => { connect(); return () => wsRef.current?.close(); }, [connect]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useTelemetry = () => useContext(Ctx);

// ── Coordinate helper ─────────────────────────────────────────────────────────
/** Convert a GPS packet to local metres from an origin packet. */
export function toLocal(pkt: Pkt, origin: Pkt) {
  const lat0 = origin.lat * (Math.PI / 180);
  return {
    x: (pkt.lon - origin.lon) * Math.cos(lat0) * 111_320,
    y: pkt.bmpalt,
    z: -(pkt.lat - origin.lat) * 111_320,
  };
}
