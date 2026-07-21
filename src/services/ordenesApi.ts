import type { Estado, Orden, Producto } from "../types/orden";

const API_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001/api/sharepoint`;

const SYNC_API_URL =
  import.meta.env.VITE_SYNC_API_URL ||
  API_URL;

type OrdenSP = {
  spId?: string | number;
  IdOrden?: string | number;
  Title?: string;
  Sucursal?: string;
  Estado?: string;
  FechaCreacion?: string;
  FechaEntrega?: string;
  Origen?: string;
  Chofer?: string;
  Camion?: string;
  DiaRuta?: string;
  Confirmada?: boolean;
};

type DetalleSP = {
  spId?: string | number;
  IdOrden?: string | number;
  IdOrdenLookupId?: string | number;
  Producto?: string;
  Codigo?: string;
  Cantidad?: string | number;
  CantidadOriginal?: string | number;
  PesoUnitarioKg?: string | number;
  PesoTotalKg?: string | number;
  Medida?: string;
};

type FaltanteSP = {
  IdOrden?: string | number;
  Producto?: string;
  CantidadFaltante?: string | number;
};

type ProductoSP = {
  spId?: string | number;
  Codigo?: string | number;
  Producto?: string;
  UnidadMedida?: string;
  PesoUnitarioKg?: string | number;
  Activo?: boolean | string | number;
};

const ESTADO_PREPARACION_INICIAL: Producto["estadoPreparacion"] = "";

function limpiarOrden(valor?: string | number) {
  return String(valor || "").replace("ORD-", "").trim();
}

function mapearEstado(estado?: string): Estado {
  switch (estado) {
    case "Pendiente":
    case "Alistando":
    case "Listo":
    case "Pendiente de Carga":
    case "En Camión":
    case "En Entrega":
    case "Entregado":
      return estado;
    default:
      return "Pendiente";
  }
}

function numeroOrden(orden: OrdenSP) {
  return limpiarOrden(orden.IdOrden || orden.Title || orden.spId);
}

function mapearProducto(
  p: DetalleSP,
  faltantes: FaltanteSP[] = [],
  idOrden?: string
): Producto {
  const cantidad = Number(p.Cantidad || 0);
  const codigo = String(p.Codigo || "");
  const nombre = String(p.Producto || "Producto sin nombre");

  const faltante = faltantes.find(
    (f) =>
      limpiarOrden(f.IdOrden) === limpiarOrden(idOrden) &&
      String(f.Producto || "").trim().toLowerCase() ===
        nombre.trim().toLowerCase()
  );

  const cantidadFaltante = Number(faltante?.CantidadFaltante || 0);

  return {
    nombre,
    descripcion: nombre,
    codigo,
    cantidad,
    cantidadOriginal: Number(
      p.CantidadOriginal || cantidad + cantidadFaltante || cantidad
    ),
    pesoUnitarioKg: Number(p.PesoUnitarioKg || 0),
    pesoTotalKg: Number(p.PesoTotalKg || 0),
    unidadMedida: String(p.Medida || "UND"),
    faltante: false,
    cantidadFaltante,
    estadoPreparacion: ESTADO_PREPARACION_INICIAL,
  };
}

async function leerJson(respuesta: Response) {
  const texto = await respuesta.text();

  try {
    return texto ? JSON.parse(texto) : null;
  } catch {
    return texto;
  }
}

export async function sincronizarSql() {
  const respuesta = await fetch(`${SYNC_API_URL}/sync-sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      top: 50,
      origen: "sistema-alisto-web",
    }),
  });

  if (!respuesta.ok) {
    throw new Error(
      `No se pudo sincronizar SQL: ${await respuesta.text()}`
    );
  }

  const texto = await respuesta.text();

  if (!texto) {
    return { ok: true };
  }

  try {
    return JSON.parse(texto);
  } catch {
    return { ok: true, respuesta: texto };
  }
}

export async function sincronizarProductosSql() {
  const respuesta = await fetch(`${API_URL}/sync-productos-sql`, {
    method: "POST",
  });

  if (!respuesta.ok) {
    throw new Error(
      `No se pudo sincronizar productos: ${await respuesta.text()}`
    );
  }

  return respuesta.json();
}

export async function obtenerProductosCatalogo(): Promise<Producto[]> {
  const respuesta = await fetch(`${API_URL}/productos`);

  if (!respuesta.ok) {
    throw new Error("No se pudo cargar el catálogo de productos");
  }

  const json = await respuesta.json();

  const productos: ProductoSP[] =
    json.productos || json.items || json.value || [];

  return productos
    .filter((p) => {
      return String(p.Codigo || "").trim() || String(p.Producto || "").trim();
    })
    .map<Producto>((p) => {
      const nombre = String(p.Producto || "Producto sin nombre");
      const pesoUnitarioKg = Number(p.PesoUnitarioKg || 0);

      return {
        nombre,
        descripcion: nombre,
        codigo: String(p.Codigo || ""),
        cantidad: 1,
        cantidadOriginal: 1,
        pesoUnitarioKg,
        pesoTotalKg: pesoUnitarioKg,
        unidadMedida: String(p.UnidadMedida || "UND"),
        faltante: false,
        cantidadFaltante: 0,
        estadoPreparacion: ESTADO_PREPARACION_INICIAL,
      };
    })
    .sort((a, b) =>
      `${a.codigo} ${a.nombre}`.localeCompare(`${b.codigo} ${b.nombre}`)
    );
}

