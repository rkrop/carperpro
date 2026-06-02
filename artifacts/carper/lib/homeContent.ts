import { ImageSourcePropType } from "react-native";

/**
 * Curated home-screen content for Carper Autopartes.
 *
 * This is editorial / merchandising content kept in the app (not synced from the
 * ERP). Symptom shortcuts and tips link shoppers into the catalog search
 * (`/resultados?q=...`) for the relevant parts. Tip queries use high-rotation
 * keywords that are known to return results in the catalog.
 */

export interface Symptom {
  id: string;
  /** Short symptom label the shopper recognizes ("No arranca"). */
  label: string;
  /** MaterialCommunityIcons name. */
  icon: string;
  /** Catalog search query (`/resultados?q=`). */
  query: string;
}

/** Symptom-based shortcuts ("¿Qué le pasa a tu auto?"). */
export const SYMPTOMS: Symptom[] = [
  { id: "no-arranca", label: "No arranca", icon: "engine-off-outline", query: "marcha" },
  { id: "check-engine", label: "Check engine", icon: "alert-circle-outline", query: "sensor oxigeno" },
  { id: "no-carga", label: "No carga la batería", icon: "battery-alert-variant-outline", query: "alternador" },
  { id: "jaloneos", label: "Jaloneos al acelerar", icon: "sine-wave", query: "bobina" },
  { id: "alto-consumo", label: "Gasta mucha gasolina", icon: "fuel", query: "inyector" },
  { id: "marcha-irregular", label: "Marcha irregular", icon: "speedometer-slow", query: "sensor" },
];

export interface Tip {
  id: string;
  /** Small uppercase eyebrow. */
  tag: string;
  title: string;
  body: string;
  image: ImageSourcePropType;
  /** Catalog search query the tip links to. */
  query: string;
}

/** Editorial maintenance tips ("Consejos del taller"). */
export const TIPS: Tip[] = [
  {
    id: "alternador",
    tag: "Sistema de carga",
    title: "¿Cuándo cambiar tu alternador?",
    body: "Si la luz de batería se enciende, los faros se ven tenues o escuchas un zumbido de balero, tu alternador ya pide relevo. No lo dejes hasta quedarte tirado.",
    image: require("@/assets/images/tips/alternador.png"),
    query: "alternador",
  },
  {
    id: "bomba",
    tag: "Inyección",
    title: "Señales de una bomba de gasolina fallando",
    body: "Jaloneos al acelerar, arranques difíciles en caliente y pérdida de potencia en subidas suelen ser la bomba de gasolina perdiendo presión.",
    image: require("@/assets/images/tips/bomba.png"),
    query: "bomba gasolina",
  },
  {
    id: "afinacion",
    tag: "Mantenimiento",
    title: "Afinación a tiempo evita el check engine",
    body: "Bujías, bobinas y sensores en buen estado ahorran gasolina y previenen el temido check engine. Una afinación cuesta menos que una reparación mayor.",
    image: require("@/assets/images/tips/afinacion.png"),
    query: "sensor",
  },
];

/** Which curated Ofertas campaigns to spotlight on the home screen (by id). */
export const HOME_COLLECTION_IDS = ["joyas-electricas", "no-arranca", "bombas-gasolina"];

export interface HomeFaqItem {
  q: string;
  a: string;
}

/** Short FAQ on home; full FAQ lives in the Ayuda screen. */
export const HOME_FAQ: HomeFaqItem[] = [
  {
    q: "¿Cómo sé si una pieza sirve para mi auto?",
    a: "Guarda tu vehículo en tu cuenta y la app te marca las refacciones compatibles. Si tienes duda, escríbenos por WhatsApp con tu número de serie (VIN).",
  },
  {
    q: "¿Tienen entrega a domicilio?",
    a: "Sí. Entregamos en toda la ciudad en aproximadamente 30 a 60 minutos, sin costo. También puedes recoger en la tienda.",
  },
  {
    q: "¿Manejan garantía?",
    a: "Sí. Las refacciones eléctricas remanufacturadas y de marca cuentan con garantía. Conserva tu nota y contáctanos si tienes algún problema.",
  },
];

export interface TrustStat {
  icon: string; // Feather name
  value: string;
  label: string;
}

/** Trust signals for the "Sobre Carper" strip (all backed by real store data). */
export const TRUST_STATS: TrustStat[] = [
  { icon: "package", value: "+7,000", label: "Refacciones en catálogo" },
  { icon: "truck", value: "30–60 min", label: "Entrega en la ciudad" },
  { icon: "shield", value: "Garantía", label: "En piezas eléctricas" },
  { icon: "map-pin", value: "Cd. Obregón", label: "Tienda física, Sonora" },
];
