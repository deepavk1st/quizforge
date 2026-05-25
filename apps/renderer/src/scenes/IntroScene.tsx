import React from "react";
import {
  AbsoluteFill,
  Audio,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import type { ThemeConfig } from "../themes";
import type { BackgroundStyle } from "../types";
import { BackgroundEffects } from "../components/BackgroundEffects";

interface Props {
  theme: ThemeConfig;
  category: string;
  subcategory: string;
  audioFiles?: Record<string, string>;
  apiBase?: string;
  backgroundStyle?: BackgroundStyle;
}

export const IntroScene: React.FC<Props> = ({
  theme,
  category,
  subcategory,
  audioFiles = {},
  apiBase = "http://localhost:4001",
  backgroundStyle = "particles",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeEntry = spring({
    frame: frame - 5,
    fps,
    config: { damping: 18, stiffness: 160 },
  });
  const titleEntry = spring({
    frame: frame - 15,
    fps,
    config: { damping: 22, stiffness: 140 },
  });
  const subtitleEntry = spring({
    frame: frame - 30,
    fps,
    config: { damping: 20, stiffness: 150 },
  });

  return (
    <AbsoluteFill style={{ background: theme.background }}>
      <BackgroundEffects theme={theme} frame={frame} style={backgroundStyle} />

      {/* Intro narration */}
      {audioFiles.intro && (
        <Audio src={`${apiBase}${audioFiles.intro}`} volume={1} />
      )}

      {/* Content center */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
        }}
      >
        {/* Sub-badge */}
        <div
          style={{
            transform: `scale(${badgeEntry})`,
            background: theme.badgeGradient,
            borderRadius: 999,
            padding: "12px 36px",
            fontFamily: theme.fontFamily,
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: 6,
            textTransform: "uppercase" as const,
            boxShadow: `0 0 60px ${theme.primary}55`,
          }}
        >
          {subcategory}
        </div>

        {/* Category title */}
        <div
          style={{
            fontFamily: theme.fontFamily,
            fontSize: 130,
            fontWeight: 900,
            color: theme.text,
            letterSpacing: -4,
            textAlign: "center" as const,
            transform: `translateY(${interpolate(titleEntry, [0, 1], [70, 0])}px)`,
            opacity: titleEntry,
            textShadow: `0 0 80px ${theme.primary}66`,
            lineHeight: 1.05,
          }}
        >
          {category}
        </div>

        {/* Subtitle line */}
        <div
          style={{
            fontFamily: theme.fontFamily,
            fontSize: 34,
            fontWeight: 400,
            color: theme.textMuted,
            letterSpacing: 8,
            textTransform: "uppercase" as const,
            transform: `translateY(${interpolate(subtitleEntry, [0, 1], [40, 0])}px)`,
            opacity: subtitleEntry,
          }}
        >
          QUIZ CHALLENGE
        </div>

        {/* Decorative line */}
        <div
          style={{
            width: interpolate(titleEntry, [0, 1], [0, 400]),
            height: 3,
            background: theme.progressGradient,
            borderRadius: 999,
            boxShadow: `0 0 20px ${theme.primary}88`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
