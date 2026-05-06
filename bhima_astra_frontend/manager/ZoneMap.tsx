import React, { useState } from "react";
import type { Zone, ZoneStatus } from "./ZoneOverview";

interface ZoneMapProps {
  zones: Zone[];
}

/* Static layout positions for up to 8 zones — abstract grid, no geo accuracy */
const GRID_POSITIONS: { x: number; y: number; w: number; h: number }[] = [
  { x: 20,  y: 30,  w: 140, h: 100 },
  { x: 175, y: 20,  w: 120, h: 80  },
  { x: 310, y: 40,  w: 150, h: 110 },
  { x: 180, y: 120, w: 130, h: 90  },
  { x: 20,  y: 150, w: 110, h: 80  },
  { x: 470, y: 30,  w: 120, h: 70  },
  { x: 470, y: 120, w: 120, h: 80  },
  { x: 340, y: 170, w: 100, h: 60  },
];

const STATUS_FILL: Record<ZoneStatus, string> = {
  alert:  "rgba(255,255,255,0.18)",
  active: "rgba(255,255,255,0.08)",
  stable: "rgba(255,255,255,0.03)",
};

const STATUS_STROKE: Record<ZoneStatus, string> = {
  alert:  "rgba(255,255,255,0.6)",
  active: "rgba(255,255,255,0.28)",
  stable: "rgba(255,255,255,0.1)",
};

export const ZoneMap: React.FC<ZoneMapProps> = ({ zones }) => {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="zone-map-card nuvia-card">
      <div className="card-eyebrow">Live Zone Map</div>

      <div className="zone-map-legend">
        <span className="zone-map-legend-item">
          <span className="zone-map-legend-dot zone-map-legend-dot--alert" />
          Alert
        </span>
        <span className="zone-map-legend-item">
          <span className="zone-map-legend-dot zone-map-legend-dot--active" />
          Active
        </span>
        <span className="zone-map-legend-item">
          <span className="zone-map-legend-dot zone-map-legend-dot--stable" />
          Stable
        </span>
      </div>

      <div className="zone-map-viewport">
        <svg
          viewBox="0 0 620 270"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "100%" }}
        >
          {/* Grid lines — subtle background */}
          <defs>
            <pattern
              id="grid"
              width="30"
              height="30"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 30 0 L 0 0 0 30"
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="620" height="270" fill="url(#grid)" rx="4" />

          {zones.map((zone, i) => {
            const pos = GRID_POSITIONS[i % GRID_POSITIONS.length];
            const isHovered = hovered === zone.zone_id;
            const fill =
              isHovered
                ? "rgba(255,255,255,0.22)"
                : STATUS_FILL[zone.status];
            const stroke =
              isHovered
                ? "rgba(255,255,255,0.8)"
                : STATUS_STROKE[zone.status];

            return (
              <g
                key={zone.zone_id}
                onMouseEnter={() => setHovered(zone.zone_id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={pos.w}
                  height={pos.h}
                  rx={8}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={zone.status === "alert" ? 1.5 : 1}
                  style={{ transition: "fill 0.3s, stroke 0.3s" }}
                />

                {/* Zone ID label */}
                <text
                  x={pos.x + 10}
                  y={pos.y + 18}
                  fill="rgba(255,255,255,0.35)"
                  fontFamily="'DM Mono', monospace"
                  fontSize="9"
                  letterSpacing="1.5"
                >
                  {zone.zone_id}
                </text>

                {/* Zone name */}
                <text
                  x={pos.x + 10}
                  y={pos.y + 36}
                  fill={
                    zone.status === "alert"
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(255,255,255,0.65)"
                  }
                  fontFamily="'DM Mono', monospace"
                  fontSize="11"
                  fontWeight="500"
                >
                  {zone.zone_name.length > 14
                    ? zone.zone_name.slice(0, 14) + "…"
                    : zone.zone_name}
                </text>

                {/* Workers count */}
                <text
                  x={pos.x + 10}
                  y={pos.y + pos.h - 24}
                  fill="rgba(255,255,255,0.28)"
                  fontFamily="'DM Mono', monospace"
                  fontSize="9"
                  letterSpacing="0.5"
                >
                  {zone.active_workers} workers
                </text>

                {/* Composite score bar inside the box */}
                <rect
                  x={pos.x + 10}
                  y={pos.y + pos.h - 12}
                  width={pos.w - 20}
                  height={2}
                  rx={1}
                  fill="rgba(255,255,255,0.07)"
                />
                <rect
                  x={pos.x + 10}
                  y={pos.y + pos.h - 12}
                  width={(pos.w - 20) * zone.composite_score}
                  height={2}
                  rx={1}
                  fill={
                    zone.status === "alert"
                      ? "rgba(255,255,255,0.85)"
                      : "rgba(255,255,255,0.4)"
                  }
                  style={{ transition: "width 1s ease" }}
                />

                {/* Alert pulsing dot */}
                {zone.status === "alert" && (
                  <circle
                    cx={pos.x + pos.w - 14}
                    cy={pos.y + 14}
                    r={4}
                    fill="rgba(255,255,255,0.9)"
                    style={{
                      animation: "pulse 2s infinite",
                    }}
                  />
                )}

                {/* Hover tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x={pos.x + pos.w / 2 - 55}
                      y={pos.y - 38}
                      width={110}
                      height={30}
                      rx={4}
                      fill="rgba(10,10,10,0.92)"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth={1}
                    />
                    <text
                      x={pos.x + pos.w / 2}
                      y={pos.y - 26}
                      fill="rgba(255,255,255,0.85)"
                      fontFamily="'DM Mono', monospace"
                      fontSize="9"
                      letterSpacing="0.5"
                      textAnchor="middle"
                    >
                      Score: {(zone.composite_score * 100).toFixed(0)}% ·{" "}
                      {zone.disruption_level}
                    </text>
                    <text
                      x={pos.x + pos.w / 2}
                      y={pos.y - 14}
                      fill="rgba(255,255,255,0.4)"
                      fontFamily="'DM Mono', monospace"
                      fontSize="8"
                      textAnchor="middle"
                    >
                      {zone.pending_flags} pending flag
                      {zone.pending_flags !== 1 ? "s" : ""}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="zone-map-footnote">
        Visual representation only — not geographically accurate
      </p>
    </div>
  );
};
