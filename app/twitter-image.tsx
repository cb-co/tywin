import { renderBrandOgImage, OG_IMAGE_SIZE } from "@/lib/og-image";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";
export const alt = "Cashly — Personal Finance";

export default function Image() {
  return renderBrandOgImage();
}
