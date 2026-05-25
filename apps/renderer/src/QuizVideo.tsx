import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import type { VideoInputProps } from "./types";
import { THEMES } from "./themes";
import { IntroScene } from "./scenes/IntroScene";
import { QuestionScene } from "./scenes/QuestionScene";
import { SubscribeScene } from "./scenes/SubscribeScene";
import { INTRO_FRAMES, SUBSCRIBE_FRAMES, questionSceneFrames } from "./Root";

export const QuizVideo: React.FC<VideoInputProps> = ({
  questions,
  theme = "neon",
  questionTime = 15,
  revealAnswer = true,
  category,
  subcategory,
  audioFiles = {},
  audioDurations,
  backgroundStyle = "particles",
  music = "none",
  apiBase = "http://localhost:4001",
}) => {
  const themeConfig = THEMES[theme] ?? THEMES.neon;
  const musicUrl = music !== "none" ? `${apiBase}/music/${music}.mp3` : null;

  /* Compute per-question scene frame counts using real audio durations */
  let cursor = INTRO_FRAMES;
  const questionSequences = questions.map((q, i) => {
    const qDur     = audioDurations?.q?.[i] ?? 8;
    const optsDur  = audioDurations?.opts?.[i] ?? [2, 2, 2, 2];
    const aDur     = audioDurations?.a?.[i] ?? 4;
    const funnyDur = audioDurations?.funny?.[i] ?? 4;
    const frames   = questionSceneFrames(qDur, optsDur, aDur, funnyDur, questionTime);
    const from     = cursor;
    cursor += frames;
    return { q, i, from, frames, qTtsDuration: qDur, optDurations: optsDur, aTtsDuration: aDur, funnyDuration: funnyDur };
  });

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Background music – full video duration, low volume */}
      {musicUrl && <Audio src={musicUrl} volume={0.18} loop />}

      {/* Intro */}
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <IntroScene
          theme={themeConfig}
          category={category}
          subcategory={subcategory}
          audioFiles={audioFiles}
          apiBase={apiBase}
          backgroundStyle={backgroundStyle}
        />
      </Sequence>

      {/* Questions */}
      {questionSequences.map(({ q, i, from, frames, qTtsDuration, optDurations, aTtsDuration, funnyDuration }) => (
        <Sequence key={q.id} from={from} durationInFrames={frames}>
          <QuestionScene
            question={q}
            questionIndex={i}
            totalQuestions={questions.length}
            theme={themeConfig}
            timerSeconds={questionTime}
            qTtsDuration={qTtsDuration}
            optDurations={optDurations}
            aTtsDuration={aTtsDuration}
            funnyDuration={funnyDuration}
            revealAnswer={revealAnswer}
            audioFiles={audioFiles}
            apiBase={apiBase}
            backgroundStyle={backgroundStyle}
          />
        </Sequence>
      ))}

      {/* Subscribe CTA */}
      <Sequence from={cursor} durationInFrames={SUBSCRIBE_FRAMES}>
        <SubscribeScene
          theme={themeConfig}
          totalQuestions={questions.length}
          audioFiles={audioFiles}
          apiBase={apiBase}
          backgroundStyle={backgroundStyle}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

