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
}