export async function crearOrdenSharePoint(orden: Orden) {
  const ordenRes = await fetch(`${API_URL}/orden`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: orden.numero,
      origen: orden.cliente || "Manual",
      sucursal: orden.sucursal,
      estado: orden.estado || "Pendiente",
      fechaCreacion: orden.fecha || new Date().toISOString(),
      chofer: orden.chofer || "",
      camion: orden.camion || "",
      diaRuta: orden.diaRuta || orden.rutaAsignada || "",
      confirmada: orden.confirmada || false,
    }),
  });

  if (!ordenRes.ok) {
    throw new Error(`No se pudo crear la orden: ${await ordenRes.text()}`);
  }

  for (const producto of orden.productos) {
    const cantidad = Number(producto.cantidad || 0);
    const cantidadOriginal = Number(producto.cantidadOriginal ?? cantidad);
    const pesoUnitarioKg = Number(producto.pesoUnitarioKg || 0);

    const detalleRes = await fetch(`${API_URL}/detalle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idOrden: orden.numero,
        producto: producto.nombre || producto.descripcion || "Producto sin nombre",
        codigo: producto.codigo || "",
        cantidad,
        cantidadOriginal,
        pesoUnitarioKg,
        pesoTotalKg: cantidad * pesoUnitarioKg,
        medida: producto.unidadMedida || "UND",
      }),
    });

    if (!detalleRes.ok) {
      throw new Error(`No se pudo crear detalle: ${await detalleRes.text()}`);
    }
  }

  return true;
}

export async function actualizarEstadoSharePoint(
  idOrden: string,
  estado: Estado,
  extras?: {
    chofer?: string;
    camion?: string;
    diaRuta?: string;
    confirmada?: boolean;
  }
) {
  const respuesta = await fetch(`${API_URL}/estado`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idOrden,
      estado,
      chofer: extras?.chofer,
      camion: extras?.camion,
      diaRuta: extras?.diaRuta,
      confirmada: extras?.confirmada,
    }),
  });

  if (!respuesta.ok) {
    throw new Error(`No se pudo actualizar estado: ${await respuesta.text()}`);
  }

  return leerJson(respuesta);
}

export async function confirmarAlistoSharePoint(
  idOrden: string,
  productos: Producto[]
) {
  const respuesta = await fetch(`${API_URL}/alisto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idOrden, productos }),
  });

  if (!respuesta.ok) {
    throw new Error(`No se pudo confirmar alisto: ${await respuesta.text()}`);
  }

  return leerJson(respuesta);
}

export async function guardarRutaSharePoint(payload: {
  dia: string;
  camion: string;
  chofer: string;
  confirmada: boolean;
  ordenes: Array<{
    orden: string;
    sucursal: string;
    posicion: number;
    camion: string;
  }>;
}) {
  const rutaRes = await fetch(`${API_URL}/ruta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dia: payload.dia,
      camion: payload.camion,
      chofer: payload.chofer,
      confirmada: payload.confirmada,
      fecha: new Date().toISOString(),
    }),
  });

  if (!rutaRes.ok) {
    throw new Error(`No se pudo guardar ruta: ${await rutaRes.text()}`);
  }

  for (const detalle of payload.ordenes) {
    const detalleRes = await fetch(`${API_URL}/ruta-detalle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(detalle),
    });

    if (!detalleRes.ok) {
      throw new Error(
        `No se pudo guardar detalle ruta: ${await detalleRes.text()}`
      );
    }
  }

  return true;
}

