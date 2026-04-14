import asyncio
import re
import json
from typing import Optional

import serial
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# ── Config ──────────────────────────────────────────────────────────────────
SERIAL_PORT = "COM3"
BAUD_RATE   = 115200        # change to 9600 if your receiver uses that

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="BalloonSat Ground Station")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

clients: list[WebSocket] = []


# ── Packet parser ────────────────────────────────────────────────────────────

RAW_RE = re.compile(
    r"LAT:([\-\d.]+),LON:([\-\d.]+),FIX:(\d+),SAT:(\d+),"
    r"GPSALT:([\-\d.]+),BMPALT:([\-\d.]+),SPD:([\-\d.]+),CRS:([\-\d.]+),"
    r"DATE:([^,]+),TIME:([^,]+),"
    r"T:([\-\d.]+),H:([\-\d.]+),P:([\-\d.]+),"
    r"AX:([\-\d]+),AY:([\-\d]+),AZ:([\-\d]+)"
)
RSSI_RE = re.compile(r"RSSI:\s*([\-\d.]+)")
SNR_RE  = re.compile(r"SNR:\s*([\-\d.]+)")


def parse_packet(buf: str) -> Optional[dict]:
    m = RAW_RE.search(buf)
    if not m:
        return None

    rssi_m = RSSI_RE.search(buf)
    snr_m  = SNR_RE.search(buf)

    return {
        "lat":      float(m.group(1)),
        "lon":      float(m.group(2)),
        "fix":      int(m.group(3)),
        "sat":      int(m.group(4)),
        "gpsalt":   float(m.group(5)),
        "bmpalt":   float(m.group(6)),
        "spd":      float(m.group(7)),
        "crs":      float(m.group(8)),
        "date":     m.group(9),
        "time":     m.group(10),
        "temp":     float(m.group(11)),
        "humidity": float(m.group(12)),
        "pressure": float(m.group(13)),
        "ax":       int(m.group(14)),
        "ay":       int(m.group(15)),
        "az":       int(m.group(16)),
        "rssi":     float(rssi_m.group(1)) if rssi_m else None,
        "snr":      float(snr_m.group(1))  if snr_m  else None,
        "raw":      buf.strip(),
    }


# ── Serial reader task ────────────────────────────────────────────────────────

async def broadcast(msg: str) -> None:
    dead: list[WebSocket] = []
    for ws in clients:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        try:
            clients.remove(ws)
        except ValueError:
            pass


async def serial_reader() -> None:
    while True:
        try:
            ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
            print(f"[serial] Opened {SERIAL_PORT} @ {BAUD_RATE} baud")
            buffer = ""
            while True:
                raw_bytes = await asyncio.get_event_loop().run_in_executor(
                    None, ser.readline
                )
                line = raw_bytes.decode("utf-8", errors="ignore").strip()
                if not line:
                    continue

                print(f"[rx] {repr(line)}")   # ← debug: show every line received
                buffer += line + "\n"

                # Packet ends with the "==" separator line
                if "=" * 5 in line:
                    print(f"[parse] Buffer length={len(buffer)} chars, attempting parse …")
                    data = parse_packet(buffer)
                    if data:
                        print(f"[parse] OK — broadcasting to {len(clients)} client(s)")
                        await broadcast(json.dumps(data))
                    else:
                        print(f"[parse] FAILED — regex did not match. Buffer:\n{buffer}")
                    buffer = ""
        except serial.SerialException as exc:
            print(f"[serial] {exc} — retrying in 3 s …")
            await asyncio.sleep(3)
        except Exception as exc:
            print(f"[serial] Unexpected error: {exc} — retrying in 3 s …")
            await asyncio.sleep(3)


@app.on_event("startup")
async def startup() -> None:
    asyncio.create_task(serial_reader())


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    clients.append(ws)
    print(f"[ws] Client connected  (total: {len(clients)})")
    try:
        # Keep the connection open; we only push data, never pull
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        try:
            clients.remove(ws)
        except ValueError:
            pass
        print(f"[ws] Client disconnected (total: {len(clients)})")


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "clients": len(clients)}
