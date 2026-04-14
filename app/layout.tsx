import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { TelemetryProvider } from "./context/TelemetryContext";
import Sidebar from "./components/Sidebar";

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BalloonSat · Mission Control",
  description: "Live telemetry dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geistMono.variable}>
      <body>
        <TelemetryProvider>
          <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
            <Sidebar />
            <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
              {children}
            </div>
          </div>
        </TelemetryProvider>
      </body>
    </html>
  );
}
