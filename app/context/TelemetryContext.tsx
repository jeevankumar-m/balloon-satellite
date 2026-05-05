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
  /** MQ-series gas sensor (telemetry key `MQ`) — displayed as CO₂ */
  mq: number;
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
  mqH:   number[];
  rsiH:  number[];
  log:   string[];
}

const DEFAULTS: TelemetryCtx = {
  pkt: null, connected: false, pkts: 0,
  history: [], gpsTrack: [],
  altH: [], tmpH: [], humH: [], preH: [], mqH: [], rsiH: [],
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
  const srcRef = useRef<"mock" | "ws">("mock");
  const geoRef = useRef<{
    lat: number;
    lon: number;
    accM: number | null;
    ok: boolean;
  }>({ lat: 12.9716, lon: 77.5946, accM: null, ok: false });
  const mockRef = useRef<{ t0: number; i: number; timer: number | null }>({ t0: 0, i: 0, timer: null });
  const connectRef = useRef<() => void>(() => {});

  const pushPkt = useCallback((p: Pkt) => {
    setState(s => ({
      ...s,
      pkt:      p,
      connected: srcRef.current === "ws" ? s.connected : true,
      pkts:     s.pkts + 1,
      history:  rp(s.history,  p,          MAX_PKT),
      gpsTrack: p.fix === 1 ? rp(s.gpsTrack, p, MAX_PKT) : s.gpsTrack,
      altH: rp(s.altH, p.bmpalt,   SPARK),
      tmpH: rp(s.tmpH, p.temp,     SPARK),
      humH: rp(s.humH, p.humidity, SPARK),
      preH: rp(s.preH, p.pressure, SPARK),
      mqH:  rp(s.mqH,  p.mq,       SPARK),
      rsiH: p.rssi != null ? rp(s.rsiH, p.rssi, SPARK) : s.rsiH,
      log:  rp(
        s.log,
        `[${p.time}]  ALT ${p.bmpalt.toFixed(1)} m  T ${p.temp.toFixed(1)} °C  RSSI ${p.rssi ?? "--"} dBm`,
        MAX_LOG
      ),
    }));
  }, []);

  const startMock = useCallback(() => {
    if (mockRef.current.timer != null) return;
    srcRef.current = "mock";
    mockRef.current.t0 = Date.now();
    mockRef.current.i = 0;
    setState(s => ({
      ...s,
      connected: false,
      log: rp(s.log, `◉ DEMO MODE  generating telemetry`, MAX_LOG),
    }));

    const seq = {
      alt:   [0, 5, 12, 22, 35, 55, 82, 120, 170, 230, 300, 380, 470, 560, 650, 730, 800, 860, 910, 950, 980, 1000, 1010, 1005, 990, 960, 920, 870, 820, 760, 690, 610, 520, 430, 340, 260, 190, 130, 80, 40, 15, 5],
      temp:  [28.0, 27.7, 27.4, 27.1, 26.6, 26.0, 25.3, 24.4, 23.5, 22.7, 21.9, 21.0, 20.4, 19.8, 19.2, 18.7, 18.3, 18.0, 17.8, 17.6, 17.4, 17.3, 17.4, 17.6, 17.9, 18.3, 18.8, 19.4, 20.1, 20.9, 21.8, 22.6, 23.5, 24.4, 25.2, 25.9, 26.5, 27.0, 27.4, 27.7, 27.9, 28.0],
      hum:   [62, 61, 60, 60, 59, 58, 56, 54, 52, 50, 48, 46, 44, 42, 41, 40, 39, 38, 38, 37, 36, 36, 36, 37, 38, 40, 42, 44, 46, 48, 50, 53, 55, 57, 59, 60, 61, 62, 62, 62, 62, 62],
      rssi:  [-58, -60, -62, -64, -66, -68, -70, -72, -74, -75, -76, -77, -79, -81, -83, -85, -86, -87, -88, -89, -88, -86, -84, -82, -80, -78, -76, -74, -72, -70, -68, -66, -64, -62, -60, -59, -58, -58, -59, -60, -60, -59],
      crs:   [10, 14, 18, 22, 27, 33, 40, 48, 57, 67, 78, 90, 102, 114, 126, 138, 150, 162, 174, 186, 198, 210, 222, 234, 246, 258, 270, 282, 294, 306, 318, 330, 342, 354, 6, 18, 30, 42, 54, 66, 78, 90],
      spd:   [0, 0.2, 0.5, 0.8, 1.2, 1.8, 2.4, 3.2, 4.0, 4.8, 5.4, 6.0, 6.3, 6.5, 6.6, 6.6, 6.4, 6.0, 5.5, 5.0, 4.6, 4.2, 3.8, 3.4, 3.1, 2.8, 2.5, 2.2, 1.9, 1.6, 1.3, 1.0, 0.8, 0.6, 0.4, 0.3, 0.2, 0.15, 0.1, 0.05, 0.0, 0.0],
    };

    const tick = () => {
      const i = mockRef.current.i++;
      const j = i % seq.alt.length;
      const now = new Date();
      const date = now.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
      const time = now.toLocaleTimeString(undefined, { hour12: false });

      const g = geoRef.current;
      // Small visible motion so map + 3D path draw a trajectory
      const driftM = 2.0;
      const theta = (i * 12) * (Math.PI / 180);
      const dLat = (driftM * Math.cos(theta)) / 111_320;
      const dLon = (driftM * Math.sin(theta)) / (111_320 * Math.max(0.2, Math.cos(g.lat * Math.PI / 180)));

      const bmpalt = seq.alt[j];
      const ax = Math.round(Math.sin(i * 0.14) * 4200);
      const ay = Math.round(Math.sin(i * 0.11 + 1.3) * 3800);
      const az = 16384 + Math.round(Math.sin(i * 0.09 + 0.7) * 2200);

      const pkt: Pkt = {
        lat: g.lat + dLat,
        lon: g.lon + dLon,
        fix: 1,
        sat: g.ok ? 10 : 7,
        gpsalt: bmpalt + 3,
        bmpalt,
        spd: seq.spd[j],
        crs: seq.crs[j],
        date,
        time,
        temp: seq.temp[j],
        humidity: seq.hum[j],
        pressure: 1013.25 - bmpalt * 0.12,
        ax,
        ay,
        az,
        mq: 420 + Math.sin(i * 0.13) * 95 + (j % 7) * 2,
        rssi: seq.rssi[j],
        snr: 8 + (Math.sin(i * 0.18) * 3),
        raw: "DEMO",
        _ts: Date.now(),
      };

      pushPkt(pkt);
    };

    tick();
    mockRef.current.timer = window.setInterval(tick, 350);
  }, [pushPkt]);

  const stopMock = useCallback(() => {
    if (mockRef.current.timer == null) return;
    window.clearInterval(mockRef.current.timer);
    mockRef.current.timer = null;
  }, []);

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
      setTimeout(() => connectRef.current(), 3000);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = ({ data }) => {
      try {
        // If live data arrives, prefer it and stop demo feed
        if (srcRef.current !== "ws") {
          srcRef.current = "ws";
          stopMock();
          setState(s => ({ ...s, log: rp(s.log, `◎ USING LIVE TELEMETRY`, MAX_LOG) }));
        }
        const p: Pkt = { ...JSON.parse(data), _ts: Date.now() };
        pushPkt(p);
      } catch { /* skip malformed */ }
    };
  }, [pushPkt, stopMock]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    // Ask for GPS permission immediately (so lat/lon can be real user location).
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      const onOk = (pos: GeolocationPosition) => {
        geoRef.current = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          ok: true,
        };
        setState(s => ({
          ...s,
          log: rp(s.log, `📍 GPS OK  ±${geoRef.current.accM?.toFixed(0) ?? "?"} m`, MAX_LOG),
        }));
      };
      const onErr = (err: GeolocationPositionError) => {
        setState(s => ({
          ...s,
          log: rp(s.log, `⚠ GPS UNAVAILABLE  (${err.message || "permission denied"}) — using demo location`, MAX_LOG),
        }));
      };

      navigator.geolocation.getCurrentPosition(onOk, onErr, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 10_000,
      });
      const wid = navigator.geolocation.watchPosition(onOk, onErr, {
        enableHighAccuracy: true,
        maximumAge: 2_000,
        timeout: 20_000,
      });
      return () => navigator.geolocation.clearWatch(wid);
    }
    setState(s => ({
      ...s,
      log: rp(s.log, `⚠ GPS NOT SUPPORTED — using demo location`, MAX_LOG),
    }));
  }, []);

  useEffect(() => {
    // Always provide data immediately; switch to WS automatically if it connects.
    startMock();
    connect();
    return () => {
      stopMock();
      wsRef.current?.close();
    };
  }, [connect, startMock, stopMock]);

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
