export interface Question {
  id: number;
  category: string;
  subcategory: string;
  questionText: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correctOption: 1 | 2 | 3 | 4;
  difficulty: "easy" | "medium" | "hard";
  imageUrl?: string;
  audioUrl?: string;
  tags?: string[];
  explanation?: string;
}

export type ThemeName = "neon" | "sunset" | "ocean" | "forest" | "galaxy" | "candy" | "fire" | "retro";
export type BackgroundStyle = "particles" | "geometric" | "waves" | "matrix";
export type MusicTrack = "none" | "upbeat" | "chill" | "dramatic" | "energetic" | "lofi";

export interface VideoInputProps {
  questions: Question[];
  theme: ThemeName;
  questionTime: number;        // timer countdown seconds (thinking time per question)
  revealAnswer: boolean;
  category: string;
  subcategory: string;
  title?: string;
  audioFiles?: Record<string, string>;
  /** Per-track TTS durations in seconds — supplied by the API render worker */
  audioDurations?: {
    q: number[];         // question read-out duration per question
    opts: number[][];    // per-option read-out durations per question [[A,B,C,D], ...]
    a: number[];         // answer reveal narration duration per question
    funny: number[];     // funny feedback duration per question
    intro?: number;
    outro?: number;
  };
  backgroundStyle?: BackgroundStyle;
  music?: MusicTrack;
  apiBase?: string;
}
