import { useMemo } from "react";
import { readAppSettings } from "../utils/trainingStorage";
import {
  playComplete,
  playCorrect,
  playTap,
  playWrong,
} from "../services/audio/audioFeedbackService";

export function useAudioFeedback() {
  const pressClass = readAppSettings().reducedMotion ? "audio-pressable audio-pressable-static" : "audio-pressable";

  return useMemo(() => ({
    tap: playTap,
    correct: playCorrect,
    wrong: playWrong,
    complete: playComplete,
    pressClass,
  }), [pressClass]);
}
