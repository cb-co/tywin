import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SAMPLE_RATE = 44100;
const OUT_DIR = join(process.cwd(), "public/sounds");

function writeWavFile(path, samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM format tag
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  writeFileSync(path, buffer);
}

/** Quick fade-in, hold, fade-out — avoids clicks at buffer edges. */
function envelope(t, duration, attack = 0.01, release = 0.08) {
  if (t < attack) return t / attack;
  const releaseStart = duration - release;
  if (t > releaseStart) return Math.max(0, (duration - t) / release);
  return 1;
}

function tone(freq, duration, wave = "sine") {
  const numSamples = Math.round(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const phase = 2 * Math.PI * freq * t;
    const raw =
      wave === "sine" ? Math.sin(phase) : Math.asin(Math.sin(phase)) * (2 / Math.PI); // triangle
    samples[i] = raw * envelope(t, duration) * 0.5;
  }
  return samples;
}

function concat(...buffers) {
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const b of buffers) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });

// Success: light two-note ascending chime.
const success = concat(tone(660, 0.09, "sine"), tone(880, 0.12, "sine"));

// Delete: a lower, distinct single tone — not the same shape as success.
const del = tone(320, 0.16, "triangle");

// Error: brief, low, calm — two short pulses, not alarming.
const errorPulse = tone(240, 0.07, "sine");
const gap = new Float32Array(Math.round(SAMPLE_RATE * 0.05));
const error = concat(errorPulse, gap, errorPulse);

writeWavFile(join(OUT_DIR, "success.wav"), success);
writeWavFile(join(OUT_DIR, "delete.wav"), del);
writeWavFile(join(OUT_DIR, "error.wav"), error);

console.log("Generated public/sounds/{success,delete,error}.wav");
