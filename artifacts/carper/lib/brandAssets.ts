import { ImageSourcePropType } from "react-native";

/**
 * Brand artwork for the "Nuestras Marcas" credibility wall. The catalog is
 * mostly "SIN MARCA", so logos are a trust showcase (not per-product badges).
 * RN/Metro needs static literal require paths.
 */

export interface BrandLogo {
  name: string;
  logo: ImageSourcePropType;
}

/** Curated, recognizable brands Carper carries. */
export const BRAND_LOGOS: BrandLogo[] = [
  { name: "Bosch", logo: require("@/assets/brands/logos/bosch.png") },
  { name: "Valeo", logo: require("@/assets/brands/logos/valeo.png") },
  { name: "Delphi", logo: require("@/assets/brands/logos/delphi.jpeg") },
  { name: "Gates", logo: require("@/assets/brands/logos/gates.jpeg") },
  { name: "Hella", logo: require("@/assets/brands/logos/hella.jpeg") },
  { name: "Osram", logo: require("@/assets/brands/logos/osram.jpeg") },
  { name: "Philips", logo: require("@/assets/brands/logos/philips.jpeg") },
  { name: "Mahle", logo: require("@/assets/brands/logos/mahle.jpeg") },
  { name: "NTN", logo: require("@/assets/brands/logos/ntn.jpeg") },
  { name: "LUK", logo: require("@/assets/brands/logos/luk.jpeg") },
  { name: "BorgWarner", logo: require("@/assets/brands/logos/borgwarner.jpeg") },
  { name: "WAI", logo: require("@/assets/brands/logos/wai.jpeg") },
  { name: "Beru", logo: require("@/assets/brands/logos/beru.jpeg") },
  { name: "VDO", logo: require("@/assets/brands/logos/vdo.png") },
  { name: "Lucas", logo: require("@/assets/brands/logos/lucas.jpeg") },
  { name: "Moresa", logo: require("@/assets/brands/logos/moresa.jpeg") },
  { name: "Fritec", logo: require("@/assets/brands/logos/fritec.jpeg") },
  { name: "Remsa", logo: require("@/assets/brands/logos/remsa.jpeg") },
  { name: "Clevite", logo: require("@/assets/brands/logos/clevite.jpeg") },
  { name: "Carter", logo: require("@/assets/brands/logos/carter.jpeg") },
  { name: "Fiamm", logo: require("@/assets/brands/logos/fiamm.jpeg") },
  { name: "Walbro", logo: require("@/assets/brands/logos/walbro.png") },
  { name: "Airtex", logo: require("@/assets/brands/logos/airtex.png") },
  { name: "Delco Remy", logo: require("@/assets/brands/logos/delco-remy.png") },
  { name: "Permatex", logo: require("@/assets/brands/logos/permatex.jpeg") },
  { name: "Loctite", logo: require("@/assets/brands/logos/loctite.jpeg") },
  { name: "TF Victor", logo: require("@/assets/brands/logos/tf-victor.jpeg") },
  { name: "Novita", logo: require("@/assets/brands/logos/novita.jpeg") },
];

/** Hero banner for the brand section. */
export const NUESTRAS_MARCAS_BANNER: ImageSourcePropType = require("@/assets/brands/banners/nuestras-marcas.jpg");

/** Tappable supplier promos → full-text search results. */
export interface SupplierBanner {
  name: string;
  href: string;
  image: ImageSourcePropType;
}

export const SUPPLIER_BANNERS: SupplierBanner[] = [
  { name: "Injetech", href: "/resultados?q=injetech", image: require("@/assets/brands/banners/injetech.png") },
  { name: "TotalParts", href: "/resultados?q=totalparts", image: require("@/assets/brands/banners/totalparts.png") },
];
