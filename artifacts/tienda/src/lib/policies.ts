/**
 * Canonical legal content for Carper Autopartes — the set of policies an
 * e-commerce business in Mexico should publish (privacy notice under the
 * LFPDPPP, terms of use, shipping, returns/warranty, payments/billing and
 * cookies). Rendered in the mobile app (Cuenta › Acerca de Carper › Políticas
 * y privacidad) and on the website (/politicas).
 *
 * IMPORTANT: this file is intentionally duplicated, byte-for-byte, at
 * artifacts/tienda/src/lib/policies.ts so each artifact stays self-contained
 * (the app must show its policies even offline for app-store review). If you
 * edit one copy, apply the SAME change to the other so the app and the website
 * never diverge.
 *
 * Contact/identity values come from the shared STORE config so they never drift
 * from the rest of the app. The registered legal name (razón social) is set in
 * the privacy notice; the whole text should still be reviewed by a lawyer before
 * the public launch.
 */
import { STORE } from "@/lib/store";

export interface PolicySection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface PolicyDoc {
  /** URL/anchor slug + stable key for per-platform icon mapping. */
  id: string;
  title: string;
  /** One-line description shown in list/index views. */
  summary: string;
  sections: PolicySection[];
}

/** Human-readable date of the last revision, shown on every policy. */
export const POLICIES_UPDATED = "5 de junio de 2026";

