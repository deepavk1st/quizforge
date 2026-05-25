import React from "react";
import { Composition } from "remotion";
import { QuizVideo } from "./QuizVideo";
import type { VideoInputProps } from "./types";

export const FPS              = 30;
export const INTRO_FRAMES     = 90;   // 3 s
export const SUBSCRIBE_FRAMES = 180;  // 6 s

/* ── Per-question scene timing constants (in frames @ 30 fps) ── */
export const Q_TTS_START   = 5;   // frame when question TTS begins
export const OPTION_GAP    = 18;  // fallback gap between options (0.6 s) when no audio durations
export const TIMER_GAP     = 20;  // frames between last option read and timer start (0.67 s)
export const DING_OFFSET   = 15;  // frames after reveal before answer TTS (0.5 s)
export const ANSWER_BUFFER = 75;  // frames to stay on revealed answer after funny TTS (2.5 s)
export const FADE_OUT      = 24;  // exit fade frames (0.8 s)

/**
 * Compute the total frame count for one question scene.
 * @param qTtsDur  - question TTS duration in seconds
 * @param optsDur  - per-option TTS durations in seconds [A, B, C, D]
 * @param aTtsDur  - answer reveal TTS duration in seconds
 * @param funnyDur - funny feedback TTS duration in seconds
 * @param timerSec - countdown timer seconds (thinking time)
 */
export function questionSceneFrames(
  qTtsDur: number,
  optsDur: number[],
  aTtsDur: number,
  funnyDur: number,
  timerSec: number,
): number {
  const optsTotalFrames = optsDur.reduce((sum, d) => sum + Math.ceil(d * FPS), 0);
  const timerStart  = Q_TTS_START + Math.ceil(qTtsDur * FPS) + optsTotalFrames + TIMER_GAP;
  const revealFrame = timerStart + Math.ceil(timerSec * FPS);
  const funnyStart  = revealFrame + DING_OFFSET + Math.ceil(aTtsDur * FPS);
  const exitStart   = funnyStart + Math.ceil(funnyDur * FPS) + ANSWER_BUFFER;
  return exitStart + FADE_OUT;
}

const defaultProps: VideoInputProps = {
  questions: [],
  theme: "neon",
  questionTime: 15,
  revealAnswer: true,
  category: "Science",
  subcategory: "Physics",
  title: "Quiz Challenge",
  backgroundStyle: "particles",
  music: "none",
  apiBase: "http://localhost:4001",
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="QuizVideo"
    component={QuizVideo}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => {
      const timerSec = props.questionTime ?? 15;
      const qCount   = props.questions.length || 1;
      let total = INTRO_FRAMES;
      for (let i = 0; i < qCount; i++) {
        const qDur    = props.audioDurations?.q?.[i] ?? 8;
        const optsDur = props.audioDurations?.opts?.[i] ?? [2, 2, 2, 2];
        const aDur    = props.audioDurations?.a?.[i] ?? 4;
        const funnyDur = props.audioDurations?.funny?.[i] ?? 4;
        total += questionSceneFrames(qDur, optsDur, aDur, funnyDur, timerSec);
      }
      total += SUBSCRIBE_FRAMES;
      return { durationInFrames: total, fps: FPS };
    }}
  />
);
