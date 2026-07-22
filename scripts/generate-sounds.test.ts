import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const SOUND_FILES = ["success.wav", "delete.wav", "error.wav"];

for (const file of SOUND_FILES) {
  test(`public/sounds/${file} is a valid 44.1kHz mono 16-bit PCM WAV file`, () => {
    const path = join(process.cwd(), "public/sounds", file);
    expect(existsSync(path)).toBe(true);
    const buffer = readFileSync(path);
    expect(buffer.length).toBeGreaterThan(44);
    expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
    expect(buffer.toString("ascii", 8, 12)).toBe("WAVE");
    expect(buffer.readUInt16LE(20)).toBe(1); // PCM format tag
    expect(buffer.readUInt16LE(22)).toBe(1); // mono
    expect(buffer.readUInt32LE(24)).toBe(44100); // sample rate
    expect(buffer.readUInt16LE(34)).toBe(16); // bits per sample
  });

  /* The two audible failure modes a header check can't see: a buffer that
     doesn't end at silence pops on playback, and a silent buffer means the
     synthesis produced nothing at all. */
  test(`public/sounds/${file} rings out to silence without clipping`, () => {
    const buffer = readFileSync(join(process.cwd(), "public/sounds", file));
    const samples: number[] = [];
    for (let i = 44; i + 1 < buffer.length; i += 2) {
      samples.push(buffer.readInt16LE(i) / 32767);
    }

    const peak = Math.max(...samples.map(Math.abs));
    expect(peak).toBeGreaterThan(0.1); // not silence
    expect(peak).toBeLessThanOrEqual(1); // not clipped

    // Starts and ends at rest, so playback has no edge click either side.
    expect(Math.abs(samples[0])).toBeLessThan(0.01);
    expect(Math.abs(samples[samples.length - 1])).toBeLessThan(0.01);
  });
}

test("public/sounds/success.wav rings long enough to resolve, not chop", () => {
  // The success cue is a two-note rising gesture (E5 → B5); the second note
  // needs real time to ring out or the whole thing reads as cut off rather
  // than finished. 1s is comfortably past the ~0.83s the too-fast version
  // used to run for.
  const buffer = readFileSync(join(process.cwd(), "public/sounds", "success.wav"));
  const numSamples = (buffer.length - 44) / 2;
  const durationMs = (numSamples / 44100) * 1000;
  expect(durationMs).toBeGreaterThan(1000);
});
