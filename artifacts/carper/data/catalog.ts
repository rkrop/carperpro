import { ImageSourcePropType } from "react-native";

const IMAGES = {
  starter: require("@/assets/images/carper-starter.png") as ImageSourcePropType,
  alternator: require("@/assets/images/carper-alternator.png") as ImageSourcePropType,
};

export interface Category {
  id: string;
  name: string;
  icon: string; // MaterialCommunityIcons name
  count: number;
}

export interface Spec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  stock: number;
  categoryId: string;
  image: ImageSourcePropType | null;
  compatible: boolean;
  specs: Spec[];
  vehicles: string[];
  oem?: string[];
  equivalents?: string[];
}

export interface Sucursal {
  id: string;
  name: string;
  address: string;
  city: string;
  hours: string;
}

export const CATEGORIES: Category[] = [
  { id: "marchas", name: "Marchas", icon: "engine-outline", count: 1284 },
  { id: "electrico", name: "Sistema Eléctrico", icon: "flash-outline", count: 1622 },
  { id: "inyeccion", name: "Inyección", icon: "fuel", count: 944 },
  { id: "iluminacion", name: "Iluminación", icon: "car-light-high", count: 731 },
  { id: "filtros", name: "Filtros", icon: "air-filter", count: 689 },
  { id: "encendido", name: "Encendido", icon: "flash-alert-outline", count: 612 },
  { id: "alternadores", name: "Alternadores", icon: "battery-charging", count: 538 },
  { id: "enfriamiento", name: "Enfriamiento", icon: "fan", count: 421 },
  { id: "rodamientos", name: "Rodamientos", icon: "cog-outline", count: 318 },
  { id: "interruptores", name: "Interruptores", icon: "toggle-switch-outline", count: 204 },
  { id: "bulbos", name: "Bulbos", icon: "lightbulb-on-outline", count: 187 },
  { id: "lubricantes", name: "Lubricantes", icon: "oil", count: 153 },
];

export const BRANDS = [
  "SIN MARCA",
  "BOSCH",
  "DENSO",
  "DELPHI",
  "HITACHI",
  "VALEO",
  "AIRTEX",
  "WALBRO",
  "GONHER",
  "VALVOLINE",
];

const TSURU_VEHICLES = [
  "NISSAN TSURU 1.6 1992",
  "NISSAN TSURU 1.6 1993",
  "NISSAN TSURU 1.6 1994",
  "NISSAN TSURU 1.6 1995",
  "NISSAN TSURU 1.6 1996",
  "NISSAN SENTRA 1.6 1991-1994",
  "NISSAN TSUBAME 1.6 1993-1998",
  "NISSAN ICHI VAN 1.6 1995",
];

