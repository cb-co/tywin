/** `QNA <yyyy>-<mm> <A|B>`: the serial printed on the Disponible note. A is
 *  the period that starts on the 1st to 15th, B the one starting on the 16th
 *  or later. Read from the period's own start, so an anchored quincena
 *  (5th and 20th) still splits into A and B. */
export function periodSerial(start: string): string {
  const [y, m, d] = start.split("-");
  return `QNA ${y}-${m} ${Number(d) <= 15 ? "A" : "B"}`;
}
