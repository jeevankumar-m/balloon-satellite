"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTelemetry } from "../context/TelemetryContext";

const NAV = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="7" height="7" rx="1" />
        <rect x="11" y="2" width="7" height="7" rx="1" />
        <rect x="2" y="11" width="7" height="7" rx="1" />
        <rect x="11" y="11" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/flightpath",
    label: "3D Flight Path",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10 2L18 7V13L10 18L2 13V7L10 2Z" />
        <path d="M10 2V18M2 7L18 7M2 13L18 13" opacity="0.5" />
      </svg>
    ),
  },
  {
    href: "/map",
    label: "Map View",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10 2C7.24 2 5 4.24 5 7c0 4 5 11 5 11s5-7 5-11c0-2.76-2.24-5-5-5z" />
        <circle cx="10" cy="7" r="1.5" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 14l4-5 4 3 4-7" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M3 17h14" />
      </svg>
    ),
  },
  {
    href: "/signal",
    label: "Signal Health",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M1 10c0-5 4-9 9-9s9 4 9 9" strokeLinecap="round" />
        <path d="M4 10c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
        <path d="M7 10c0-1.7 1.3-3 3-3s3 1.3 3 3" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/log",
    label: "Export & Log",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4h8l4 4v10H4V4z" />
        <path d="M12 4v4h4" />
        <path d="M7 11h6M7 14h4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const path = usePathname();
  const { connected, pkts } = useTelemetry();

  return (
    <aside style={{
      width: 52,
      flexShrink: 0,
      height: "100vh",
      background: "rgba(2,8,18,0.98)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: 10,
      paddingBottom: 10,
      gap: 2,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        width: 32, height: 32, marginBottom: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--accent)",
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={24} height={24}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
          <path d="M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" strokeLinecap="round" opacity="0.5" />
        </svg>
      </div>

      {/* Nav items */}
      {NAV.map(({ href, label, icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            style={{
              width: 40, height: 40,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 6,
              color: active ? "var(--accent)" : "var(--txt-dim)",
              background: active ? "rgba(0,180,220,0.1)" : "transparent",
              boxShadow: active ? "inset 0 0 0 1px rgba(0,180,220,0.25)" : "none",
              transition: "all 0.15s",
              textDecoration: "none",
              position: "relative",
            }}
          >
            {/* Active left bar */}
            {active && (
              <div style={{
                position: "absolute", left: -1, top: 8, bottom: 8,
                width: 2, background: "var(--accent)",
                borderRadius: "0 2px 2px 0",
                boxShadow: "0 0 6px var(--accent)",
              }} />
            )}
            <div style={{ width: 20, height: 20 }}>{icon}</div>
          </Link>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Live indicator */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        marginBottom: 6,
      }}>
        <div
          className={`pulse${connected ? "" : " dead"}`}
          style={{ width: 7, height: 7 }}
        />
        <span style={{
          fontSize: "0.42rem", letterSpacing: "0.08em",
          color: "var(--txt-label)", textAlign: "center", lineHeight: 1.3,
          writingMode: "vertical-lr",
          transform: "rotate(180deg)",
        }}>
          {pkts} PKT
        </span>
      </div>
    </aside>
  );
}
