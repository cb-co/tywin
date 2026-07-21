import { renderAppIcon } from "@/lib/pwa/icon";

export function GET() {
  return renderAppIcon({ size: 512, maskable: true });
}
