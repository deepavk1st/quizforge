import React from "react";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { ThemeConfig } from "../themes";

interface Props {
  label: string; // "A" "B" "C" "D"
  text: string;
  isCorrect: boolean;
  isDimmed: boolean;
  theme: ThemeConfig;
  enterFrame: number;
}

export const AnswerOption: React.FC<Props> = ({
  label,
  text,
  isCorrect,
  isDimmed,
  theme,
  enterFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  const slideX = interpolate(entry, [0, 1], [-100, 0]);

  const bg = isCorrect
    ? `linear-gradient(135deg, ${theme.correctColor}28, ${theme.correctColor}18)`
    : isDimmed
      ? "rgba(255,255,255,0.03)"
      : theme.surface;

  const borderColor = isCorrect
    ? theme.correctColor
    : isDimmed
      ? "rgba(255,255,255,0.10)"
      : `${theme.primary}44`;

  const glow = isCorrect ? `0 0 30px ${theme.correctGlow}` : "none";
  const dimOpacity = isDimmed ? 0.45 : 1;

  return (
    <div
      style={{
        transform: `translateX(${slideX}px)`,
        opacity: entry * dimOpacity,
        display: "flex",
        alignItems: "center",
        gap: 20,
        background: bg,
        border: `2px solid ${borderColor}`,
        borderRadius: 18,
        padding: "16px 24px",
        boxShadow: glow,
      }}
    >
      {/* Letter badge */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: isCorrect
            ? `linear-gradient(135deg, ${theme.correctColor}, #059669)`
            : theme.badgeGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontFamily: theme.fontFamily,
          fontSize: 22,
          fontWeight: 900,
          color: "#fff",
          boxShadow: isCorrect ? `0 0 20px ${theme.correctGlow}` : "none",
        }}
      >
        {label}
      </div>

      {/* Option text */}
      <div
        style={{
          fontFamily: theme.fontFamily,
          fontSize: 28,
          fontWeight: isCorrect ? 700 : 500,
          color: isCorrect
            ? theme.correctColor
            : isDimmed
              ? theme.textMuted
              : theme.text,
          lineHeight: 1.3,
          flex: 1,
        }}
      >
        {text}
      </div>

      {/* Checkmark */}
      {isCorrect && (
        <div
          style={{
            fontSize: 36,
            color: theme.correctColor,
            fontWeight: 900,
          }}
        >
          ✓
        </div>
      )}
    </div>
  );
};
