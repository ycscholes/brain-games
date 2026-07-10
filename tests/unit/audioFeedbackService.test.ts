const mockResolveAudioAssetUrl = jest.fn();
const mockReadAppSettings = jest.fn();
const mockContexts: Array<Record<string, jest.Mock | string | boolean | number>> = [];

jest.mock("../../src/config/remoteAssets", () => ({
  resolveAudioAssetUrl: mockResolveAudioAssetUrl,
}));

jest.mock("../../src/utils/trainingStorage", () => ({
  readAppSettings: mockReadAppSettings,
}));

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    createInnerAudioContext: jest.fn((options) => {
      const context = {
        options,
        src: "",
        loop: false,
        volume: 1,
        obeyMuteSwitch: false,
        play: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn(),
        onError: jest.fn(),
      };
      mockContexts.push(context);
      return context;
    }),
  },
}));

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("audioFeedbackService", () => {
  beforeEach(() => {
    jest.resetModules();
    mockContexts.length = 0;
    mockResolveAudioAssetUrl.mockReset();
    mockResolveAudioAssetUrl.mockImplementation((assetId: string) => Promise.resolve(`https://audio.example/${assetId}.m4a`));
    mockReadAppSettings.mockReturnValue({ soundEnabled: true, musicEnabled: true });
    jest.useFakeTimers().setSystemTime(new Date("2026-07-11T00:00:00.000Z"));
  });

  afterEach(async () => {
    const { resetAudioFeedbackForTests } = await import("../../src/services/audio/audioFeedbackService");
    resetAudioFeedbackForTests();
    jest.useRealTimers();
  });

  test("plays enabled tap feedback once within the throttle window", async () => {
    const { playTap } = await import("../../src/services/audio/audioFeedbackService");

    playTap();
    playTap();
    await flushPromises();

    expect(mockResolveAudioAssetUrl).toHaveBeenCalledWith("tap");
    expect(mockContexts).toHaveLength(1);
    expect(mockContexts[0].options).toEqual({ useWebAudioImplement: true });
    expect(mockContexts[0].play).toHaveBeenCalledTimes(1);
  });

  test("does not resolve or create a cue context when sound is disabled", async () => {
    mockReadAppSettings.mockReturnValue({ soundEnabled: false, musicEnabled: true });
    const { playCorrect } = await import("../../src/services/audio/audioFeedbackService");

    playCorrect();
    await flushPromises();

    expect(mockResolveAudioAssetUrl).not.toHaveBeenCalled();
    expect(mockContexts).toHaveLength(0);
  });

  test("starts and stops ambient music with an independent non-WebAudio context", async () => {
    const { startAmbient, stopAmbient } = await import("../../src/services/audio/audioFeedbackService");

    await startAmbient();
    expect(mockResolveAudioAssetUrl).toHaveBeenCalledWith("ambient");
    expect(mockContexts[0].options).toEqual({ useWebAudioImplement: false });
    expect(mockContexts[0].loop).toBe(true);
    expect(mockContexts[0].volume).toBe(0.18);
    expect(mockContexts[0].play).toHaveBeenCalledTimes(1);

    stopAmbient();
    expect(mockContexts[0].stop).toHaveBeenCalledTimes(1);
  });

  test("silently drops ambient playback when URL resolution fails or music is disabled", async () => {
    mockResolveAudioAssetUrl.mockResolvedValueOnce("");
    const { startAmbient } = await import("../../src/services/audio/audioFeedbackService");

    await startAmbient();
    expect(mockContexts).toHaveLength(0);
  });

  test("stops ambient music immediately when music is disabled from settings", async () => {
    const { applyAudioSettings, startAmbient } = await import("../../src/services/audio/audioFeedbackService");

    await startAmbient();
    applyAudioSettings({ musicEnabled: false });

    expect(mockContexts[0].stop).toHaveBeenCalledTimes(1);
  });
});