export async function obtenerOrdenes(fechaEntregadas?: string): Promise<Orden[]> {
  const params = new URLSearchParams();
  if (fechaEntregadas) {
    params.set("fechaEntregadas", fechaEntregadas);
  }

  const query = params.toString();
  const respuesta = await fetch(`${API_URL}/carga${query ? `?${query}` : ""}`);

  if (!respuesta.ok) {
    throw new Error("No se pudieron cargar las órdenes desde SharePoint");
  }

  const json = await respuesta.json();
  const ordenesSP: OrdenSP[] = json.ordenes || [];
  const detallesSP: DetalleSP[] = json.detalles || [];
  const faltantesSP: FaltanteSP[] = json.faltantes || [];

  const detallesPorOrden = new Map<string, DetalleSP[]>();
  const detallesPorLookup = new Map<string, DetalleSP[]>();
  const faltantesPorOrden = new Map<string, FaltanteSP[]>();

  for (const detalle of detallesSP) {
    const idOrden = limpiarOrden(detalle.IdOrden);
    const lookupId = limpiarOrden(detalle.IdOrdenLookupId);

    if (idOrden) {
      const lista = detallesPorOrden.get(idOrden) || [];
      lista.push(detalle);
      detallesPorOrden.set(idOrden, lista);
    }

    if (lookupId) {
      const lista = detallesPorLookup.get(lookupId) || [];
      lista.push(detalle);
      detallesPorLookup.set(lookupId, lista);
    }
  }

  for (const faltante of faltantesSP) {
    const idOrden = limpiarOrden(faltante.IdOrden);
    if (!idOrden) continue;

    const lista = faltantesPorOrden.get(idOrden) || [];
    lista.push(faltante);
    faltantesPorOrden.set(idOrden, lista);
  }

  const ordenesMap = new Map<string, Orden>();

  for (const orden of ordenesSP) {
    const numero = numeroOrden(orden);
    if (!numero) continue;

    const ordenSpId = limpiarOrden(orden.spId);
    const detallesOrden = [
      ...(detallesPorOrden.get(numero) || []),
      ...(detallesPorLookup.get(ordenSpId) || []),
    ];

    const detallesUnicos = new Map<string, DetalleSP>();
    for (const detalle of detallesOrden) {
      const clave = String(
        detalle.spId ||
          `${detalle.IdOrden || ""}|${detalle.Codigo || ""}|${detalle.Producto || ""}`
      );
      detallesUnicos.set(clave, detalle);
    }

    const faltantesOrden = faltantesPorOrden.get(numero) || [];
    const productos: Producto[] = Array.from(detallesUnicos.values()).map(
      (detalle) => mapearProducto(detalle, faltantesOrden, numero)
    );

    const ordenMapeada: Orden = {
      numero,
      sucursal: orden.Sucursal || "Sin sucursal",
      cliente: orden.Origen || "SQL",
      fecha: orden.FechaCreacion || new Date().toISOString(),
      fechaEntrega: orden.FechaEntrega || "",
      estado: mapearEstado(orden.Estado),
      chofer: orden.Chofer || "",
      camion: orden.Camion || "",
      diaRuta: orden.DiaRuta || "",
      confirmada: Boolean(orden.Confirmada),
      rutaAsignada: orden.DiaRuta || "",
      productos,
    };

    const existente = ordenesMap.get(numero);

    if (!existente) {
      ordenesMap.set(numero, ordenMapeada);
      continue;
    }

    const productosExistentes = existente.productos.length;
    const productosNuevos = ordenMapeada.productos.length;

    if (productosNuevos > productosExistentes) {
      ordenesMap.set(numero, ordenMapeada);
      continue;
    }

    const fechaExistente = new Date(existente.fecha).getTime();
    const fechaNueva = new Date(ordenMapeada.fecha).getTime();

    if (
      productosNuevos === productosExistentes &&
      !Number.isNaN(fechaNueva) &&
      (Number.isNaN(fechaExistente) || fechaNueva > fechaExistente)
    ) {
      ordenesMap.set(numero, ordenMapeada);
    }
  }

  return Array.from(ordenesMap.values()).sort((a, b) => {
    const fechaA = new Date(a.fecha).getTime();
    const fechaB = new Date(b.fecha).getTime();

    if (!Number.isNaN(fechaA) && !Number.isNaN(fechaB)) {
      return fechaB - fechaA;
    }

    return Number(b.numero) - Number(a.numero);
  });
}

type UsuarioAlistoSP = {
  Usuario?: string;
  Password?: string;
  Activo?: boolean | string | number;
};

export async function validarUsuario(usuario: string, password: string) {
  console.log("API_URL LOGIN:", API_URL);
console.log("Usuario digitado:", usuario);
  const respuesta = await fetch(`${API_URL}/usuarios`);

  if (!respuesta.ok) {
    throw new Error("No se pudieron cargar los usuarios");
  }

  const json = await respuesta.json();

  const usuarios: UsuarioAlistoSP[] =
    json.usuarios || json.items || json.value || [];
    console.log("Usuarios cargados:", usuarios.map(u => ({
  Usuario: u.Usuario,
  Password: u.Password,
  Activo: u.Activo,
})));
    

  return usuarios.some((u) => {
    const activo =
      u.Activo === true ||
      u.Activo === 1 ||
      String(u.Activo).toLowerCase() === "true" ||
      String(u.Activo).toLowerCase() === "sí" ||
      String(u.Activo).toLowerCase() === "si";

    return (
      activo &&
      String(u.Usuario || "").trim().toLowerCase() === usuario.trim().toLowerCase() &&
      String(u.Password || "").trim() === password.trim()
    );
  });
}