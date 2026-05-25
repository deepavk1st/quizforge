import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  Easing,
} from "remotion";
import type { ThemeConfig } from "../themes";
import type { Question, BackgroundStyle } from "../types";
import { BackgroundEffects } from "../components/BackgroundEffects";
import { ProgressBar } from "../components/ProgressBar";
import { TimerRing } from "../components/TimerRing";
import { AnswerOption } from "../components/AnswerOption";
import { Q_TTS_START, TIMER_GAP, DING_OFFSET, ANSWER_BUFFER, FADE_OUT } from "../Root";

interface Props {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  theme: ThemeConfig;
  /** Countdown timer seconds (thinking time) */
  timerSeconds: number;
  /** Question TTS audio duration in seconds */
  qTtsDuration: number;
  /** Per-option TTS durations in seconds [A, B, C, D] */
  optDurations: number[];
  /** Answer reveal TTS duration in seconds */
  aTtsDuration: number;
  /** Funny feedback TTS duration in seconds */
  funnyDuration: number;
  revealAnswer: boolean;
  audioFiles?: Record<string, string>;
  apiBase?: string;
  backgroundStyle?: BackgroundStyle;
}

const LABELS = ["A", "B", "C", "D"];
const OPTIONS_KEYS = ["option1", "option2", "option3", "option4"] as const;

