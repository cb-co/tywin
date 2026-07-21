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

/* A struck-instrument voice: a few partials that each fade at their own rate,
 * fastest at the top.
 *
 * This is most of the difference between "elegant" and "robotic". A bare sine
 * held at constant amplitude and then cut off is a beep — nothing physical
 * sounds like that. Real bells, marimbas and glass lose their upper partials
 * within the first fraction of a second and let the fundamental ring on, which
 * is what the ear reads as warmth.
 *
 * The ratios sit a hair above whole numbers on purpose: perfectly harmonic
 * partials sound synthetic, while a few cents of stretch gives the slow beating
 * real struck bars have. */
const VOICE = [
  { ratio: 1, gain: 1, decay: 1 },
  { ratio: 2.01, gain: 0.28, decay: 1.7 },
  { ratio: 3.01, gain: 0.12, decay: 2.6 },
  { ratio: 4.02, gain: 0.05, decay: 3.6 },
];

const VOICE_GAIN = VOICE.reduce((sum, p) => sum + p.gain, 0);

/** Attack short enough to still read as "struck", shaped as a raised cosine
 *  rather than a linear ramp so it starts from true silence with no click. */
const ATTACK = 0.006;
/** Final ramp guaranteeing the buffer ends at exact zero. */
const TAIL = 0.03;

function note(freq, { duration, decay = 5.5, amplitude = 0.5, delay = 0 }) {
  const total = Math.round(SAMPLE_RATE * (duration + delay));
  const start = Math.round(SAMPLE_RATE * delay);
  const out = new Float32Array(total);

  for (let i = start; i < total; i++) {
    const t = (i - start) / SAMPLE_RATE;

    let v = 0;
    for (const p of VOICE) {
      v +=
        p.gain *
        Math.sin(2 * Math.PI * freq * p.ratio * t) *
        Math.exp(-decay * p.decay * t);
    }
    v /= VOICE_GAIN;

    const attack = t < ATTACK ? 0.5 * (1 - Math.cos((Math.PI * t) / ATTACK)) : 1;
    const tail = Math.max(0, Math.min(1, (duration - t) / TAIL));
    out[i] = v * attack * tail * amplitude;
  }

  return out;
}

/** Layers notes over one shared timeline; each note carries its own `delay`. */
function mix(...layers) {
  const total = Math.max(...layers.map((l) => l.length));
  const out = new Float32Array(total);
  for (const layer of layers) {
    for (let i = 0; i < layer.length; i++) out[i] += layer[i];
  }
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });

/* Success: E5 → B5, a rising perfect fifth. The second note lands while the
   first is still ringing, so it reads as one gesture rather than two beeps. */
const success = mix(
  note(659.25, { duration: 0.75, decay: 5.5, amplitude: 0.5 }),
  note(987.77, { duration: 0.75, decay: 5.0, amplitude: 0.42, delay: 0.085 }),
);

/* Delete: A4 → E4, the same interval inverted. Falling and a register lower,
   so it's unmistakably not the success cue without being harsh about it. */
const del = mix(
  note(440.0, { duration: 0.7, decay: 6.0, amplitude: 0.5 }),
  note(329.63, { duration: 0.7, decay: 5.5, amplitude: 0.45, delay: 0.075 }),
);

/* Error: E4 → D4, a gentle step down, quieter and shorter-lived than the
   others. A whole tone rather than a semitone — enough to register as "no"
   without the dissonant edge that makes error sounds unpleasant to hear twice. */
const error = mix(
  note(329.63, { duration: 0.55, decay: 7.5, amplitude: 0.42 }),
  note(293.66, { duration: 0.55, decay: 7.0, amplitude: 0.42, delay: 0.13 }),
);

writeWavFile(join(OUT_DIR, "success.wav"), success);
writeWavFile(join(OUT_DIR, "delete.wav"), del);
writeWavFile(join(OUT_DIR, "error.wav"), error);

console.log("Generated public/sounds/{success,delete,error}.wav");
