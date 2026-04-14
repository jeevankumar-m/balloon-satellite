# BalloonSat Ground Control Dashboard

A real-time ground station dashboard for a high-altitude balloon satellite. Receives telemetry from a LoRa radio receiver over USB serial, streams it via WebSocket, and displays it in a dark mission-control UI.

---

## Features

| Page | What it shows |
|------|--------------|
| **Dashboard** | Live sensor tiles, 3D IMU cube, accelerometer bars, telemetry log |
| **3D Flight Path** | Three.js 3D trajectory with altitude colour gradient and auto-scale |
| **Map View** | OpenStreetMap live tracking via Leaflet (no API key needed) |
| **Analytics** | Scatter plots and time-series charts for temp, pressure, humidity, altitude |
| **Signal Health** | RSSI / SNR history, packet loss rate, signal quality indicator |
| **Export & Log** | Full packet table, CSV/JSON export for all packets or GPS track only |

---

## Hardware Requirements

- A microcontroller (e.g. Arduino, ESP32) sending telemetry over LoRa
- A LoRa receiver module connected to the ground station PC via USB
- The receiver must appear as a serial COM port on Windows (or `/dev/ttyUSBx` on Linux/Mac)

### Expected serial packet format

Each packet is a multi-line block terminated by a line of `=====`:

```
LAT:12.9716,LON:77.5946,FIX:1,SAT:8,GPSALT:920.5,BMPALT:918.3,SPD:1.2,CRS:45.0,DATE:2024-04-14,TIME:10:23:55,T:24.5,H:61.2,P:912.4,AX:-320,AY:112,AZ:16200
RSSI: -72
SNR: 8.5
==========
```

| Field | Description |
|-------|-------------|
| `LAT` / `LON` | GPS coordinates (decimal degrees) |
| `FIX` | GPS fix status — `1` = locked, `0` = searching |
| `SAT` | Satellites in view |
| `GPSALT` | GPS altitude (metres) |
| `BMPALT` | Barometric altitude from BMP sensor (metres) |
| `SPD` | Ground speed (km/h) |
| `CRS` | Course / heading (degrees) |
| `DATE` / `TIME` | Timestamp from GPS |
| `T` | Temperature (°C) |
| `H` | Relative humidity (%) |
| `P` | Atmospheric pressure (hPa) |
| `AX` / `AY` / `AZ` | MPU6050 accelerometer raw values (±2g range, 16384 LSB/g) |
| `RSSI` | Received signal strength (dBm) — optional, appended by receiver |
| `SNR` | Signal-to-noise ratio (dB) — optional, appended by receiver |

---

## Prerequisites

Make sure you have the following installed before starting:

| Tool | Minimum version | How to install |
|------|----------------|----------------|
| Node.js | 18 | https://nodejs.org |
| pnpm | any recent | `npm install -g pnpm` |
| Python | 3.10 | https://python.org |

Verify your versions:

```bash
node --version
python --version
```

---

## Project Structure

```
balloon-sat/
├── app/                          # Next.js frontend (App Router)
│   ├── components/
│   │   ├── CubeIMU.tsx           # Live 3D IMU cube (Three.js)
│   │   ├── FlightPath3D.tsx      # 3D GPS flight path (Three.js)
│   │   └── Sidebar.tsx           # Icon navigation sidebar
│   ├── context/
│   │   └── TelemetryContext.tsx  # Shared WebSocket + packet state
│   ├── flightpath/page.tsx       # 3D flight path page
│   ├── map/page.tsx              # Leaflet live map page
│   ├── analytics/page.tsx        # Charts & analytics page
│   ├── signal/page.tsx           # Signal health page
│   ├── log/page.tsx              # Packet log & export page
│   ├── globals.css               # Dark theme CSS variables
│   ├── layout.tsx                # Root layout (sidebar + provider)
│   └── page.tsx                  # Main dashboard
├── backend/
│   ├── main.py                   # FastAPI WebSocket server + serial reader
│   └── requirements.txt          # Python dependencies
├── package.json
└── README.md
```

---

## Setup — Step by Step

### Step 1 — Get the code

If you have Git:

```bash
git clone <your-repo-url>
cd balloon-sat
```

Or extract the downloaded zip and open a terminal inside the `balloon-sat/` folder.

---

### Step 2 — Configure the serial port (REQUIRED)

> **This is the most critical step. If you skip it the backend will fail to open the port and no data will appear.**

Open `backend/main.py` in any text editor. The first thing you see at the top is the config block:

```python
# ── Config ──────────────────────────────────────────────────────────────────
SERIAL_PORT = "COM3"
BAUD_RATE   = 115200        # change to 9600 if your receiver uses that
```

Change `"COM3"` to the port your LoRa USB receiver is actually connected to.

**How to find your COM port:**

- **Windows** — Open **Device Manager** → expand **Ports (COM & LPT)**. Look for your USB serial device (e.g. `USB-SERIAL CH340 (COM5)`). Use that name exactly, e.g. `"COM5"`.
- **Linux** — Run `ls /dev/ttyUSB*` or `ls /dev/ttyACM*`. Use the path shown, e.g. `"/dev/ttyUSB0"`.
- **macOS** — Run `ls /dev/cu.*`. Use the path shown, e.g. `"/dev/cu.usbserial-0001"`.

