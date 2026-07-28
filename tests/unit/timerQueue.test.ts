import { createTimerQueue } from "../../src/pages/bird-count/timerQueue";

test("clears every pending callback and forgets cleared timers", () => {
  jest.useFakeTimers();
  const callback = jest.fn();
  const queue = createTimerQueue();
  queue.schedule(callback, 100);
  queue.schedule(callback, 200);
  queue.clear();
  jest.advanceTimersByTime(200);
  expect(callback).not.toHaveBeenCalled();
  expect(queue.pendingCount()).toBe(0);
  jest.useRealTimers();
});
