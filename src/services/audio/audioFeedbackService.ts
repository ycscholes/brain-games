import { resolveAudioAssetUrl, type AudioAssetId } from "../../config/remoteAssets";
import { readAppSettings, type AppSettings } from "../../utils/trainingStorage";
import Taro from "@tarojs/taro";

type AudioContext = ReturnType<typeof Taro.createInnerAudioContext>;
type SoundCue = "tap" | "correct" | "wrong" | "complete";

const TAP_THROTTLE_MS = 80;
const AMBIENT_VOLUME = 0.18;
const cueContexts = new Map<SoundCue, AudioContext>();
const urlPromises = new Map<AudioAssetId, Promise<string>>();
let ambientContext: AudioContext | null = null;
let ambientRequested = false;
let ambientRequestVersion = 0;
let lastTapAt = 0;

function getAudioUrl(assetId: AudioAssetId): Promise<string> {
  const cached = urlPromises.get(assetId);
  if (cached) return cached;

  const promise = resolveAudioAssetUrl(assetId).catch(() => "");
  urlPromises.set(assetId, promise);
  return promise;
}

function createContext(useWebAudioImplement: boolean): AudioContext {
  const context = Taro.createInnerAudioContext({ useWebAudioImplement });
  context.obeyMuteSwitch = true;
  context.onError(() => {
    // Audio is optional feedback and must never surface a playback error to the player.
  });
  return context;
}

function getCueContext(cue: SoundCue): AudioContext {
  const current = cueContexts.get(cue);
  if (current) return current;

  const context = createContext(true);
  cueContexts.set(cue, context);
  return context;
}

async function playCue(cue: SoundCue): Promise<void> {
  if (!readAppSettings().soundEnabled) return;

  const url = await getAudioUrl(cue);
  if (!url || !readAppSettings().soundEnabled) return;

  try {
    const context = getCueContext(cue);
    context.stop();
    context.src = url;
    context.play();
  } catch {
    // Some platform implementations reject a context before it has loaded. Silence is the fallback.
  }
}

export function playTap(): void {
  const now = Date.now();
  if (now - lastTapAt < TAP_THROTTLE_MS) return;
  lastTapAt = now;
  void playCue("tap");
}

export function playCorrect(): void {
  void playCue("correct");
}

export function playWrong(): void {
  void playCue("wrong");
}

export function playComplete(): void {
  void playCue("complete");
}

export async function startAmbient(): Promise<void> {
  ambientRequested = true;
  const requestVersion = ++ambientRequestVersion;
  if (!readAppSettings().musicEnabled) return;

  const url = await getAudioUrl("ambient");
  if (!url || !ambientRequested || requestVersion !== ambientRequestVersion || !readAppSettings().musicEnabled) {
    return;
  }

  try {
    const context = ambientContext || createContext(false);
    ambientContext = context;
    context.loop = true;
    context.volume = AMBIENT_VOLUME;
    context.src = url;
    context.play();
  } catch {
    // Ambient music is deliberately best-effort.
  }
}

export function stopAmbient(): void {
  ambientRequested = false;
  ambientRequestVersion += 1;
  try {
    ambientContext?.stop();
  } catch {
    // Ignore a stale native context.
  }
}

export function applyAudioSettings(settings: Pick<AppSettings, "musicEnabled">): void {
  if (!settings.musicEnabled) {
    stopAmbient();
  }
}

export function resetAudioFeedbackForTests(): void {
  stopAmbient();
  ambientContext?.destroy();
  ambientContext = null;
  cueContexts.forEach((context) => context.destroy());
  cueContexts.clear();
  urlPromises.clear();
  lastTapAt = 0;
}
