/**
 * Curated blog content for Carper Autopartes.
 *
 * Editorial / community content: tips, news, curiosities, testimonials,
 * expos and forum picks. Kept in the app (not synced from ERP).
 * The `featured` flag controls which posts appear on the home screen strip.
 */

import { ImageSourcePropType } from "react-native";

export type BlogCategory =
  | "Tips del Taller"
  | "Sabías Que"
  | "Noticias"
  | "Testimonio"
  | "Expo & Eventos"
  | "Foro";

export interface BlogPost {
  id: string;
  category: BlogCategory;
  tag: string;
  title: string;
  summary: string;
  body: string;
  date: string;
  readMin: number;
  icon: string;
  accentColor: string;
  /** Editorial photo for the post (cover-cropped in cards and hero). */
  image: ImageSourcePropType;
  featured?: boolean;
}

export const BLOG_CATEGORIES: BlogCategory[] = [
  "Tips del Taller",
  "Sabías Que",
  "Noticias",
  "Testimonio",
  "Expo & Eventos",
  "Foro",
];

export const BLOG_POSTS: BlogPost[] = [
  {
    id: "check-obd",
    image: require("@/assets/images/blog/check-obd.png"),
    category: "Tips del Taller",
    tag: "DIY",
    title: "Cómo leer códigos OBD2 sin ir al taller",
    summary:
      "Un escáner de $200 te dice exactamente qué falla. Aprende a interpretar los códigos y ahorra tiempo y dinero.",
    body: `El puerto OBD2 está en todos los autos fabricados desde 1996. Está debajo del volante, al lado del pedal del clutch, y no necesitas ser mecánico para usarlo.

Con un escáner básico (los hay desde $180 pesos en ferreterías o tiendas de autos) puedes conectarte en segundos y leer el código que encendió la luz de check engine.

**¿Qué significan los códigos?**

Los códigos empiezan con una letra: P (powertrain / motor), B (body / carrocería), C (chassis), U (red de comunicación). El número siguiente te dice si es genérico (0xxx) o específico del fabricante (1xxx).

Los más comunes en México:
- P0300 a P0308 — Falla de encendido (misfire). Casi siempre bujía o bobina.
- P0171 / P0174 — Mezcla pobre. Sensor MAF sucio o vacío en la admisión.
- P0420 — Catalizador por debajo de la eficiencia. A veces es solo el sensor de oxígeno aguas abajo.
- P0401 — Flujo insuficiente en el EGR. Válvula EGR carboneada.

**El proceso correcto**

1. Conecta el escáner con el motor apagado pero llave en ACC.
2. Lee el código y anótalo.
3. Busca el código específico para tu modelo y año — los síntomas varían.
4. Borra el código y maneja 20 km. Si regresa, el problema es activo.
5. Si no regresa, fue un evento aislado (pico de tensión, combustible contaminado).

No te dejes vender una reparación costosa solo porque hay un código. El código te dice dónde buscar, no qué pieza comprar. Un mecánico que no revisa el live data junto con el código está adivinando.

**Herramienta recomendada**

Los escáneres Bluetooth con app para celular (tipo ELM327) son suficientes para uso personal. Para taller, un escáner con capacidad de live data por $800–$2,000 hace toda la diferencia.`,
    date: "2025-05-28",
    readMin: 4,
    icon: "chip",
    accentColor: "#1A1A2E",
    featured: true,
  },
  {
    id: "cinco-sensores",
    image: require("@/assets/images/blog/cinco-sensores.png"),
    category: "Sabías Que",
    tag: "Curiosidades",
    title: "Los 5 sensores que más fallan en autos mexicanos",
    summary:
      "MAF, oxígeno, temperatura, posición de cigüeñal y VSS. Descubre qué síntoma causa cada uno y por qué fallan tan seguido.",
    body: `Los sensores modernos hacen que el motor funcione con precisión, pero también son los primeros en resentir el calor extremo del norte de México, el combustible de baja calidad y los años de vibración. Estos cinco encabezan las consultas en talleres de la región.

**1. Sensor MAF (Flujo Másico de Aire)**

El MAF mide cuánto aire entra al motor para calcular la cantidad de gasolina a inyectar. Cuando se contamina con polvo o aceite del filtro, envía lecturas incorrectas. Resultado: mezcla rica o pobre, jaloneos y consumo disparado. Se limpia con spray para MAF; si está dañado, hay que reemplazarlo.

**2. Sensor de Oxígeno (Sonda Lambda)**

Hay al menos dos: uno antes del catalizador y otro después. El primero controla la mezcla en tiempo real; el segundo monitorea el catalizador. A los 80,000–100,000 km pierden sensibilidad y el motor empieza a "nadar" entre rico y pobre. El código P0135–P0147 los delata.

**3. Sensor de Temperatura del Refrigerante (ECT)**

Si el ECT reporta temperatura baja aunque el motor esté caliente, el sistema enriquece la mezcla eternamente: consumo alto, humo negro y bujías que se cargan. Piezas económicas, diagnóstico sencillo con voltímetro o escáner.

**4. Sensor de Posición del Cigüeñal (CKP)**

Sin señal del CKP el motor directamente no arranca o se apaga en movimiento. Falla por aceite en el conector, vibración o daño físico. Es un sensor crítico — cuando da problemas intermitentes los diagnostica el live data del escáner, no el ojo.

**5. Sensor de Velocidad del Vehículo (VSS)**

El VSS alimenta el velocímetro, el control de crucero y la caja automática. Cuando falla el velocímetro baila, la transmisión automática cambia de marcha "a ciegas" y el consumo sube. En autos con caja manual, muchas veces es el anillo fónico que se desgasta.

El común denominador: todos son piezas de mantenimiento preventivo que conviene revisar con el escáner antes de que fallen en el camino.`,
    date: "2025-05-20",
    readMin: 3,
    icon: "help-circle-outline",
    accentColor: "#0F2744",
    featured: true,
  },
  {
    id: "testimonio-tsuru",
    image: require("@/assets/images/blog/testimonio-tsuru.png"),
    category: "Testimonio",
    tag: "Caso real",
    title: "\"Arreglé la marcha de mi Tsuru en 30 minutos\"",
    summary:
      "Erick, mecánico independiente de Cd. Obregón, nos cuenta cómo diagnósticó y resolvió una falla de arranque sin mover el auto del garage.",
    body: `Erick García tiene 12 años trabajando como mecánico independiente en la colonia Las Fuentes de Ciudad Obregón. Le preguntamos cómo resolvió la falla de arranque de su propio Tsuru 1998 sin moverlo del garage.

**"El síntoma clásico"**

"Era viernes por la noche. Le doy vuelta a la llave y el motor no giraba. Clac y nada más. El foco de batería no encendió, así que descarté la batería — tenía carga completa con el voltímetro."

"Un clac único casi siempre es el solenoide de la marcha. Ruido de muela, o sea que intenta girar pero no puede, eso ya es el piñón o la catalina. Varios clacs rápidos: batería baja o conexiones malas."

**El diagnóstico**

"Le puse corriente directa al terminal del solenoide. Actuó solo, sin girar el motor. Eso me confirmó que el problema era interno en la marcha, no en el circuito eléctrico del switch de encendido."

"Con el solenoide fuera lo armé en la mesa: portacarbones quemados y escobillas al límite. La armadura tenía rallones pero dentro del rango aceptable."

**La reparación**

"Pedí el kit de portacarbones para la marcha Bosch del Tsuru. Me lo tuvieron en Carper ese mismo día. Total de la reparación: la pieza y 45 minutos de trabajo."

"Lo que cobra un taller por cambiar la marcha completa ronda los $2,500 con mano de obra. El kit me costó menos de $300 y lo hice yo. Para marchas con más de 150,000 km recomiendo el kit completo: portacarbones, escobillas y rodamientos. Sale más barato que cambiar de emergencia en dos años."

**El consejo de Erick**

"Antes de comprar cualquier pieza, confirma si el problema es mecánico o eléctrico. Diez minutos con un voltímetro te ahorran comprar lo que no es. Y guarda siempre el número de pieza que te sirvió — los Tsuru tienen tres variantes de marcha y no todas son iguales."`,
    date: "2025-05-05",
    readMin: 3,
    icon: "account-voice",
    accentColor: "#1A3A0F",
    featured: true,
  },
  {
    id: "alternador-vida-util",
    image: require("@/assets/images/blog/alternador-vida-util.png"),
    category: "Tips del Taller",
    tag: "Mantenimiento",
    title: "¿Cuánto dura realmente un alternador?",
    summary:
      "La vida útil varía entre 80,000 y 200,000 km dependiendo del calor, la vibración y la carga eléctrica. Aquí los factores clave.",
    body: `La respuesta corta: un alternador bien mantenido dura entre 100,000 y 180,000 km. Pero en Sonora — donde el verano supera los 45°C — ese rango se acorta.

**¿Por qué falla un alternador?**

El alternador convierte movimiento mecánico en electricidad. Tiene tres puntos débiles: los rodamientos, el regulador de voltaje y las escobillas (en los modelos que las tienen).

El calor es el principal enemigo. A temperaturas extremas, el barniz del bobinado se degrada, los rodamientos pierden lubricación y el regulador de voltaje falla antes de tiempo. Un alternador que en el norte de Europa dura 200,000 km, en Ciudad Obregón puede durar 120,000.

**Señales de alerta tempranas**

- Luz de batería encendida: el alternador no está cargando correctamente o el voltaje está fuera del rango (debería estar entre 13.8 V y 14.5 V en ralentí).
- Faros que parpadean o se ven tenues: variaciones de voltaje.
- Batería que se descarga aunque el auto esté en uso: el alternador no repone lo que consume el motor.
- Ruido de rodamiento (chiflido o zumbido que varía con el acelerador): el alternador está fallando mecánicamente.
- Olor a quemado en el compartimento del motor: puede ser el bobinado.

**Lo que prolonga su vida**

1. Mantener la banda en buen estado y con la tensión correcta — una banda floja hace que el alternador trabaje más y se caliente.
2. Verificar las conexiones del borne positivo y el cable de tierra del alternador. Oxidación = resistencia = calor.
3. No instalar accesorios de alto consumo (woofers, luces LED de trabajo) sin calcular si el alternador puede con la carga extra.
4. En climas calientes, usar el alternador de mayor amperaje disponible para tu modelo. A mayor amperaje, menos esfuerzo al 80% de la carga.

**¿Reparar o cambiar?**

Un alternador remanufacturado de calidad cuesta entre $800 y $1,800 y tiene garantía. La reparación por kit (rodamientos, regulador, escobillas) es viable si la armadura y el estátor están en buen estado — pide una prueba en banco antes de decidir.`,
    date: "2025-05-15",
    readMin: 5,
    icon: "lightning-bolt",
    accentColor: "#3D1A00",
  },
  {
    id: "agua-en-aceite",
    image: require("@/assets/images/blog/agua-en-aceite.png"),
    category: "Tips del Taller",
    tag: "Urgente",
    title: "Agua en el aceite: la emergencia que no puedes ignorar",
    summary:
      "Aceite color mayonesa en el tapón o humo blanco con olor dulce son señales de alarma. Actúa hoy o pagas el motor completo.",
    body: `Si al revisar el aceite de tu motor encuentras una pasta color crema o mayonesa pegada al tapón de llenado o en la varilla, para el auto inmediatamente. No es exageración.

**¿Qué significa?**

El refrigerante está entrando al aceite. Las causas más comunes son:
- Junta de cabeza (empaque) dañada — la más frecuente.
- Cabeza de cilindros fisurada por sobrecalentamiento.
- Bloque fisurado — el peor escenario.

El refrigerante destruye las propiedades lubricantes del aceite en cuestión de minutos de operación. Rodamientos, camisas y cigüeñal están en riesgo directo.

**Señales que acompañan el problema**

- Humo blanco y denso que huele a dulce (anticongelante) saliendo por el escape.
- El depósito de refrigerante pierde nivel constantemente sin que haya fugas visibles.
- El motor se calienta aunque el nivel de refrigerante parezca normal (la mezcla con aceite reduce su capacidad de enfriamiento).
- Burbujas en el depósito de refrigerante con el motor en ralentí (gases de combustión entrando al sistema de enfriamiento).

**Qué hacer**

1. No arranques el motor si ya detectaste el problema.
2. Lleva el auto al taller en grúa, no manejando.
3. El diagnóstico confirmatorio es una prueba de bloque de combustión (prueba de CO2 en el depósito de refrigerante). Cuesta $150–$300 y te ahorra abrir el motor si el resultado es negativo.
4. Si la junta está dañada, cambiarla a tiempo cuesta entre $3,000 y $6,000 con mano de obra. Esperar cuesta un motor reconstruido: $15,000–$40,000.

El motor sobrecalentado una vez puede dañar la cabeza sin que la temperatura llegue a zona roja en el tablero. Si tu auto sufrió algún episodio de recalentamiento, revisa el aceite al día siguiente.`,
    date: "2025-04-28",
    readMin: 4,
    icon: "alert-octagon-outline",
    accentColor: "#4A0000",
  },
  {
    id: "expo-automechanika-2025",
    image: require("@/assets/images/blog/expo-automechanika-2025.png"),
    category: "Expo & Eventos",
    tag: "Industria",
    title: "Automechanika México 2025: lo que debes saber",
    summary:
      "El mayor encuentro de la industria automotriz de América Latina regresa con más de 800 expositores. Fechas, registro y qué esperar.",
    body: `Automechanika México es la feria de la industria de autopartes y servicios automotrices más grande de América Latina. Se realiza en el Centro Citibanamex de Ciudad de México y reúne a fabricantes, distribuidores y talleres de todo el continente.

**Edición 2025**

La edición de este año se espera del 5 al 7 de noviembre de 2025. La convocatoria oficial de expositores está abierta. El evento de 2023 registró más de 25,000 visitantes profesionales y más de 800 marcas expositoras de 35 países.

**¿Qué se exhibe?**

- Refacciones OEM y aftermarket para vehículos ligeros, pesados y motos.
- Herramienta y equipo de diagnóstico: escáneres, elevadores, alineadoras.
- Lubricantes, químicos y productos de mantenimiento.
- Tecnología para taller: software de gestión, sistemas de facturación electrónica.
- Formación profesional: conferencias técnicas y talleres en vivo.

**Por qué vale la visita**

Para mecánicos y talleres independientes, Automechanika es la oportunidad de ver y tocar herramienta nueva antes de comprar, comparar precios de distribuidores directos y asistir a demostraciones técnicas gratuitas. Muchos distribuidores ofrecen precios de expo con condiciones únicas.

**Cómo registrarse**

El registro de visitantes profesionales es gratuito y se realiza en el sitio oficial de Automechanika México. Se requiere CURP y comprobante de actividad en el sector automotriz (RFC, fotos del taller o tarjeta de presentación).

Automechanika Ciudad de México es, junto con la edición de Frankfurt, una de las más importantes del mundo para fabricantes de América Latina que buscan distribución en la región.`,
    date: "2025-05-10",
    readMin: 2,
    icon: "calendar-star",
    accentColor: "#0A2A4A",
  },
  {
    id: "foro-d21-vs-d22",
    image: require("@/assets/images/blog/foro-d21-vs-d22.png"),
    category: "Foro",
    tag: "Comunidad",
    title: "Nissan D21 vs D22: ¿cuál aguanta más trabajo pesado?",
    summary:
      "La discusión que nunca termina entre mecánicos del noroeste. Motores, repuestabilidad y puntos débiles de cada generación.",
    body: `En talleres del norte de México, la pregunta sale cada semana: ¿para trabajo de campo y carga pesada, cuál conviene más, la D21 o la D22?

Recopilamos las opiniones más repetidas de foros de mecánicos y propietarios de Sonora, Sinaloa y Chihuahua.

**Nissan D21 (1986–1997) — "La Harinera"**

El motor KA24E de 2.4L o el Z24i de 2.4L son de los más simples de mantener en la región. Sus partes están en cualquier deshuese y muchos talleres tienen los especiales en el cajón.

Lo que dicen los mecánicos:
- "La D21 perdona errores de mantenimiento que la D22 no perdonaría."
- "Si se descuida el nivel de agua, la D21 avisa antes de morirse. La D22 se va de golpe."
- "Repuestos más baratos, 30–40% menos que la D22 en algunas piezas."

Puntos débiles conocidos: la junta de cabeza del KA24 no aguanta recalentamiento, el diferencial trasero es el estándar Dana 44 — bueno pero no indestructible.

**Nissan D22 (1998–2012) — "La Frontier clásica"**

El motor KA24DE (doble árbol, inyección multipunto) ofrece más potencia (143 hp vs 134 hp) y mejor eficiencia. El chasis es más rígido y la cabina más cómoda.

Lo que dicen los mecánicos:
- "La D22 con el KA24DE bien mantenida supera a la D21 en durabilidad real."
- "El problema es que la gente la compra usada sin historial y ya trae problemas escondidos."
- "Las piezas de suspensión son más caras y hay menos opciones de aftermarket."

El sensor de posición del cigüeñal (CKP) es el talón de Aquiles más conocido de la D22: falla sin avisar y el motor se apaga en movimiento. Tener uno de repuesto en la guantera es práctica común entre los que trabajan en campo abierto.

**El consenso en el norte**

Para uso mixto ciudad-campo con carga frecuente y acceso limitado a talleres especializados: D21. Para quien puede darle mantenimiento preventivo programado y quiere más potencia y confort: D22.

La realidad es que la D21 bien cuidada y la D22 bien mantenida duran más de 300,000 km. El factor decisivo suele ser el historial del vehículo, no el modelo.`,
    date: "2025-04-20",
    readMin: 4,
    icon: "forum-outline",
    accentColor: "#2A0A4A",
  },
  {
    id: "refacciones-originales-vs-alternas",
    image: require("@/assets/images/blog/refacciones-originales-vs-alternas.png"),
    category: "Noticias",
    tag: "Opinión",
    title: "Originales vs genéricas: la verdad que nadie te dice",
    summary:
      "No siempre la original es la mejor opción. El secreto está en quién fabricó realmente la pieza que el fabricante puso en la línea.",
    body: `"Siempre compra original" es el consejo más repetido en talleres, pero la realidad del mercado de autopartes en México es más compleja — y más a tu favor de lo que crees.

**OEM no es lo que crees**

OEM significa "Original Equipment Manufacturer", es decir, el fabricante que hizo la pieza que el armador puso en el auto de fábrica. Lo que la mayoría no sabe: Nissan, Toyota o General Motors no fabrican la mayoría de sus refacciones. Las compran a proveedores especializados.

El sensor MAF de tu Tsuru "original" lo fabrica Hitachi. El alternador del Aveo "original" lo hace Valeo. El filtro de aceite del Hilux "original" lo produce Denso. Y esos mismos fabricantes también venden sus piezas en el mercado de reposición con su propia marca, a un precio 20–40% menor que la caja con el logo del armador.

**¿Cuándo sí importa la calidad?**

Para piezas de seguridad activa — balatas, discos, mangueras de freno, rótulas y rotulas — la calidad del material es crítica. Aquí conviene pagar más y elegir una marca con trayectoria certificada (Brembo, Monroe, Moog, TRW).

Para piezas de consumo que se reemplazan en cada servicio (filtros, bujías, correas) la diferencia entre una buena genérica y la "original" es mínima si el fabricante tiene certificación ISO.

Para electrónica (sensores, módulos de control) la pieza barata de origen desconocido puede funcionar semanas y fallar sin dejar código de error — el peor escenario para un taller.

**La regla práctica**

Pregunta al distribuidor quién fabricó la pieza, no solo qué caja trae. Un proveedor de confianza te dice si la pieza alternativa viene de la misma línea de producción que la original. Si no lo sabe, eso también te dice algo.`,
    date: "2025-04-08",
    readMin: 5,
    icon: "scale-balance",
    accentColor: "#0A3A4A",
  },
  {
    id: "bomba-gasolina-sintomas",
    image: require("@/assets/images/blog/bomba-gasolina-sintomas.png"),
    category: "Sabías Que",
    tag: "Prevención",
    title: "Tu bomba de gasolina avisa antes de morir",
    summary:
      "Jaloneos al subir pendientes, arranque difícil en caliente y pérdida repentina de potencia. Señales que no debes ignorar.",
    body: `La bomba de gasolina es una pieza que la mayoría ignora hasta que el auto se queda varado. Pero casi siempre da señales semanas antes de fallar definitivamente.

**¿Cómo funciona?**

La bomba de gasolina moderna está sumergida dentro del tanque. Trabaja constantemente que el motor está en marcha, empujando combustible a presión (entre 40 y 65 PSI en sistemas de inyección multipunto) hacia los inyectores.

Las bombas de bajo rendimiento no fallan de golpe — primero pierden capacidad de mantener presión, especialmente cuando el motor demanda mucho combustible.

**Las señales de alerta**

1. **Jaloneos al acelerar fuerte o subir pendientes.** El motor pide más combustible y la bomba no puede entregar la presión necesaria. El motor "tartamudea" porque los inyectores reciben menos de lo que necesitan.

2. **Arranque difícil cuando el motor está caliente.** Una bomba débil mantiene la presión estática cuando el auto está parado, pero cuando el motor se apaga caliente el combustible en la línea se vaporiza. Al arrancar, la bomba tiene que recuperar presión — si está gastada, tarda más de lo normal.

3. **Motor que se apaga a velocidad constante en carretera.** La bomba puede funcionar bien a bajas demandas pero colapsar en autopista sostenida.

4. **Ruido de zumbido o quejido constante desde el tanque.** Las bombas sanas hacen un zumbido suave casi imperceptible. Un quejido o chiflido es la bomba trabajando contra resistencia — rodamiento desgastado o filtro de la bomba tapado.

**El diagnóstico correcto**

Con un manómetro de combustible (se conecta en el riel de inyectores) puedes medir la presión en ralentí y durante aceleración. Si la presión baja de las especificaciones del fabricante bajo carga, la bomba está fallando.

No descartes el filtro de gasolina en línea — un filtro tapado hace que la bomba trabaje el doble y se desgaste prematuramente. Si no sabes cuándo se cambió el último filtro, cámbialo antes de reemplazar la bomba.`,
    date: "2025-04-15",
    readMin: 3,
    icon: "gas-station-outline",
    accentColor: "#2A2000",
  },
  {
    id: "hilux-partes-mas-pedidas",
    image: require("@/assets/images/blog/hilux-partes-mas-pedidas.png"),
    category: "Noticias",
    tag: "Mercado",
    title: "Toyota Hilux: las piezas más pedidas en Sonora en 2025",
    summary:
      "Bomba de agua, banda de tiempo y sensor MAP lideran la lista este año. ¿Qué tienen en común? Todas son de mantenimiento preventivo.",
    body: `La Toyota Hilux es la camioneta de trabajo más popular del noroeste de México. En talleres de Ciudad Obregón, Hermosillo y Los Mochis concentra una parte significativa de las reparaciones. Estas son las piezas que más rotan en 2025.

**1. Kit de distribución (banda, tensores y bomba de agua)**

La Hilux diésel (1KD-FTV y 2KD-FTV) tiene intervalo de cambio de banda de tiempo de 100,000 km o 5 años. Con las flotillas de campo que trabajan en Sonora fácilmente acumulando 30,000–40,000 km al año, ese intervalo llega más rápido de lo que parece.

El costo del kit completo con mano de obra varía entre $6,000 y $9,500 dependiendo del año. Ignorarlo significa un motor doblado cuando la banda truena — reparación de $30,000 o más.

**2. Sensor MAP (Presión del Múltiple de Admisión)**

El motor diésel 1KD es sensible a la calidad del sensor MAP. Cuando falla, el motor pierde potencia, el turbo no responde correctamente y el consumo sube. Es una pieza de $300–$600 que muchos talleres reemplazan como primer paso cuando hay queja de rendimiento bajo.

**3. Inyectores (limpieza y calibración)**

El diésel de bajo azufre disponible en México (15 ppm ultra bajo en zonas urbanas, pero variable en comunidades rurales) puede afectar los inyectores en flotas que cargan en bombas de carretera. La limpieza en ultrasonido y recalibración en banco alarga la vida del inyector 50,000–80,000 km adicionales a un costo de $1,500–$2,500 para los cuatro.

**4. Pastillas y discos de freno (eje delantero)**

El peso de carga de la Hilux (hasta 1,000 kg) accelera el desgaste de frenos, especialmente en rutas de terracería con frenos frecuentes. Las pastillas delanteras se revisan a los 40,000 km en uso severo.

**5. Amortiguadores traseros**

En uso de campo con carga constante, los amortiguadores traseros de la Hilux tienen una vida útil real de 60,000–80,000 km. El síntoma clásico: rebote excesivo al salir de un tope y oscilación al frenar cargado.

La tendencia de 2025 es un mayor interés en kits de mantenimiento completos — taller y propietarios que prefieren cambiar todo el sistema en una intervención en lugar de ir pieza por pieza.`,
    date: "2025-04-01",
    readMin: 2,
    icon: "car-pickup",
    accentColor: "#0A2A10",
  },
];

export const FEATURED_POSTS = BLOG_POSTS.filter((p) => p.featured);

export function formatBlogDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  return `${day} ${months[month - 1]} ${year}`;
}
