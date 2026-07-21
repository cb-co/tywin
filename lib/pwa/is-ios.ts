export function isIosUserAgent(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}
