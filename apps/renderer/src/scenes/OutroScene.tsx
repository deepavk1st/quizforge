import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import type { ThemeConfig } from "../themes";
import { BackgroundEffects } from "../components/BackgroundEffects";

interface Props {
  theme: ThemeConfig;
  totalQuestions: number;
}

export const OutroScene: React.FC<Props> = ({ theme, totalQuestions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const iconEntry = spring({
    frame: frame - 5,
    fps,
    config: { damping: 14, stiffness: 280 },
  });
  const textEntry = spring({
    frame: frame - 20,
    fps,
    config: { damping: 20, stiffness: 160 },
  });
  const subEntry = spring({
    frame: frame - 35,
    fps,
    config: { damping: 20, stiffness: 160 },
  });

  return (
    <AbsoluteFill style={{ background: theme.background }}>
      <BackgroundEffects theme={theme} frame={frame} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
        }}
      >
        {/* Trophy icon */}
        <div
          style={{
            transform: `scale(${iconEntry})`,
            fontSize: 120,
            filter: `drop-shadow(0 0 30px ${theme.primary}88)`,
          }}
        >
          🏆
        </div>

        {/* Main text */}
        <div
          style={{
            fontFamily: theme.fontFamily,
            fontSize: 100,
            fontWeight: 900,
            color: theme.text,
            textAlign: "center" as const,
            letterSpacing: -3,
            transform: `translateY(${interpolate(textEntry, [0, 1], [50, 0])}px)`,
            opacity: textEntry,
            textShadow: `0 0 80px ${theme.primary}66`,
          }}
        >
          That&apos;s a Wrap!
        </div>

        {/* Sub line */}
        <div
          style={{
            fontFamily: theme.fontFamily,
            fontSize: 32,
            fontWeight: 500,
            color: theme.textMuted,
            letterSpacing: 2,
            transform: `translateY(${interpolate(subEntry, [0, 1], [30, 0])}px)`,
            opacity: subEntry,
          }}
        >
          {totalQuestions} questions • How many did you get right?
        </div>

        {/* CTA bar */}
        <div
          style={{
            marginTop: 16,
            background: theme.badgeGradient,
            borderRadius: 999,
            padding: "18px 60px",
            fontFamily: theme.fontFamily,
            fontSize: 28,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: 2,
            boxShadow: `0 0 60px ${theme.primary}55`,
            opacity: subEntry,
          }}
        >
          LIKE · COMMENT · SUBSCRIBE
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