export const PRODUCTS: Product[] = [
  {
    id: "2740",
    sku: "2740",
    name: "MARCHA BOSCH TSURU 1.6",
    brand: "BOSCH",
    price: 1792.33,
    originalPrice: 2240.41,
    stock: 24,
    categoryId: "marchas",
    image: IMAGES.starter,
    compatible: true,
    specs: [
      { label: "Marca", value: "BOSCH" },
      { label: "Voltaje", value: "12V" },
      { label: "Rotación", value: "CW (Derecha)" },
      { label: "Dientes", value: "9" },
      { label: "Potencia", value: "1.0 kW" },
    ],
    vehicles: TSURU_VEHICLES,
    equivalents: ["LRS00118", "SR4216X", "0986021230"],
  },
  {
    id: "3120",
    sku: "3120",
    name: "MARCHA DENSO SENTRA 2.0 2007-2012",
    brand: "DENSO",
    price: 2310.0,
    stock: 9,
    categoryId: "marchas",
    image: null,
    compatible: false,
    specs: [
      { label: "Marca", value: "DENSO" },
      { label: "Voltaje", value: "12V" },
      { label: "Rotación", value: "CW (Derecha)" },
      { label: "Dientes", value: "13" },
    ],
    vehicles: ["NISSAN SENTRA 2.0 2007-2012"],
  },
  {
    id: "2890",
    sku: "2890",
    name: "MARCHA HITACHI VERSA 1.6 2012-2019",
    brand: "HITACHI",
    price: 1985.75,
    stock: 3,
    categoryId: "marchas",
    image: null,
    compatible: false,
    specs: [
      { label: "Marca", value: "HITACHI" },
      { label: "Voltaje", value: "12V" },
      { label: "Rotación", value: "CW (Derecha)" },
    ],
    vehicles: ["NISSAN VERSA 1.6 2012-2019", "NISSAN MARCH 1.6 2012-2018"],
  },
  {
    id: "990",
    sku: "990",
    name: "ALTERNADOR PARA NISSAN TSURU 1.6 1986-1988 12V/70A",
    brand: "SIN MARCA",
    price: 646.04,
    stock: 31,
    categoryId: "alternadores",
    image: IMAGES.alternator,
    compatible: true,
    specs: [
      { label: "Voltaje", value: "12V" },
      { label: "Amperaje", value: "70A" },
      { label: "Polea", value: "Canal sencillo" },
    ],
    vehicles: TSURU_VEHICLES,
  },
  {
    id: "1450",
    sku: "1450",
    name: "ALTERNADOR VALEO JETTA A4 1.8 90A",
    brand: "VALEO",
    price: 3120.0,
    originalPrice: 3680.0,
    stock: 12,
    categoryId: "alternadores",
    image: null,
    compatible: false,
    specs: [
      { label: "Marca", value: "VALEO" },
      { label: "Voltaje", value: "12V" },
      { label: "Amperaje", value: "90A" },
    ],
    vehicles: ["VW JETTA A4 1.8 1999-2007", "VW GOLF A4 1.8 1999-2006"],
    oem: ["028903028D", "06B903016AB"],
    equivalents: ["TG9S017", "439558"],
  },
  {
    id: "1622",
    sku: "1622",
    name: "ALTERNADOR BOSCH AVEO 1.6 70A",
    brand: "BOSCH",
    price: 2745.5,
    stock: 0,
    categoryId: "alternadores",
    image: null,
    compatible: false,
    specs: [
      { label: "Marca", value: "BOSCH" },
      { label: "Voltaje", value: "12V" },
      { label: "Amperaje", value: "70A" },
    ],
    vehicles: ["CHEVROLET AVEO 1.6 2008-2017"],
  },
  {
    id: "SW220",
    sku: "SW220",
    name: "SWITCH DE ENCENDIDO TSURU 1.6",
    brand: "SIN MARCA",
    price: 245.0,
    stock: 48,
    categoryId: "interruptores",
    image: null,
    compatible: true,
    specs: [
      { label: "Tipo", value: "Switch de encendido" },
      { label: "Terminales", value: "4" },
    ],
    vehicles: TSURU_VEHICLES,
  },
  {
    id: "REL12V",
    sku: "REL12V",
    name: "RELEVADOR UNIVERSAL 12V 40A 4 TERMINALES",
    brand: "BOSCH",
    price: 89.0,
    stock: 120,
    categoryId: "electrico",
    image: null,
    compatible: false,
    specs: [
      { label: "Marca", value: "BOSCH" },
      { label: "Voltaje", value: "12V" },
      { label: "Amperaje", value: "40A" },
      { label: "Terminales", value: "4" },
    ],
    vehicles: ["Aplicación universal"],
  },
  {
    id: "13586451-GM",
    sku: "13586451-GM",
    name: "BOMBA DE GASOLINA CHEVROLET SONIC 13-15 1.6L",
    brand: "GONHER",
    price: 1980.5,
    stock: 14,
    categoryId: "inyeccion",
    image: null,
    compatible: false,
    specs: [
      { label: "Presión", value: "55 PSI" },
      { label: "Conector", value: "Original" },
    ],
    vehicles: ["CHEVROLET SONIC 1.6 2013-2015", "CHEVROLET AVEO 1.6 2012-2017"],
  },
  {
    id: "WAL255",
    sku: "WAL255",
    name: "BOMBA DE GASOLINA WALBRO 255 LPH ALTA PRESIÓN",
    brand: "WALBRO",
    price: 1540.0,
    stock: 7,
    categoryId: "inyeccion",
    image: null,
    compatible: false,
    specs: [
      { label: "Marca", value: "WALBRO" },
      { label: "Flujo", value: "255 LPH" },
    ],
    vehicles: ["Aplicación universal de competencia"],
  },
  {
    id: "INJ4G",
    sku: "INJ4G",
    name: "INYECTOR DELPHI SENTRA 1.8 2007-2012",
    brand: "DELPHI",
    price: 980.25,
    stock: 2,
    categoryId: "inyeccion",
    image: null,
    compatible: false,
    specs: [
      { label: "Marca", value: "DELPHI" },
      { label: "Tipo", value: "Multipunto" },
    ],
    vehicles: ["NISSAN SENTRA 1.8 2007-2012"],
  },
  {
    id: "CA6900",
    sku: "CA6900",
    name: "FILTRO AFINACIÓN SENTRA 1.8 2013-2018",
    brand: "SIN MARCA",
    price: 170.0,
    stock: 56,
    categoryId: "filtros",
    image: null,
    compatible: false,
    specs: [
      { label: "Incluye", value: "Aceite, aire, gasolina" },
      { label: "Aplicación", value: "Afinación mayor" },
    ],
    vehicles: ["NISSAN SENTRA 1.8 2013-2018"],
  },
  {
    id: "FA1020",
    sku: "FA1020",
    name: "FILTRO DE AIRE TSURU 1.6",
    brand: "SIN MARCA",
    price: 145.0,
    stock: 88,
    categoryId: "filtros",
    image: null,
    compatible: true,
    specs: [
      { label: "Tipo", value: "Panel" },
      { label: "Material", value: "Papel plisado" },
    ],
    vehicles: TSURU_VEHICLES,
  },
  {
    id: "H4-100",
    sku: "H4-100",
    name: "BULBO HALÓGENO H4 12V 100/90W (PAR)",
    brand: "SIN MARCA",
    price: 75.0,
    stock: 210,
    categoryId: "bulbos",
    image: null,
    compatible: false,
    specs: [
      { label: "Base", value: "H4" },
      { label: "Voltaje", value: "12V" },
      { label: "Potencia", value: "100/90W" },
    ],
    vehicles: ["Aplicación universal"],
  },
  {
    id: "LED-T10",
    sku: "LED-T10",
    name: "LED T10 BLANCO CALÍMETRO (PAR)",
    brand: "SIN MARCA",
    price: 120.0,
    originalPrice: 150.0,
    stock: 145,
    categoryId: "iluminacion",
    image: null,
    compatible: false,
    specs: [
      { label: "Base", value: "T10 / W5W" },
      { label: "Color", value: "Blanco 6000K" },
    ],
    vehicles: ["Aplicación universal"],
  },
  {
    id: "BUJ-DENSO",
    sku: "BUJ-DENSO",
    name: "BUJÍA DENSO IRIDIUM (JUEGO 4)",
    brand: "DENSO",
    price: 680.0,
    originalPrice: 820.0,
    stock: 64,
    categoryId: "encendido",
    image: null,
    compatible: false,
    specs: [
      { label: "Marca", value: "DENSO" },
      { label: "Electrodo", value: "Iridium" },
      { label: "Cantidad", value: "4 piezas" },
    ],
    vehicles: ["Múltiples aplicaciones"],
  },
  {
    id: "BOB-TSURU",
    sku: "BOB-TSURU",
    name: "BOBINA DE ENCENDIDO TSURU 1.6",
    brand: "SIN MARCA",
    price: 420.0,
    stock: 18,
    categoryId: "encendido",
    image: null,
    compatible: true,
    specs: [
      { label: "Voltaje", value: "12V" },
      { label: "Tipo", value: "Distribuidor" },
    ],
    vehicles: TSURU_VEHICLES,
  },
  {
    id: "BA-TSURU",
    sku: "BA-TSURU",
    name: "BOMBA DE AGUA TSURU 1.6",
    brand: "AIRTEX",
    price: 540.0,
    stock: 3,
    categoryId: "enfriamiento",
    image: null,
    compatible: true,
    specs: [
      { label: "Marca", value: "AIRTEX" },
      { label: "Incluye", value: "Junta" },
    ],
    vehicles: TSURU_VEHICLES,
  },
  {
    id: "20W50VAL5L",
    sku: "20W50VAL5L",
    name: "ACEITE 20W50 VALVOLINE 5L",
    brand: "VALVOLINE",
    price: 489.0,
    originalPrice: 560.0,
    stock: 95,
    categoryId: "lubricantes",
    image: null,
    compatible: false,
    specs: [
      { label: "Viscosidad", value: "20W50" },
      { label: "Tipo", value: "Mineral" },
      { label: "Contenido", value: "5 Litros" },
    ],
    vehicles: ["Aplicación general gasolina"],
  },
  {
    id: "BAL-6204",
    sku: "BAL-6204",
    name: "BALERO 6204 2RS SELLADO",
    brand: "SIN MARCA",
    price: 95.0,
    stock: 76,
    categoryId: "rodamientos",
    image: null,
    compatible: false,
    specs: [
      { label: "Medida", value: "6204 2RS" },
      { label: "Sello", value: "Doble hule" },
    ],
    vehicles: ["Aplicación universal"],
  },
];

