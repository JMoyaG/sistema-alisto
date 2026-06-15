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

function detallePerteneceAOrden(detalle: DetalleSP, orden: OrdenSP) {
  const ordenNumero = numeroOrden(orden);
  const ordenSpId = limpiarOrden(orden.spId);
  const detalleIdOrden = limpiarOrden(detalle.IdOrden);
  const detalleLookupId = limpiarOrden(detalle.IdOrdenLookupId);

  return detalleIdOrden === ordenNumero || detalleLookupId === ordenSpId;
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

export async function obtenerOrdenes(): Promise<Orden[]> {
  const [ordenesRes, detallesRes, faltantesRes] = await Promise.all([
    fetch(`${API_URL}/ordenes`),
    fetch(`${API_URL}/detalles`),
    fetch(`${API_URL}/faltantes`),
  ]);

  if (!ordenesRes.ok) {
    throw new Error("No se pudieron cargar las órdenes desde SharePoint");
  }

  if (!detallesRes.ok) {
    throw new Error("No se pudieron cargar los detalles desde SharePoint");
  }

  const ordenesJson = await ordenesRes.json();
  const detallesJson = await detallesRes.json();
  const faltantesJson = faltantesRes.ok
    ? await faltantesRes.json()
    : { faltantes: [] };

  const ordenesSP: OrdenSP[] = ordenesJson.ordenes || [];
  const detallesSP: DetalleSP[] = detallesJson.detalles || [];
  const faltantesSP: FaltanteSP[] = faltantesJson.faltantes || [];

  return ordenesSP
    .map<Orden>((orden) => {
      const numero = numeroOrden(orden);

      const productos: Producto[] = detallesSP
        .filter((detalle) => detallePerteneceAOrden(detalle, orden))
        .map((detalle) => mapearProducto(detalle, faltantesSP, numero));

      return {
        numero,
        sucursal: orden.Sucursal || "Sin sucursal",
        cliente: orden.Origen || "SQL",
        fecha: orden.FechaCreacion || new Date().toISOString(),
        estado: mapearEstado(orden.Estado),
        chofer: orden.Chofer || "",
        camion: orden.Camion || "",
        diaRuta: orden.DiaRuta || "",
        confirmada: Boolean(orden.Confirmada),
        rutaAsignada: orden.DiaRuta || "",
        productos,
      };
    })
    .filter((orden) => orden.numero);
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