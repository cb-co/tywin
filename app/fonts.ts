import { Archivo } from "next/font/google";

/* The one Cigua face (Papel Moneda). The width axis is the point: the
   expanded cut is the engraved legend and denomination numerals, the normal
   cut is body. One family, one numeral system. */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