**Also check the baud rate.** If your LoRa transmitter is configured for 9600 baud, change `BAUD_RATE = 9600`. The transmitter and receiver must use the same value.

> **Symptom of a wrong baud rate:** The backend terminal shows garbled characters like `[rx] 'ތ'` or `[rx] '{'` instead of readable text. Fix: change `BAUD_RATE` to match your hardware.

---

### Step 3 — Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

This installs three packages:

| Package | Purpose |
|---------|---------|
| `fastapi` | Web framework / WebSocket server |
| `uvicorn` | ASGI server that runs FastAPI |
| `pyserial` | Serial port access |

> On some systems you may need `pip3` instead of `pip`. If pip is not found, run `python -m pip install -r requirements.txt`.

---

### Step 4 — Start the backend server

From inside the `backend/` folder:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Expected output:

```
INFO:     Started server process [12345]
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
[serial] Opened COM3 @ 115200 baud
```

If instead you see:

```
[serial] could not open port COM3: ... retrying in 3 s …
```

Go back to Step 2 and double-check the port name and that the device is plugged in.

> **Leave this terminal open.** The backend must keep running the entire time you use the dashboard.

---

### Step 5 — Install frontend dependencies

Open a **new, separate terminal** in the root `balloon-sat/` folder (not inside `backend/`):

```bash
pnpm install
```

This downloads all Node packages including Next.js, React, Three.js, and TypeScript type definitions. It may take a minute the first time.

> If `pnpm` is not found: `npm install -g pnpm`, then run `pnpm install` again.

---

### Step 6 — Start the frontend

```bash
pnpm dev
```

Expected output:

```
▲ Next.js 16.2.3
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000
```

Open **http://localhost:3000** in your browser.

The status indicator in the top-right of each page shows:
- `LIVE` with a pulsing cyan dot — WebSocket connected, receiving data
- `OFFLINE` with a grey dot — backend not reachable (check Step 4)

Data starts populating as soon as valid packets arrive from the serial port.

---

## Running in Production (optional)

To serve an optimised build instead of the dev server:

```bash
pnpm build
pnpm start
```

---

## Both Terminals at a Glance

You will always have two terminals open:

| Terminal | Working directory | Command |
|----------|------------------|---------|
| Backend | `balloon-sat/backend/` | `uvicorn main:app --host 0.0.0.0 --port 8000 --reload` |
| Frontend | `balloon-sat/` | `pnpm dev` |

---

## Troubleshooting

### Dashboard shows OFFLINE or data never appears

1. Make sure the backend is running (Step 4) and shows no serial errors.
2. Check the browser console (F12) for WebSocket connection errors.
3. The frontend connects to `ws://localhost:8000/ws`. Both must be on the same machine unless you change the URL in `app/context/TelemetryContext.tsx`.

### Garbled output in the backend terminal

```
[rx] 'ތ'
[rx] '{'
[rx] 'v'
```

Baud rate mismatch. Edit `BAUD_RATE` in `backend/main.py` to match the transmitter (try `9600` or `115200`).

### `[parse] FAILED — regex did not match`

The incoming packet format does not match the expected format. Check that your transmitter firmware outputs fields in the exact format shown in the **Expected serial packet format** section above. The field names (`LAT:`, `LON:`, `T:`, etc.) must match exactly.

### Serial port permission denied (Linux / macOS)

```
[serial] could not open port /dev/ttyUSB0: [Errno 13] Permission denied
```

Add your user to the `dialout` group, then log out and back in:

```bash
sudo usermod -aG dialout $USER
```

### Map page shows "AWAITING GPS FIX"

Normal at startup or when indoors. The map only renders after at least one packet with `FIX:1` is received, meaning the GPS module has a satellite lock. All other sensors (temperature, pressure, IMU) update regardless of GPS fix status.

### 3D Flight Path shows no track

The 3D path page requires at least 2 packets with `FIX:1`. Take the receiver outdoors to get a GPS lock. Packets with `FIX:0` are stored in history but not added to the GPS track.

### `pnpm: command not found`

```bash
npm install -g pnpm
```

### Python `ModuleNotFoundError`

You may have multiple Python versions. Try:

```bash
python3 -m pip install -r requirements.txt
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | Next.js (App Router) | 16.2.3 |
| UI library | React | 19.2.4 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS + custom CSS variables | 4 |
| 3D rendering | Three.js | 0.183 |
| Map | Leaflet (CDN, no API key required) | 1.9 |
| Backend | FastAPI | 0.115 |
| ASGI server | Uvicorn | 0.32 |
| Serial port | pyserial | 3.5 |
| Real-time transport | WebSocket | native |
| Package manager | pnpm | — |

---

## Quick Reference Card

```
# 1. Edit serial port
backend/main.py  →  SERIAL_PORT = "COMx"   (Windows)
                    SERIAL_PORT = "/dev/ttyUSBx"  (Linux/Mac)

# 2. Edit baud rate (if needed)
backend/main.py  →  BAUD_RATE = 115200   (or 9600)

# 3. Start backend
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 4. Start frontend (new terminal, root folder)
pnpm dev

# 5. Open browser
http://localhost:3000
```
