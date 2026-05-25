import React from "react";
import type { ThemeConfig } from "../themes";

interface Props {
  progress: number; // 0 → 1 over full question
  current: number;  // 0-based question index
  total: number;
  theme: ThemeConfig;
}

export const ProgressBar: React.FC<Props> = ({
  progress,
  current,
  total,
  theme,
}) => {
  const overallFill = ((current + progress) / total) * 100;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 10,
        background: "rgba(255,255,255,0.07)",
      }}
    >
      {/* Fill */}
      <div
        style={{
          height: "100%",
          width: `${overallFill}%`,
          background: theme.progressGradient,
          boxShadow: `0 0 14px ${theme.primary}aa`,
          borderRadius: "0 6px 6px 0",
          transition: "width 0.1s linear",
        }}
      />

      {/* Question dividers */}
      {Array.from({ length: total - 1 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: -3,
            left: `${((i + 1) / total) * 100}%`,
            width: 2,
            height: 16,
            background: "rgba(255,255,255,0.18)",
            transform: "translateX(-50%)",
          }}
        />
      ))}
    </div>
  );
};