export const POLICIES: PolicyDoc[] = [
  {
    id: "aviso-privacidad",
    title: "Aviso de Privacidad",
    summary:
      "Cómo recabamos, usamos, protegemos y compartimos sus datos personales conforme a la LFPDPPP.",
    sections: [
      {
        heading: "1. Identidad y domicilio del responsable",
        paragraphs: [
          `${STORE.name} (en lo sucesivo "Carper"), con domicilio en ${STORE.address} y RFC ${STORE.rfc}, es el responsable del tratamiento de sus datos personales, en términos de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), su Reglamento y demás normativa aplicable.`,
          "Para efectos legales, la razón social registrada del responsable es CARPER DISTRIBUIDORA, S.A. DE C.V. Cualquier duda sobre el presente aviso puede dirigirse al correo de contacto indicado más adelante.",
        ],
      },
      {
        heading: "2. Datos personales que recabamos",
        paragraphs: [
          "Para brindarle nuestros productos y servicios podemos recabar las siguientes categorías de datos personales:",
        ],
        bullets: [
          "Identificación y contacto: nombre, teléfono, correo electrónico y domicilio de entrega.",
          "Datos de cuenta: número de teléfono para verificación por SMS, historial de pedidos y preferencias.",
          "Datos de pago: los pagos con tarjeta se procesan a través de nuestro proveedor de pagos certificado; Carper NO almacena los datos completos de su tarjeta.",
          "Datos del vehículo: marca, modelo, año y, en su caso, el número de serie (VIN) que usted proporcione para identificar refacciones compatibles.",
          "Datos técnicos y de uso: identificadores de dispositivo y el token de notificaciones, utilizados para el funcionamiento y la seguridad de la aplicación.",
        ],
      },
      {
        heading: "3. Datos sensibles",
        paragraphs: [
          "Carper NO recaba datos personales sensibles (como origen racial, estado de salud, creencias religiosas o preferencias sexuales). No le solicitaremos este tipo de información.",
        ],
      },
      {
        heading: "4. Finalidades primarias (necesarias)",
        paragraphs: [
          "Sus datos se utilizan para las siguientes finalidades necesarias para la relación con usted:",
        ],
        bullets: [
          "Procesar, surtir, entregar y dar seguimiento a sus pedidos.",
          "Crear y administrar su cuenta y autenticar su acceso mediante código por SMS.",
          "Emitir comprobantes de compra y facturas (CFDI) cuando lo solicite.",
          "Brindar atención, asesoría técnica y soporte posventa.",
          "Prevenir fraudes y garantizar la seguridad de nuestras plataformas.",
        ],
      },
      {
        heading: "5. Finalidades secundarias",
        paragraphs: [
          "De manera adicional, y siempre que usted no manifieste su oposición, podemos usar sus datos para:",
        ],
        bullets: [
          "Enviarle promociones, ofertas y notificaciones sobre productos y servicios.",
          "Realizar encuestas de satisfacción y mejorar nuestra oferta.",
        ],
      },
      {
        heading: "6. Transferencias de datos",
        paragraphs: [
          "Para cumplir con las finalidades anteriores, podemos compartir sus datos con terceros estrictamente necesarios: proveedores de procesamiento de pagos, empresas de paquetería y mensajería, proveedores de servicios de mensajería SMS/WhatsApp y notificaciones, así como con autoridades competentes cuando exista un requerimiento fundado y motivado.",
          "Carper NO vende sus datos personales. Estas transferencias se realizan únicamente para prestarle el servicio y conforme a la ley.",
        ],
      },
      {
        heading: "7. Derechos ARCO y revocación del consentimiento",
        paragraphs: [
          `Usted tiene derecho a Acceder, Rectificar y Cancelar sus datos personales, así como a Oponerse a su tratamiento (derechos ARCO). También puede revocar el consentimiento que nos haya otorgado y limitar el uso o divulgación de sus datos.`,
          `Para ejercer cualquiera de estos derechos, envíe su solicitud al correo ${STORE.email}, indicando su nombre completo, una descripción clara de los datos sobre los que desea ejercer el derecho y la solicitud concreta. Daremos respuesta en los plazos previstos por la ley.`,
        ],
      },
      {
        heading: "8. Uso de cookies y tecnologías de rastreo",
        paragraphs: [
          "Nuestro sitio web utiliza cookies y tecnologías similares para su correcto funcionamiento y para mejorar su experiencia. Puede consultar el detalle en nuestra Política de Cookies.",
        ],
      },
      {
        heading: "9. Cambios al aviso de privacidad",
        paragraphs: [
          "Este aviso puede actualizarse en cualquier momento. Las modificaciones se publicarán en la aplicación y en nuestro sitio web, indicando la fecha de la última actualización.",
        ],
      },
      {
        heading: "10. Autoridad",
        paragraphs: [
          "Si considera que su derecho a la protección de datos personales ha sido vulnerado, puede acudir al Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales (INAI): www.inai.org.mx.",
        ],
      },
    ],
  },
  {
    id: "terminos",
    title: "Términos y Condiciones",
    summary:
      "Reglas para el uso de la aplicación y el sitio, compras, precios y responsabilidades.",
    sections: [
      {
        heading: "1. Aceptación",
        paragraphs: [
          `Al utilizar la aplicación o el sitio web de ${STORE.name}, usted acepta los presentes Términos y Condiciones. Si no está de acuerdo con ellos, le pedimos abstenerse de usar nuestras plataformas.`,
        ],
      },
      {
        heading: "2. Uso de la plataforma",
        paragraphs: [
          "Usted se compromete a hacer un uso lícito de la plataforma, a proporcionar información veraz al registrarse o realizar pedidos, y a resguardar la confidencialidad de sus credenciales de acceso. Usted es responsable de la actividad realizada desde su cuenta.",
        ],
      },
      {
        heading: "3. Productos, precios y disponibilidad",
        paragraphs: [
          "Todos los precios se expresan en pesos mexicanos (MXN) e incluyen IVA, salvo que se indique lo contrario. Los precios, promociones y la disponibilidad de los productos pueden cambiar sin previo aviso.",
          "Las imágenes son ilustrativas. En caso de un error evidente de precio o de falta de existencias, Carper podrá cancelar el pedido afectado y, de haberse cobrado, reembolsar el importe correspondiente.",
        ],
      },
      {
        heading: "4. Pedidos",
        paragraphs: [
          "El envío de un pedido constituye una oferta de compra. La operación se perfecciona cuando Carper la confirma y, en su caso, se acredita el pago. Carper se reserva el derecho de no aceptar pedidos por causas justificadas.",
        ],
      },
      {
        heading: "5. Compatibilidad de refacciones",
        paragraphs: [
          "La información de compatibilidad y la asesoría técnica son orientativas. Es responsabilidad del cliente verificar que la pieza corresponda a su vehículo (mediante número de parte, VIN o asesoría profesional) antes de instalarla. La asesoría no sustituye un diagnóstico mecánico profesional.",
        ],
      },
      {
        heading: "6. Propiedad intelectual",
        paragraphs: [
          "Las marcas, logotipos, textos e imágenes mostrados son propiedad de Carper o de sus respectivos titulares y están protegidos por la legislación aplicable. Queda prohibida su reproducción sin autorización.",
        ],
      },
      {
        heading: "7. Limitación de responsabilidad",
        paragraphs: [
          "Carper no será responsable por daños derivados del uso indebido de los productos, de instalaciones realizadas por terceros, ni por interrupciones temporales de la plataforma por causas ajenas a su control.",
        ],
      },
      {
        heading: "8. Legislación y jurisdicción aplicable",
        paragraphs: [
          `Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. En materia de consumo resulta aplicable la Ley Federal de Protección al Consumidor y la competencia de la Procuraduría Federal del Consumidor (PROFECO). Para cualquier controversia, las partes se someten a los tribunales competentes de ${STORE.city}.`,
        ],
      },
    ],
  },
  {
    id: "envios",
    title: "Política de Envíos y Entregas",
    summary:
      "Cobertura, tiempos, costos y opciones de entrega de sus pedidos.",
    sections: [
      {
        heading: "1. Cobertura",
        paragraphs: [
          `Realizamos entregas a domicilio en ${STORE.delivery.zona}. Para destinos foráneos, los pedidos se envían a través de empresas de paquetería.`,
        ],
      },
      {
        heading: "2. Tiempos de entrega",
        paragraphs: [
          `Entrega local a domicilio: tiempo estimado de ${STORE.delivery.eta}, sujeto a disponibilidad y zona. Envíos foráneos: el tiempo depende de la paquetería y el destino; se le informará el estimado al confirmar su pedido.`,
        ],
      },
      {
        heading: "3. Costos de envío",
        paragraphs: [
          `${STORE.delivery.gratis ? "La entrega local puede ser sin costo dentro de la zona de cobertura." : "El costo de la entrega local se calcula según la zona."} El costo de los envíos foráneos se determina según el destino, peso y dimensiones, y se le informará antes de confirmar la compra.`,
        ],
      },
      {
        heading: "4. Recolección en tienda",
        paragraphs: [
          `Puede recoger su pedido sin costo en nuestra sucursal: ${STORE.address}. Horario de atención: ${STORE.hours}.`,
        ],
      },
      {
        heading: "5. Seguimiento e incidencias",
        paragraphs: [
          "Cuando aplique, le proporcionaremos un número de guía para dar seguimiento a su envío. Si su paquete presenta daño, retraso o extravío, contáctenos a la brevedad para gestionar la solución correspondiente.",
        ],
      },
    ],
  },
  {
    id: "devoluciones",
    title: "Devoluciones, Cambios y Garantías",
    summary:
      "Sus derechos de garantía, plazos y el proceso para devoluciones y reembolsos.",
    sections: [
      {
        heading: "1. Garantía",
        paragraphs: [
          "Las refacciones cuentan con la garantía que otorga el fabricante contra defectos de origen. El plazo y las condiciones dependen de cada producto y se informan al momento de la compra. La garantía no cubre fallas por mal uso, instalación incorrecta o desgaste normal.",
        ],
      },
      {
        heading: "2. Devoluciones y cambios",
        paragraphs: [
          "Puede solicitar la devolución o el cambio de un producto dentro de los 30 días naturales posteriores a la compra, siempre que el artículo esté sin uso, en su empaque original y con su comprobante de compra.",
        ],
      },
      {
        heading: "3. Productos no sujetos a devolución",
        paragraphs: [
          "Por su naturaleza, no se aceptan devoluciones de piezas eléctricas que hayan sido instaladas o probadas (salvo defecto de fábrica), ni de productos solicitados sobre pedido, salvo lo dispuesto por la ley.",
        ],
      },
      {
        heading: "4. Proceso de devolución",
        paragraphs: [
          `Para iniciar una devolución, cambio o garantía, contáctenos por WhatsApp o al correo ${STORE.email} presentando su comprobante de compra. Le indicaremos los pasos y, en su caso, valoraremos el producto.`,
        ],
      },
      {
        heading: "5. Reembolsos",
        paragraphs: [
          "Una vez autorizada la devolución, el reembolso se realiza por el mismo medio de pago utilizado en la compra. El tiempo de reflejo depende de su banco o proveedor de pago.",
        ],
      },
      {
        heading: "6. Derechos del consumidor",
        paragraphs: [
          "Esta política respeta los derechos que la Ley Federal de Protección al Consumidor reconoce en su favor. Para cualquier aclaración puede acudir a la PROFECO (www.gob.mx/profeco).",
        ],
      },
    ],
  },
  {
    id: "pagos",
    title: "Política de Pagos y Facturación",
    summary:
      "Métodos de pago aceptados, seguridad de sus datos y emisión de facturas.",
    sections: [
      {
        heading: "1. Métodos de pago",
        paragraphs: [
          "Aceptamos pago con tarjeta de crédito o débito (procesado por un proveedor de pagos seguro), pago en efectivo en tienda o contra entrega, y transferencia electrónica (SPEI), según las opciones disponibles al momento de su compra.",
        ],
      },
      {
        heading: "2. Seguridad",
        paragraphs: [
          "Los pagos con tarjeta se procesan a través de un proveedor certificado conforme al estándar PCI DSS. Carper no almacena los datos completos de su tarjeta en sus sistemas.",
        ],
      },
      {
        heading: "3. Moneda",
        paragraphs: [
          "Todas las operaciones se realizan en pesos mexicanos (MXN).",
        ],
      },
      {
        heading: "4. Facturación (CFDI)",
        paragraphs: [
          `Si requiere factura, solicítela proporcionando sus datos fiscales (RFC, razón social, régimen fiscal, uso de CFDI y código postal) dentro del mes calendario en que realizó su compra, enviándolos al correo ${STORE.email}. No es posible emitir facturas de meses anteriores.`,
        ],
      },
      {
        heading: "5. Confirmación de la compra",
        paragraphs: [
          "Su pedido se procesa una vez que se confirma el pago correspondiente. En pagos en efectivo o por transferencia, el pedido se prepara al acreditarse el importe.",
        ],
      },
    ],
  },
  {
    id: "cookies",
    title: "Política de Cookies",
    summary:
      "Qué cookies y tecnologías usamos en el sitio web y cómo puede gestionarlas.",
    sections: [
      {
        heading: "1. ¿Qué son las cookies?",
        paragraphs: [
          "Las cookies son pequeños archivos que se almacenan en su dispositivo cuando visita un sitio web y permiten recordar información sobre su navegación.",
        ],
      },
      {
        heading: "2. Cookies que utilizamos",
        bullets: [
          "Esenciales: necesarias para el funcionamiento del sitio (por ejemplo, mantener su sesión y el carrito).",
          "De rendimiento y analítica: nos ayudan a entender cómo se usa el sitio para mejorarlo.",
          "De preferencia: recuerdan opciones como sus búsquedas o vehículos recientes.",
        ],
      },
      {
        heading: "3. Cómo gestionar las cookies",
        paragraphs: [
          "Puede aceptar, bloquear o eliminar las cookies desde la configuración de su navegador. Tenga en cuenta que deshabilitar algunas cookies puede afectar el funcionamiento del sitio.",
        ],
      },
      {
        heading: "4. Aplicación móvil",
        paragraphs: [
          "En nuestra aplicación móvil no utilizamos cookies de navegador; empleamos identificadores técnicos y un token de notificaciones para el funcionamiento del servicio, conforme a nuestro Aviso de Privacidad.",
        ],
      },
    ],
  },
];