export const SUCURSALES: Sucursal[] = [
  { id: "centro", name: "Sucursal Centro", address: "Av. Juárez 120, Col. Centro", city: "Puebla", hours: "8:00 – 19:00" },
  { id: "norte", name: "Sucursal Norte", address: "Blvd. Norte 1500, Las Ánimas", city: "Puebla", hours: "8:00 – 19:00" },
  { id: "sur", name: "Sucursal Sur", address: "Calz. Zavaleta 890, La Paz", city: "Puebla", hours: "9:00 – 18:00" },
  { id: "tecno", name: "Sucursal Tecnológico", address: "Av. Tecnológico 45, Maravillas", city: "Puebla", hours: "8:00 – 18:00" },
];

export const RECENT_SEARCHES = [
  "marcha tsuru",
  "alternador 70a",
  "bujia denso",
  "filtro afinacion sentra",
  "bomba gasolina sonic",
];

export const VEHICLE_DATA = {
  marcas: ["NISSAN", "CHEVROLET", "VOLKSWAGEN", "FORD", "TOYOTA", "HONDA"],
  modelos: {
    NISSAN: ["TSURU", "SENTRA", "VERSA", "MARCH", "NP300", "TIIDA"],
    CHEVROLET: ["AVEO", "SONIC", "SPARK", "BEAT", "CHEYENNE"],
    VOLKSWAGEN: ["JETTA", "GOLF", "POINTER", "VENTO"],
    FORD: ["FIESTA", "FOCUS", "RANGER", "IKON"],
    TOYOTA: ["COROLLA", "YARIS", "HILUX"],
    HONDA: ["CIVIC", "CITY", "FIT"],
  } as Record<string, string[]>,
  motores: ["1.6L", "1.8L", "2.0L", "2.4L", "Diesel"],
};

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export const OFERTAS = PRODUCTS.filter((p) => p.originalPrice && p.originalPrice > p.price);

/** Featured "Oferta del Día". */
export const DEAL_OF_DAY = getProduct("2740")!;
