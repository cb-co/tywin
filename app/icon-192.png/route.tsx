import { renderAppIcon } from "@/lib/pwa/icon";

export const dynamic = "force-static";

export function GET() {
  return renderAppIcon({ size: 192 });
}