export const QuestionScene: React.FC<Props> = ({
  question,
  questionIndex,
  totalQuestions,
  theme,
  timerSeconds,
  qTtsDuration,
  optDurations,
  aTtsDuration,
  funnyDuration,
  revealAnswer,
  audioFiles = {},
  apiBase = "http://localhost:4001",
  backgroundStyle = "particles",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── Frame markers ─────────────────────────────────────────────────────────
   *
   * STEP 1  [Q_TTS_START = 5]          Question is read aloud
   * STEP 2  [optEnterFrames[0..3]]     Each option slides in + is read aloud
   * STEP 3  [timerStart]               Timer countdown + tick sound begins
   * STEP 4  [revealFrame]              Timer hits 0 → ding, answer highlighted,
   *                                    "The correct answer is X!" narration
   * STEP 5  [funnyStart]               Funny feedback comment plays
   *         [exitStart → totalFrames]  Scene fades out
   */

  // Option enter frames — each starts immediately after the previous option's TTS finishes
  const optEnterFrames: number[] = [];
  let optCursor = Q_TTS_START + Math.ceil(qTtsDuration * fps);
  for (let i = 0; i < 4; i++) {
    optEnterFrames.push(optCursor);
    optCursor += Math.ceil((optDurations[i] ?? 2) * fps);
  }

  const timerStart  = optCursor + TIMER_GAP;
  const revealFrame = timerStart + Math.ceil(timerSeconds * fps);
  const funnyStart  = revealFrame + DING_OFFSET + Math.ceil(aTtsDuration * fps);
  const exitStart   = funnyStart + Math.ceil(funnyDuration * fps) + ANSWER_BUFFER;
  const totalFrames = exitStart + FADE_OUT;

  /* ── Entry animations ── */
  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 28, stiffness: 180 },
    durationInFrames: 30,
  });
  const contentY = interpolate(entrySpring, [0, 1], [60, 0]);

  const badgeSpring = spring({
    frame: frame - 4,
    fps,
    config: { damping: 14, stiffness: 320 },
  });

  /* ── Exit fade ── */
  const exitOpacity = interpolate(frame, [exitStart, totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.ease,
  });

  /* ── Timer progress (0 → 1 across countdown) ── */
  const timerProgress = interpolate(frame, [timerStart, revealFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Answer reveal ── */
  const showAnswer = revealAnswer && frame >= revealFrame;

  /* Build options — each gets the exact frame its TTS starts */
  const options = OPTIONS_KEYS.map((k, i) => ({
    label: LABELS[i],
    text: question[k] ?? "",
    isCorrect: showAnswer && question.correctOption === i + 1,
    isDimmed: showAnswer && question.correctOption !== i + 1,
    enterFrame: optEnterFrames[i],
  })).filter((o) => o.text);

  return (
    <AbsoluteFill style={{ background: theme.background, opacity: exitOpacity }}>
      <BackgroundEffects theme={theme} frame={frame} style={backgroundStyle} />

      {/* ── STEP 1: Question TTS ── */}
      {audioFiles[`q${questionIndex}`] && (
        <Sequence from={Q_TTS_START}>
          <Audio src={`${apiBase}${audioFiles[`q${questionIndex}`]}`} volume={1} />
        </Sequence>
      )}

      {/* ── STEP 2: Per-option TTS — each starts exactly when its option slides in ── */}
      {[0, 1, 2, 3].map((j) =>
        audioFiles[`q${questionIndex}opt${j}`] ? (
          <Sequence key={`opt${j}`} from={optEnterFrames[j]}>
            <Audio src={`${apiBase}${audioFiles[`q${questionIndex}opt${j}`]}`} volume={1} />
          </Sequence>
        ) : null
      )}

      {/* ── STEP 3: Tick sound loops for every second of countdown ── */}
      {audioFiles.tick && revealAnswer && timerStart < revealFrame && (
        <Sequence from={timerStart} durationInFrames={revealFrame - timerStart}>
          <Audio src={`${apiBase}${audioFiles.tick}`} volume={0.4} loop />
        </Sequence>
      )}

      {/* ── STEP 4: Ding + "The correct answer is X!" narration ── */}
      {revealAnswer && (
        <Sequence from={revealFrame}>
          {audioFiles.ding && (
            <Audio src={`${apiBase}${audioFiles.ding}`} volume={0.9} />
          )}
          {audioFiles[`a${questionIndex}`] && (
            <Sequence from={DING_OFFSET}>
              <Audio src={`${apiBase}${audioFiles[`a${questionIndex}`]}`} volume={1} />
            </Sequence>
          )}
        </Sequence>
      )}

      {/* ── STEP 5: Funny feedback after answer narration ── */}
      {audioFiles[`q${questionIndex}funny`] && revealAnswer && (
        <Sequence from={funnyStart}>
          <Audio src={`${apiBase}${audioFiles[`q${questionIndex}funny`]}`} volume={1} />
        </Sequence>
      )}

      {/* ── Top bar ── */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 110,
          display: "flex",
          alignItems: "center",
          padding: "0 64px",
          justifyContent: "space-between",
          borderBottom: `1px solid ${theme.primary}22`,
        }}
      >
        {/* Question number badge */}
        <div
          style={{
            transform: `scale(${badgeSpring})`,
            background: theme.badgeGradient,
            borderRadius: "50%",
            width: 76, height: 76,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 40px ${theme.primary}66`,
            fontFamily: theme.fontFamily,
            fontSize: 34, fontWeight: 900, color: "#fff",
          }}
        >
          {questionIndex + 1}
        </div>

        {/* Center label */}
        <div
          style={{
            fontFamily: theme.fontFamily,
            fontSize: 22, color: theme.textMuted,
            fontWeight: 600, letterSpacing: 4,
            textTransform: "uppercase" as const,
          }}
        >
          Question {questionIndex + 1} of {totalQuestions}
        </div>

        {/* Timer ring — fades in at timerStart */}
        <div
          style={{
            opacity: interpolate(frame, [timerStart - 10, timerStart], [0, 1], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            }),
          }}
        >
          <TimerRing
            progress={timerProgress}
            totalSeconds={timerSeconds}
            size={90}
            theme={theme}
          />
        </div>
      </div>

      {/* ── Main content ── */}
      <div
        style={{
          position: "absolute",
          top: 115, left: 0, right: 0, bottom: 14,
          display: "flex",
          transform: `translateY(${contentY}px)`,
          opacity: entrySpring,
        }}
      >
        {/* Left: image / decorative panel */}
        <div
          style={{
            width: 860,
            padding: "30px 40px 30px 64px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {question.imageUrl ? (
            <div
              style={{
                width: "100%", height: 620, borderRadius: 28,
                overflow: "hidden",
                boxShadow: `0 0 80px ${theme.primary}44`,
                border: `2px solid ${theme.primary}44`,
              }}
            >
              <Img
                src={question.imageUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : (
            <div
              style={{
                width: "100%", height: 620, borderRadius: 28,
                background: theme.surface,
                border: `2px solid ${theme.primary}22`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 180, opacity: 0.25,
              }}
            >
              ❓
            </div>
          )}
        </div>

        {/* Right: question text + options */}
        <div
          style={{
            flex: 1,
            padding: "30px 64px 30px 20px",
            display: "flex",
            flexDirection: "column" as const,
            justifyContent: "center",
            gap: 26,
          }}
        >
          {/* Difficulty chip */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center", gap: 8,
              background: theme.surface,
              border: `1px solid ${theme.primary}33`,
              borderRadius: 999, padding: "6px 18px",
              fontFamily: theme.fontFamily,
              fontSize: 18, fontWeight: 600,
              color: theme.textMuted, letterSpacing: 2,
              textTransform: "uppercase" as const, width: "fit-content",
            }}
          >
            {question.difficulty}
          </div>

          {/* Question text */}
          <div
            style={{
              fontFamily: theme.fontFamily,
              fontSize: 44, fontWeight: 800, color: theme.text,
              lineHeight: 1.28, letterSpacing: -0.5,
            }}
          >
            {question.questionText}
          </div>

          {/* Options — each slides in as it's read aloud */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
            {options.map((opt) => (
              <AnswerOption
                key={opt.label}
                label={opt.label}
                text={opt.text}
                isCorrect={opt.isCorrect}
                isDimmed={opt.isDimmed}
                theme={theme}
                enterFrame={opt.enterFrame}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Progress bar (fills while timer counts down) ── */}
      <ProgressBar
        progress={timerProgress}
        current={questionIndex}
        total={totalQuestions}
        theme={theme}
      />
    </AbsoluteFill>
  );
};
