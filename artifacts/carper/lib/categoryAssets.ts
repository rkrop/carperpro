import { ImageSourcePropType } from "react-native";

/**
 * Local category artwork (line-art icons + photographic cards).
 * Never synced from the ERP. RN/Metro needs static literal require paths,
 * so everything is referenced explicitly below.
 */

const ICONS = {
  aceite: require("@/assets/icons/cat_aceite.png"),
  alternador: require("@/assets/icons/cat_alternador.png"),
  bobina: require("@/assets/icons/cat_bobina.png"),
  bujia: require("@/assets/icons/cat_bujia.png"),
  filtro: require("@/assets/icons/cat_filtro.png"),
  frenos: require("@/assets/icons/cat_frenos.png"),
  luz: require("@/assets/icons/cat_luz.png"),
  marcha: require("@/assets/icons/cat_marcha.png"),
  motor: require("@/assets/icons/cat_motor.png"),
  sensor: require("@/assets/icons/cat_sensor.png"),
  suspension: require("@/assets/icons/cat_suspension.png"),
  transmision: require("@/assets/icons/cat_transmision.png"),
} as const;

/**
 * Resolve a custom line-art icon for an Admintotal "línea" name. Order matters:
 * more specific keywords come first. Returns null when none matches so callers
 * can fall back to a MaterialCommunityIcons glyph.
 */
const ICON_BY_KEYWORD: [string, ImageSourcePropType][] = [
  ["marcha", ICONS.marcha],
  ["alternador", ICONS.alternador],
  ["acumulad", ICONS.alternador],
  ["carga", ICONS.alternador],
  ["encend", ICONS.bujia],
  ["buj", ICONS.bujia],
  ["bobina", ICONS.bobina],
  ["interruptor", ICONS.sensor],
  ["sensor", ICONS.sensor],
  ["fuel", ICONS.sensor],
  ["inyec", ICONS.sensor],
  ["electric", ICONS.bobina],
  ["ilumin", ICONS.luz],
  ["bulbo", ICONS.luz],
  ["faro", ICONS.luz],
  ["foco", ICONS.luz],
  ["filtro", ICONS.filtro],
  ["freno", ICONS.frenos],
  ["suspension", ICONS.suspension],
  ["transmision", ICONS.transmision],
  ["lubric", ICONS.aceite],
  ["aceite", ICONS.aceite],
  ["quimico", ICONS.aceite],
  ["valvula", ICONS.motor],
  ["motor", ICONS.motor],
];

export function categoryIconAsset(name: string): ImageSourcePropType | null {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const [kw, icon] of ICON_BY_KEYWORD) {
    if (n.includes(kw)) return icon;
  }
  return null;
}

/** A curated, photographic "shop by category" card. */
export interface FeaturedCategory {
  label: string;
  href: string;
  image: ImageSourcePropType;
}

/**
 * Hand-picked visual entry points for the Categorías screen. Each maps a
 * wide product photo to a real catalog destination (a category id, or a
 * full-text search where no single línea fits).
 */
export const FEATURED_CATEGORIES: FeaturedCategory[] = [
  { label: "Marchas y arranque", href: "/resultados?category=1545", image: require("@/assets/categories/arranque.jpg") },
  { label: "Sistemas de carga", href: "/resultados?category=1540", image: require("@/assets/categories/sistemas-carga.jpg") },
  { label: "Fuel injection", href: "/resultados?category=1533", image: require("@/assets/categories/inyectores.png") },
  { label: "Bombas de gasolina", href: "/resultados?q=bomba%20gasolina", image: require("@/assets/categories/bombas.png") },
  { label: "Partes eléctricas", href: "/resultados?category=1539", image: require("@/assets/categories/partes-electricas.jpg") },
  { label: "Iluminación", href: "/resultados?category=1550", image: require("@/assets/categories/sistemas-iluminacion.jpg") },
  { label: "Enfriamiento", href: "/resultados?category=1542", image: require("@/assets/categories/sistemas-enfriamiento.jpg") },
  { label: "Equipo de diagnóstico", href: "/resultados?category=1558", image: require("@/assets/categories/equipos.png") },
];
