import fs from "node:fs";
import path from "node:path";

const sampleRate = 44100;
const outputDirectory = path.resolve(import.meta.dirname, "..", "asset-backups", "cloudbase-audio", "v1", "source-wav");

function envelope(time, duration, attack = 0.008, release = 0.04) {
  if (time < attack) return time / attack;
  if (time > duration - release) return Math.max(0, (duration - time) / release);
  return 1;
}

function tone(duration, notes) {
  const frames = Math.floor(sampleRate * duration);
  const pcm = Buffer.alloc(frames * 2);

  for (let index = 0; index < frames; index += 1) {
    const time = index / sampleRate;
    const value = notes.reduce((sum, note) => {
      if (time < note.start || time > note.start + note.duration) return sum;
      const localTime = time - note.start;
      const frequency = note.frequency + (note.sweep || 0) * localTime;
      const harmonic = Math.sin(2 * Math.PI * frequency * localTime)
        + 0.22 * Math.sin(4 * Math.PI * frequency * localTime);
      return sum + harmonic * note.volume * envelope(localTime, note.duration);
    }, 0);
    pcm.writeInt16LE(Math.max(-1, Math.min(1, value)) * 32767, index * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const cues = {
  tap: [0.12, [{ start: 0, duration: 0.12, frequency: 620, sweep: 980, volume: 0.13 }]],
  correct: [0.28, [
    { start: 0, duration: 0.14, frequency: 523.25, volume: 0.16 },
    { start: 0.11, duration: 0.17, frequency: 659.25, volume: 0.16 },
  ]],
  wrong: [0.22, [{ start: 0, duration: 0.22, frequency: 220, sweep: -95, volume: 0.13 }]],
  complete: [0.56, [
    { start: 0, duration: 0.18, frequency: 523.25, volume: 0.15 },
    { start: 0.15, duration: 0.18, frequency: 659.25, volume: 0.15 },
    { start: 0.3, duration: 0.26, frequency: 783.99, volume: 0.16 },
  ]],
};

fs.mkdirSync(outputDirectory, { recursive: true });
for (const [name, [duration, notes]] of Object.entries(cues)) {
  fs.writeFileSync(path.join(outputDirectory, `${name}.wav`), tone(duration, notes));
}
