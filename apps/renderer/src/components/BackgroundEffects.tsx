import React from "react";
import type { ThemeConfig } from "../themes";
import type { BackgroundStyle } from "../types";

interface Props {
  theme: ThemeConfig;
  frame: number;
  style?: BackgroundStyle;
}

const PC = 26;

export const BackgroundEffects: React.FC<Props> = ({ theme, frame, style = "particles" }) => {
  const particles = Array.from({ length: PC }, (_, i) => ({
    x:       (i * 137.508) % 100,
    y:       (i * 97.31)   % 100,
    size:    3 + (i % 5) * 3,
    speed:   0.14 + (i % 7) * 0.09,
    opacity: 0.18 + (i % 4) * 0.12,
  }));

  /* ── Shared: grid + orbs ─── */
  const SharedBase = (
    <>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(${theme.gridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${theme.gridColor} 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
      }} />
      <div style={{
        position: "absolute", width: 800, height: 800, borderRadius: "50%",
        background: `radial-gradient(circle, ${theme.primary}28 0%, transparent 68%)`,
        left: -250, top: -250,
        transform: `translate(${Math.sin(frame * 0.018) * 45}px,${Math.cos(frame * 0.013) * 35}px)`,
      }} />
      <div style={{
        position: "absolute", width: 700, height: 700, borderRadius: "50%",
        background: `radial-gradient(circle, ${theme.accent}22 0%, transparent 68%)`,
        right: -200, bottom: -200,
        transform: `translate(${Math.cos(frame * 0.015) * 40}px,${Math.sin(frame * 0.02) * 30}px)`,
      }} />
      <div style={{
        position: "absolute", width: 500, height: 500, borderRadius: "50%",
        background: `radial-gradient(circle, ${theme.secondary}1a 0%, transparent 70%)`,
        left: "40%", top: "20%",
        transform: `translate(${Math.sin(frame * 0.011) * 30}px,${Math.cos(frame * 0.017) * 25}px)`,
      }} />
    </>
  );

  if (style === "particles") {
    return (
      <>
        {SharedBase}
        {particles.map((p, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${((p.y + frame * p.speed * 0.04) % 110) - 5}%`,
            width: p.size, height: p.size, borderRadius: "50%",
            background: theme.particleColor,
            boxShadow: `0 0 ${p.size * 4}px ${theme.particleColor}`,
            opacity: p.opacity,
          }} />
        ))}
      </>
    );
  }

  if (style === "geometric") {
    const shapes = Array.from({ length: 14 }, (_, i) => ({
      x:     (i * 173) % 100,
      y:     (i * 89)  % 100,
      rot:   (frame * (0.3 + (i % 5) * 0.2) + i * 37) % 360,
      size:  20 + (i % 4) * 22,
      sides: (i % 3 === 0) ? 3 : (i % 3 === 1) ? 4 : 6,
      opacity: 0.08 + (i % 3) * 0.07,
    }));
    return (
      <>
        {SharedBase}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
          {shapes.map((s, i) => {
            const cx = s.x * 19.2, cy = s.y * 10.8;
            const pts = Array.from({ length: s.sides }, (_, j) => {
              const a = (j / s.sides) * Math.PI * 2 - Math.PI / 2 + (s.rot * Math.PI / 180);
              return `${cx + Math.cos(a) * s.size},${cy + Math.sin(a) * s.size}`;
            }).join(" ");
            return (
              <polygon key={i} points={pts}
                fill="none" stroke={theme.primary}
                strokeWidth={1.5} opacity={s.opacity}
              />
            );
          })}
        </svg>
      </>
    );
  }

  if (style === "waves") {
    const waveCount = 5;
    return (
      <>
        {SharedBase}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
          {Array.from({ length: waveCount }, (_, wi) => {
            const amp    = 40 + wi * 18;
            const freq   = 0.008 + wi * 0.003;
            const yBase  = 180 + wi * 140;
            const phase  = frame * (0.04 + wi * 0.015);
            const pts = Array.from({ length: 193 }, (_, xi) => {
              const x = xi * 10;
              const y = yBase + Math.sin(x * freq + phase) * amp;
              return `${x},${y}`;
            }).join(" ");
            return (
              <polyline key={wi} points={pts}
                fill="none" stroke={theme.primary}
                strokeWidth={1.5 + wi * 0.4}
                opacity={0.12 + wi * 0.06}
              />
            );
          })}
        </svg>
        {particles.slice(0, 12).map((p, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${p.x}%`, top: `${((p.y + frame * p.speed * 0.03) % 110) - 5}%`,
            width: p.size * 0.6, height: p.size * 0.6, borderRadius: "50%",
            background: theme.particleColor,
            boxShadow: `0 0 ${p.size * 5}px ${theme.particleColor}`,
            opacity: p.opacity * 0.9,
          }} />
        ))}
      </>
    );
  }

  /* matrix */
  const cols = Array.from({ length: 22 }, (_, i) => ({
    x:     (i * 89) % 100,
    speed: 1.2 + (i % 5) * 0.8,
    len:   6 + (i % 6),
  }));
  return (
    <>
      {SharedBase}
      {cols.map((c, ci) =>
        Array.from({ length: c.len }, (_, di) => {
          const yPos = ((c.speed * frame * 0.15 + di * 70) % 1150) - 50;
          const alpha = 1 - di / c.len;
          return (
            <div key={`${ci}-${di}`} style={{
              position: "absolute",
              left: `${c.x}%`, top: yPos,
              width: 14, height: 20,
              color: di === 0 ? "#fff" : theme.primary,
              fontFamily: "monospace", fontSize: 13, fontWeight: 700,
              opacity: alpha * (0.15 + (ci % 3) * 0.1),
              textShadow: `0 0 8px ${theme.primary}`,
            }}>
              {String.fromCharCode(0x30A0 + ((frame * 3 + ci * 7 + di * 13) % 96))}
            </div>
          );
        })
      )}
    </>
  );
};
