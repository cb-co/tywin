import { Archivo } from "next/font/google";

/* The Papel Moneda face. Archivo's width axis is the point: the expanded cut
   is the wide engraved-caps voice of a banknote legend and its denomination
   numerals, the normal cut is the body. One family, one numeral system. */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
