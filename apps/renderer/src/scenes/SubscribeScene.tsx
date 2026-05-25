import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ThemeConfig } from "../themes";
import type { BackgroundStyle } from "../types";
import { BackgroundEffects } from "../components/BackgroundEffects";

interface Props {
  theme: ThemeConfig;
  totalQuestions: number;
  audioFiles?: Record<string, string>;
  apiBase?: string;
  backgroundStyle?: BackgroundStyle;
}

export const SubscribeScene: React.FC<Props> = ({
  theme,
  totalQuestions,
  audioFiles = {},
  apiBase = "http://localhost:4001",
  backgroundStyle = "particles",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ─── entry springs ─── */
  const scoreIn = spring({ frame: frame - 5,  fps, config: { damping: 18, stiffness: 160 } });
  const ctaIn   = spring({ frame: frame - 25, fps, config: { damping: 22, stiffness: 140 } });
  const bellIn  = spring({ frame: frame - 45, fps, config: { damping: 16, stiffness: 120 } });
  const btnIn   = spring({ frame: frame - 65, fps, config: { damping: 20, stiffness: 150 } });

  /* ─── bell bounce ─── */
  const bellBounce = Math.sin(frame * 0.28) * 18 * Math.max(0, bellIn);

  /* ─── pulse ring ─── */
  const ringScale  = 1 + Math.sin(frame * 0.15) * 0.12;
  const ringOpacity = 0.25 + Math.sin(frame * 0.15) * 0.12;

  /* ─── "SUBSCRIBE" letter stagger ─── */
  const letters = "SUBSCRIBE".split("");

  return (
    <AbsoluteFill style={{ background: theme.background }}>
      <BackgroundEffects theme={theme} frame={frame} style={backgroundStyle} />

      {/* Outro narration */}
      {audioFiles.outro && (
        <Audio src={`${apiBase}${audioFiles.outro}`} volume={1} />
      )}

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        {/* Score / well done line */}
        <div
          style={{
            opacity: scoreIn,
            transform: `translateY(${interpolate(scoreIn, [0, 1], [50, 0])}px)`,
            fontFamily: theme.fontFamily,
            fontSize: 36,
            fontWeight: 700,
            color: theme.textMuted,
            letterSpacing: 6,
            textTransform: "uppercase" as const,
            marginBottom: 28,
          }}
        >
          You answered {totalQuestions} question{totalQuestions !== 1 ? "s" : ""}!
        </div>

        {/* CTA headline */}
        <div
          style={{
            opacity: ctaIn,
            transform: `translateY(${interpolate(ctaIn, [0, 1], [40, 0])}px)`,
            fontFamily: theme.fontFamily,
            fontSize: 58,
            fontWeight: 900,
            color: theme.text,
            letterSpacing: -1,
            textAlign: "center" as const,
            textShadow: `0 0 60px ${theme.primary}88`,
            marginBottom: 48,
          }}
        >
          Enjoyed the quiz?
        </div>

        {/* Bell icon with pulse rings */}
        <div
          style={{
            position: "relative",
            width: 160,
            height: 160,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          {/* Pulse ring */}
          <div
            style={{
              position: "absolute",
              width: 160,
              height: 160,
              borderRadius: "50%",
              border: `3px solid ${theme.primary}`,
              transform: `scale(${ringScale})`,
              opacity: ringOpacity * bellIn,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 160,
              height: 160,
              borderRadius: "50%",
              border: `2px solid ${theme.accent}`,
              transform: `scale(${ringScale * 1.35})`,
              opacity: ringOpacity * 0.55 * bellIn,
            }}
          />
          {/* Bell */}
          <div
            style={{
              fontSize: 90,
              transform: `rotate(${bellBounce}deg) scale(${bellIn})`,
              filter: `drop-shadow(0 0 24px ${theme.primary})`,
              lineHeight: 1,
            }}
          >
            🔔
          </div>
        </div>

        {/* SUBSCRIBE letters */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 40,
          }}
        >
          {letters.map((letter, i) => {
            const letterSpring = spring({
              frame: frame - 50 - i * 5,
              fps,
              config: { damping: 18, stiffness: 200 },
            });
            return (
              <div
                key={i}
                style={{
                  fontFamily: theme.fontFamily,
                  fontSize: 80,
                  fontWeight: 900,
                  color: "#fff",
                  textShadow: `0 0 30px ${theme.primary}, 0 0 60px ${theme.accent}88`,
                  opacity: letterSpring,
                  transform: `scale(${letterSpring}) translateY(${interpolate(letterSpring, [0, 1], [40, 0])}px)`,
                  letterSpacing: 0,
                }}
              >
                {letter}
              </div>
            );
          })}
        </div>

        {/* Bell icon CTA */}
        <div
          style={{
            opacity: btnIn,
            transform: `scale(${btnIn})`,
            background: theme.badgeGradient,
            borderRadius: 999,
            padding: "18px 52px",
            fontFamily: theme.fontFamily,
            fontSize: 28,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: 2,
            boxShadow: `0 0 60px ${theme.primary}55, 0 0 120px ${theme.accent}33`,
            textAlign: "center" as const,
            marginBottom: 24,
          }}
        >
          🔔 Hit the Bell so you never miss a quiz!
        </div>

        {/* Like · Comment · Share row */}
        <div
          style={{
            opacity: btnIn,
            display: "flex",
            gap: 32,
            marginTop: 12,
          }}
        >
          {["👍 LIKE", "💬 COMMENT", "🔗 SHARE"].map((item) => (
            <div
              key={item}
              style={{
                fontFamily: theme.fontFamily,
                fontSize: 22,
                fontWeight: 700,
                color: theme.textMuted,
                letterSpacing: 4,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
