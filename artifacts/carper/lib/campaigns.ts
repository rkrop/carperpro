import { ImageSourcePropType } from "react-native";

/**
 * Curated Ofertas campaigns for Carper Autopartes.
 *
 * These are merchandising/marketing cards (not per-product discounts). Each one
 * carries an AI-generated photo and a `query` that drops the shopper into the
 * catalog search (`/resultados?q=...`) for the relevant parts. The live
 * "Oferta del día" (rotating discounted product) is handled separately on the
 * Ofertas screen via the deals API, so it is NOT listed here.
 *
 * The `restock` card is personalized at render time with the saved vehicle.
 */
export interface Campaign {
  id: string;
  kind: "collection" | "restock";
  title: string;
  /** Short editorial subtitle shown under the title. */
  subtitle: string;
  /** Small uppercase eyebrow/tag. */
  tag: string;
  image: ImageSourcePropType;
  /** Catalog search query the card links to (`/resultados?q=`). */
  query: string;
}

export const CAMPAIGNS: Campaign[] = [
  {
    id: "joyas-electricas",
    kind: "collection",
    tag: "Especialidad",
    title: "Joyas eléctricas para tu clásico",
    subtitle: "Alternadores, marchas y solenoides para autos 80s, 90s y 2000s.",
    image: require("@/assets/images/ofertas/01-joyas.png"),
    query: "alternador",
  },
  {
    id: "no-arranca",
    kind: "collection",
    tag: "Solución rápida",
    title: "¿No arranca? Aquí está la solución",
    subtitle: "Marchas, switches de encendido y solenoides. Ataca el síntoma.",
    image: require("@/assets/images/ofertas/03-noarranca.png"),
    query: "marcha",
  },
  {
    id: "despiece",
    kind: "collection",
    tag: "Pieza exacta",
    title: "Despiece completo de marcha y alternador",
    subtitle: "Portacarbones, regulador, bendix y plato. La pieza, no el conjunto.",
    image: require("@/assets/images/ofertas/04-despiece.png"),
    query: "regulador",
  },
  {
    id: "check-engine",
    kind: "collection",
    tag: "Diagnóstico",
    title: "Diagnóstico de check engine",
    subtitle: "Sensores de oxígeno, MAF, MAP y posición de cigüeñal.",
    image: require("@/assets/images/ofertas/05-checkengine.png"),
    query: "sensor oxigeno",
  },
  {
    id: "bombas-gasolina",
    kind: "collection",
    tag: "Fuel injection",
    title: "Bombas de gasolina para cualquier modelo",
    subtitle: "El corazón del fuel injection, alta rotación.",
    image: require("@/assets/images/ofertas/06-bombas.png"),
    query: "bomba gasolina",
  },
  {
    id: "carbuclean",
    kind: "collection",
    tag: "Mantenimiento",
    title: "Kit de limpieza de inyectores",
    subtitle: "Carbuclean: recompra frecuente, ticket bajo, resultado seguro.",
    image: require("@/assets/images/ofertas/07-carbuclean.png"),
    query: "limpiador inyector",
  },
  {
    id: "sensores",
    kind: "collection",
    tag: "Categoría amplia",
    title: "Sensores que tu motor necesita",
    subtitle: "Oxígeno, velocidad (VSS), temperatura y posición.",
    image: require("@/assets/images/ofertas/08-sensores.png"),
    query: "sensor",
  },
  {
    id: "bobinas",
    kind: "collection",
    tag: "Falla común",
    title: "Bobinas de encendido",
    subtitle: "Falla común, marcas múltiples, buena rotación.",
    image: require("@/assets/images/ofertas/09-bobinas.png"),
    query: "bobina",
  },
  {
    id: "restock",
    kind: "restock",
    tag: "Para tu vehículo",
    title: "Llegó tu pieza eléctrica",
    subtitle: "Aviso de reabasto de la pieza rara que buscabas.",
    image: require("@/assets/images/ofertas/10-restock.png"),
    query: "alternador",
  },
];
