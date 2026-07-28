export function createTimerQueue() {
  const timers = new Set<ReturnType<typeof setTimeout>>();

  return {
    schedule(callback: () => void, delay: number) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
      return timer;
    },
    clear() {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    },
    pendingCount() {
      return timers.size;
    },
  };
}
