"use client";

interface AxisLogoProps {
  size?: number;         // icon size in px
  variant?: "full" | "icon" | "email"; // full = icon + wordmark, icon = just mark
  dark?: boolean;        // true = light logo on dark bg (default), false = dark on light
}

// AXIS icon mark — stylized "A" with PVG olive + orange apex node
// Reads as both an "A" and an upward chart trend (billing growth)
export function AxisLogo({ size = 36, variant = "full", dark = true }: AxisLogoProps) {
  const iconSize = size;

  const mark = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      {/* Rounded square background */}
      <rect width="40" height="40" rx="9" fill="#262d05" />

      {/* Left leg of A */}
      <line x1="7" y1="33" x2="20" y2="9" stroke="#819800" strokeWidth="4" strokeLinecap="round" />
      {/* Right leg of A */}
      <line x1="33" y1="33" x2="20" y2="9" stroke="#819800" strokeWidth="4" strokeLinecap="round" />
      {/* Crossbar */}
      <line x1="12.5" y1="25.5" x2="27.5" y2="25.5" stroke="#819800" strokeWidth="3.5" strokeLinecap="round" />

      {/* Bottom-right accent — upward trend tick inside the A */}
      <line x1="21" y1="25.5" x2="27.5" y2="33" stroke="#fda22c" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />

      {/* Apex node — orange dot */}
      <circle cx="20" cy="9" r="2.8" fill="#fda22c" />
    </svg>
  );

  if (variant === "icon") return mark;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
      {mark}
      <div style={{ display: "flex", flexDirection: "column", gap: "0px", lineHeight: 1 }}>
        <span style={{
          color: dark ? "#ffffff" : "#262d05",
          fontWeight: 800,
          fontSize: `${Math.round(iconSize * 0.5)}px`,
          letterSpacing: "0.18em",
          fontFamily: "Arial, sans-serif",
          lineHeight: 1,
        }}>
          AXIS
        </span>
        <span style={{
          color: dark ? "#819800" : "#819800",
          fontWeight: 500,
          fontSize: `${Math.round(iconSize * 0.26)}px`,
          letterSpacing: "0.06em",
          fontFamily: "Arial, sans-serif",
          lineHeight: 1.4,
        }}>
          by Pura Vida Growth
        </span>
      </div>
    </div>
  );
}

// Standalone React component version for nav/app use
export function AxisIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="9" fill="#262d05" />
      <line x1="7" y1="33" x2="20" y2="9" stroke="#819800" strokeWidth="4" strokeLinecap="round" />
      <line x1="33" y1="33" x2="20" y2="9" stroke="#819800" strokeWidth="4" strokeLinecap="round" />
      <line x1="12.5" y1="25.5" x2="27.5" y2="25.5" stroke="#819800" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="21" y1="25.5" x2="27.5" y2="33" stroke="#fda22c" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
      <circle cx="20" cy="9" r="2.8" fill="#fda22c" />
    </svg>
  );
}

// HTML string version for email headers (inline, no React)
export function axisLogoEmailHtml(subtitle = "AI Billing Assistant"): string {
  return `
    <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:4px">
      <div style="width:38px;height:38px;background:#262d05;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="38" height="38" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <line x1="7" y1="33" x2="20" y2="9" stroke="#819800" stroke-width="4" stroke-linecap="round"/>
          <line x1="33" y1="33" x2="20" y2="9" stroke="#819800" stroke-width="4" stroke-linecap="round"/>
          <line x1="12.5" y1="25.5" x2="27.5" y2="25.5" stroke="#819800" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="21" y1="25.5" x2="27.5" y2="33" stroke="#fda22c" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
          <circle cx="20" cy="9" r="2.8" fill="#fda22c"/>
        </svg>
      </div>
      <div>
        <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.18em;font-family:Arial,sans-serif;line-height:1">AXIS</div>
        <div style="color:#819800;font-size:11px;font-weight:500;letter-spacing:0.06em;font-family:Arial,sans-serif;line-height:1.4">by Pura Vida Growth</div>
      </div>
    </div>
    <p style="color:#9ca3af;margin:4px 0 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif">${subtitle}</p>
  `;
}
