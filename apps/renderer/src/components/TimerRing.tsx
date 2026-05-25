import React from "react";
import type { ThemeConfig } from "../themes";

interface Props {
  progress: number; // 0 → 1 (elapsed fraction of question)
  totalSeconds: number;
  size?: number;
  theme: ThemeConfig;
}

export const TimerRing: React.FC<Props> = ({
  progress,
  totalSeconds,
  size = 90,
  theme,
}) => {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const remaining = Math.max(0, Math.ceil(totalSeconds * (1 - progress)));
  const strokeOffset = circumference * progress; // consumed portion
  const urgent = progress > 0.7;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)", display: "block" }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={6}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={urgent ? "#ef4444" : theme.timerColor}
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 8px ${urgent ? "#ef4444" : theme.timerColor})`,
          }}
        />
      </svg>

      {/* Number */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: theme.fontFamily,
          fontSize: size * 0.34,
          fontWeight: 800,
          color: urgent ? "#ef4444" : theme.text,
        }}
      >
        {remaining}
      </div>
    </div>
  );
};
