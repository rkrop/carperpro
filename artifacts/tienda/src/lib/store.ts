/**
 * Static business + brand config for the Carper Autopartes catalog showcase
 * website. Mirrors the canonical store data used by the mobile app
 * (artifacts/carper/lib/store.ts).
 *
 * This is a SHOWCASE site: browse + search + product detail with a
 * "Pedir por WhatsApp" CTA. There is intentionally NO cart, checkout, or
 * payment here — purchases happen over WhatsApp or in the mobile app.
 */
export const STORE = {
  name: "Carper Autopartes",
  tagline: "Refaccionaria en Ciudad Obregón",
  address: "Blvd. Ignacio Ramírez 290, Ciudad Obregón, Sonora, CP 85160",
  city: "Ciudad Obregón, Sonora",
  hours: "Lun-Vie 8:00-18:00 · Sáb 8:00-14:00",
  hoursLines: ["Lunes a Viernes: 8:00 - 18:00", "Sábado: 8:00 - 14:00", "Domingo: Cerrado"],
  phone: "6441225597",
  phoneDisplay: "644 122 5597",
  /** WhatsApp number in international format for wa.me links (52 + 10 digits). */
  whatsapp: "526441225597",
  email: "facturacion@puntorefaccionario.com",
  rfc: "CDI960919J54",
  instagram: "carperautopartes",
  instagramUrl: "https://instagram.com/carperautopartes",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(
      "Carper Autopartes, Blvd. Ignacio Ramírez 290, Ciudad Obregón, Sonora, 85160",
    ),
  delivery: { gratis: true, eta: "30 a 60 min", zona: "Toda la ciudad" },
} as const;

/** URL of the published mobile app, used by the "Descarga la app" QR + button. */
export const APP_URL = "https://carperautopartes.replit.app";

/**
 * Build a wa.me link with a prefilled Spanish message asking about a specific
 * product. The customer fills in their name where indicated.
 *
 * @param product Optional product to reference (name + SKU are included).
 */
export function whatsappUrl(product?: { name: string; sku: string }): string {
  let message: string;
  if (product) {
    message =
      `Hola, soy [tu nombre] y me interesa este producto de Carper Autopartes:\n\n` +
      `${product.name}\nSKU: ${product.sku}\n\n` +
      `¿Tienen disponibilidad y precio?`;
  } else {
    message =
      `Hola, soy [tu nombre] y quisiera información sobre sus refacciones en Carper Autopartes.`;
  }
  return `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(message)}`;
}
