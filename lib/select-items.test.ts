import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/* Base UI's `<Select.Value>` renders the RAW value unless the root is given
 * an `items` map. Miss it and the trigger shows a UUID once closed, which is
 * how "e6e7c308-ef6e-4629-..." ended up in the quick-add form. The mistake is
 * invisible in review and only shows on a value whose label differs, so it is
 * pinned here rather than left to catch by eye. */

/** Find each `<Select ...>` opening tag, tolerating `>` inside `{...}` props
 *  (arrow functions such as `onValueChange={(v) => set(v)}`). */
function selectTags(src: string): string[] {
  const tags: string[] = [];
  let i = 0;
  while ((i = src.indexOf("<Select", i)) !== -1) {
    if (!" \n\t>".includes(src[i + 7])) {
      i += 7; // <SelectTrigger, <SelectItem, etc.
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && src[j - 1] !== "=") break;
    }
    tags.push(src.slice(i, j + 1));
    i = j + 1;
  }
  return tags;
}

/** Every .tsx under a directory. A plain walk rather than `fs.globSync`,
 *  which exists at runtime here but is not declared by @types/node 20. */
function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

test("every Select that renders a SelectValue declares items", () => {
  const files = [...tsxFiles("components"), ...tsxFiles("app")].filter(
    (f) => !f.endsWith("select.tsx"),
  );
  expect(files.length).toBeGreaterThan(0);

  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    if (!src.includes("<SelectValue")) continue;
    for (const tag of selectTags(src)) {
      const after = src.slice(src.indexOf(tag) + tag.length);
      // Only roots that actually surface a value need the map.
      if (!after.slice(0, 400).includes("<SelectValue")) continue;
      if (!tag.includes("items=")) {
        offenders.push(`${file}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`);
      }
    }
  }

  expect(offenders).toEqual([]);
});
