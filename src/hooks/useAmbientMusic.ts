import { useDidHide, useDidShow } from "@tarojs/taro";
import { useEffect, useRef } from "react";
import { startAmbient, stopAmbient } from "../services/audio/audioFeedbackService";

export function useAmbientMusic(enabled: boolean) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (enabled) {
      void startAmbient();
    } else {
      stopAmbient();
    }

    return () => {
      stopAmbient();
    };
  }, [enabled]);

  useDidShow(() => {
    if (enabledRef.current) {
      void startAmbient();
    }
  });

  useDidHide(() => {
    stopAmbient();
  });
}
