import { useEffect, useRef } from "react";
import { createTimerQueue } from "./timerQueue";

export function useTimerQueue() {
  const queueRef = useRef<ReturnType<typeof createTimerQueue> | null>(null);

  if (!queueRef.current) {
    queueRef.current = createTimerQueue();
  }

  const queue = queueRef.current;

  useEffect(() => {
    return () => {
      queue.clear();
    };
  }, [queue]);

  return queue;
}
