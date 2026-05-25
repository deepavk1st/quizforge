import React from "react";
import { Composition } from "remotion";
import { QuizVideo } from "./QuizVideo";
import type { VideoInputProps, TimingSettings } from "./types";

export const FPS              = 30;
export const INTRO_FRAMES     = 90;   // 3 s
export const SUBSCRIBE_FRAMES = 180;  // 6 s

/* ── Per-question scene timing constants (in frames @ 30 fps) ── */
export const Q_TTS_START   = 5;   // frame when question TTS begins
export const OPTION_GAP    = 18;  // fallback gap between options (0.6 s) when no audio durations
export const TIMER_GAP     = 20;  // default frames between last option and timer start (0.67 s)
export const DING_OFFSET   = 15;  // frames after reveal before answer TTS (0.5 s)
export const ANSWER_BUFFER = 75;  // default frames to stay on revealed answer (2.5 s)
export const FADE_OUT      = 24;  // exit fade frames (0.8 s)

/**
 * Compute the total frame count for one question scene.
 * Pass a `timing` object to override the default inter-step gaps.
 */
export function questionSceneFrames(
  qTtsDur: number,
  optsDur: number[],
  aTtsDur: number,
  funnyDur: number,
  timerSec: number,
  timing?: TimingSettings,
): number {
  const optPause    = Math.round((timing?.pauseBetweenOptions ?? 0) * FPS);
  const timerGap    = Math.round((timing?.pauseBeforeTimer    ?? TIMER_GAP / FPS) * FPS);
  const ansBuffer   = Math.round((timing?.answerHold          ?? ANSWER_BUFFER / FPS) * FPS);
  const optsTotalFrames = optsDur.reduce((sum, d) => sum + Math.ceil(d * FPS) + optPause, 0);
  const timerStart  = Q_TTS_START + Math.ceil(qTtsDur * FPS) + optsTotalFrames + timerGap;
  const revealFrame = timerStart + Math.ceil(timerSec * FPS);
  const funnyStart  = revealFrame + DING_OFFSET + Math.ceil(aTtsDur * FPS);
  const exitStart   = funnyStart + Math.ceil(funnyDur * FPS) + ansBuffer;
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
      const timing   = props.timingSettings;
      const qCount   = props.questions.length || 1;
      let total = INTRO_FRAMES;
      for (let i = 0; i < qCount; i++) {
        const qDur     = props.audioDurations?.q?.[i] ?? 8;
        const optsDur  = props.audioDurations?.opts?.[i] ?? [2, 2, 2, 2];
        const aDur     = props.audioDurations?.a?.[i] ?? 4;
        const funnyDur = props.audioDurations?.funny?.[i] ?? 4;
        total += questionSceneFrames(qDur, optsDur, aDur, funnyDur, timerSec, timing);
      }
      total += SUBSCRIBE_FRAMES;
      return { durationInFrames: total, fps: FPS };
    }}
  />
);
