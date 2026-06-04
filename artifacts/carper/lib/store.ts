/**
 * Single-store business config for Carper Autopartes.
 *
 * Carper has ONE physical store, so the app does not use a branch (sucursal)
 * selector. `id` is intentionally empty: every catalog/stock query reads
 * `store.id || undefined`, so an empty id means "no branch filter" and the API
 * sums on-hand stock across all branches. That keeps stock correct regardless
 * of the internal branch id used by the seed or the Admintotal ERP sync.
 */
export interface Store {
  /** Empty on purpose — see file header. */
  id: string;
  name: string;
  /** Full one-line address for display. */
  address: string;
  /** City + state, shown where a short location is needed. */
  city: string;
  /** Opening hours, human readable. */
  hours: string;
  /** Local phone number, digits only (for tel: links / display). */
  phone: string;
  /** Phone formatted for display. */
  phoneDisplay: string;
  /** WhatsApp number in international format for wa.me links (52 + 10 digits). */
  whatsapp: string;
  email: string;
  rfc: string;
  /** Instagram handle without the @. */
  instagram: string;
  instagramUrl: string;
  /** Google Maps link for the storefront. */
  mapsUrl: string;
  /** Home-delivery details. */
  delivery: { gratis: boolean; eta: string; zona: string };
  /** Bank account for SPEI / interbank transfers. */
  bank: {
    banco: string;
    beneficiario: string;
    cuenta: string;
    clabe: string;
    swift: string;
  };
}

export const STORE: Store = {
  id: "",
  name: "Carper Autopartes",
  address: "Blvd. Ignacio Ramírez 290, Ciudad Obregón, Sonora, CP 85160",
  city: "Ciudad Obregón, Sonora",
  hours: "Lun-Vie 8:00-18:00 · Sáb 8:00-14:00",
  phone: "6441225597",
  phoneDisplay: "644 122 5597",
  whatsapp: "526441225597",
  email: "facturacion@puntorefaccionario.com",
  rfc: "CDI960919J54",
  instagram: "carperautopartes",
  instagramUrl: "https://instagram.com/carperautopartes",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("Carper Autopartes, Blvd. Ignacio Ramírez 290, Ciudad Obregón, Sonora, 85160"),
  delivery: { gratis: true, eta: "30 a 60 min", zona: "Toda la ciudad" },
  bank: {
    banco: "BBVA",
    beneficiario: "Carper Autopartes",
    cuenta: "155 300 4058",
    clabe: "012 767 01553004058 4",
    swift: "BCMRMXMMPYM",
  },
};
