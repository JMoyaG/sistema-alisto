import { useEffect, useMemo, useState } from "react";
import CrearOrdenModal from "./components/CrearOrdenModal";
import Header from "./components/Header";
import {
  actualizarEstadoSharePoint,
  confirmarAlistoSharePoint,
  crearOrdenSharePoint,
  obtenerOrdenes,
  obtenerProductosCatalogo,
  sincronizarSql,
} from "./services/ordenesApi";
import Home from "./pages/Home";
import OrdenDetalle from "./pages/OrdenDetalle";
import OrdenesSucursal from "./pages/OrdenesSucursal";
import ResumenKanban from "./pages/ResumenKanban";
import Faltantes from "./pages/Faltantes";
import PlaneacionRutas from "./pages/PlaneacionRutas";
import type { Estado, Orden, Producto, Vista } from "./types/orden";
import { inferirPesoUnitarioKg } from "./utils/peso";

const SUCURSALES_BASE = [
  "EL CRISTO",
  "EL GUARCO",
  "TIERRA BLANCA",
  "SAN RAFAEL IRAZU",
  "COT",
  "CAPELLADES",
  "LLANO GRANDE",
  "PACAYAS",
  "CIPRESES",
  "SAN GERARDO",
];

function normalizarOrdenes(data: Orden[]): Orden[] {
  return data.map((orden) => ({
    ...orden,
    productos: orden.productos.map((producto) => ({
      ...producto,
      cantidad: Number(producto.cantidad || 0),
      cantidadOriginal: Number(producto.cantidadOriginal ?? producto.cantidad ?? 0),
      faltante: Boolean(producto.faltante),
      cantidadFaltante: Number(producto.cantidadFaltante || 0),
      estadoPreparacion: producto.estadoPreparacion || "",
      unidadMedida: producto.unidadMedida || "UND",
      pesoUnitarioKg: inferirPesoUnitarioKg(
        producto.nombre,
        producto.descripcion,
        producto.unidadMedida,
        producto.pesoUnitarioKg
      ),
      codigo: producto.codigo,
    })),
  }));
}

function crearNumeroOrden() {
  const fecha = new Date();
  const parteFecha = fecha.toISOString().slice(0, 10).replaceAll("-", "");
  const parteHora =
    String(fecha.getHours()).padStart(2, "0") +
    String(fecha.getMinutes()).padStart(2, "0") +
    String(fecha.getSeconds()).padStart(2, "0");

  return `${parteFecha}-${parteHora}`;
}

function App() {
  const [vista, setVista] = useState<Vista>("bodega");
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [productosCatalogo, setProductosCatalogo] = useState<Producto[]>([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Orden | null>(null);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string | null>(null);
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarOrdenes = async () => {
    try {
      setCargando(true);
      const data = await obtenerOrdenes();
      const normalizadas = normalizarOrdenes(data);
      setOrdenes(normalizadas);

      setOrdenSeleccionada((actual) => {
        if (!actual) return actual;
        return normalizadas.find((orden) => orden.numero === actual.numero) || null;
      });

      setError(null);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las órdenes desde SharePoint. Revisá que el backend esté encendido.");
    } finally {
      setCargando(false);
    }
  };

  const cargarProductos = async () => {
    try {
      const productos = await obtenerProductosCatalogo();
      setProductosCatalogo(productos);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el catálogo de productos desde SharePoint.");
    }
  };

  const actualizarSql = async () => {
  try {
    setSincronizando(true);
    setError(null);

    await sincronizarSql();
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await cargarOrdenes();
    await cargarProductos();
    setError(null);
    setOrdenSeleccionada(null);
    setSucursalSeleccionada(null);
    setVista("bodega");
  } catch (err) {
    console.error(err);
    setError("No se pudo actualizar desde SQL. Revisá la consola del backend.");
  } finally {
    setSincronizando(false);
  }
};

  useEffect(() => {
    localStorage.removeItem("sistema-alisto-ordenes-locales");
    cargarOrdenes();
    cargarProductos();
  }, []);

  const ordenesBodega = ordenes.filter(
    (o) =>
      o.estado !== "En Camión" &&
      o.estado !== "En Entrega" &&
      o.estado !== "Entregado"
  );

  const ordenesChofer = ordenes.filter(
    (o) => o.estado === "En Camión" || o.estado === "En Entrega"
  );

  const listaVista = vista === "bodega" ? ordenesBodega : ordenesChofer;

  const sucursales = useMemo(() => {
    return Array.from(
      new Set(
        [...SUCURSALES_BASE, ...listaVista.map((orden) => orden.sucursal)].filter(
          (sucursal) => sucursal && sucursal !== "Sin sucursal"
        )
      )
    );
  }, [listaVista]);

  const ordenesSucursal = sucursalSeleccionada
    ? listaVista.filter((orden) => orden.sucursal === sucursalSeleccionada)
    : [];

  const cambiarVista = (nuevaVista: Vista) => {
    setVista(nuevaVista);
    setOrdenSeleccionada(null);
    setSucursalSeleccionada(null);
  };

  const abrirSucursal = (sucursal: string) => {
    const tieneOrdenes = listaVista.some((orden) => orden.sucursal === sucursal);
    if (tieneOrdenes) setSucursalSeleccionada(sucursal);
  };

  const crearOrden = async (sucursal: string, productos: Producto[]) => {
    const nuevaOrden: Orden = {
      numero: crearNumeroOrden(),
      sucursal,
      cliente: "Manual",
      fecha: new Date().toISOString(),
      estado: "Pendiente",
      productos,
    };

    try {
      setGuardandoOrden(true);
      setError(null);
      await crearOrdenSharePoint(nuevaOrden);
      await cargarOrdenes();
      await cargarProductos();
      setVista("bodega");
      setSucursalSeleccionada(null);
      setOrdenSeleccionada(null);
      setModalCrearAbierto(false);
    } catch (err) {
      console.error(err);
      setError("No se pudo crear la orden en SharePoint. Revisá la consola del backend.");
    } finally {
      setGuardandoOrden(false);
    }
  };

  const actualizarEstado = async (numero: string, nuevoEstado: Estado) => {
    try {
      setError(null);
      await actualizarEstadoSharePoint(numero, nuevoEstado);
      await cargarOrdenes();
      setOrdenSeleccionada(null);
      setSucursalSeleccionada(null);

      if (
        nuevoEstado === "En Camión" ||
        nuevoEstado === "En Entrega" ||
        nuevoEstado === "Entregado"
      ) {
        setVista("chofer");
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo actualizar el estado en SharePoint.");
    }
  };

  const confirmarAlisto = async (numero: string, productosFinales: Producto[]) => {
    try {
      setError(null);
      await confirmarAlistoSharePoint(numero, productosFinales);
      await cargarOrdenes();
      setOrdenSeleccionada(null);
      setSucursalSeleccionada(null);
    } catch (err) {
      console.error(err);
      setError("No se pudo confirmar el alisto en SharePoint.");
    }
  };

  const actualizarProductosOrden = (numero: string, productosActualizados: Producto[]) => {
    setOrdenes((prev) =>
      prev.map((orden) =>
        orden.numero === numero ? { ...orden, productos: productosActualizados } : orden
      )
    );

    setOrdenSeleccionada((prev) =>
      prev && prev.numero === numero ? { ...prev, productos: productosActualizados } : prev
    );
  };

  return (
    <div className="app-shell">
      <Header vista={vista} setVista={cambiarVista} />

      <CrearOrdenModal
        abierto={modalCrearAbierto}
        productosDisponibles={productosCatalogo}
        onCerrar={() => setModalCrearAbierto(false)}
        onCrearOrden={crearOrden}
      />

      {guardandoOrden && (
        <div className="notice-card" style={{ margin: "16px" }}>
          Guardando orden en SharePoint...
        </div>
      )}

      {ordenSeleccionada ? (
        <OrdenDetalle
          vista={vista}
          orden={ordenSeleccionada}
          volver={() => setOrdenSeleccionada(null)}
          actualizarEstado={actualizarEstado}
          actualizarProductosOrden={actualizarProductosOrden}
          confirmarAlisto={confirmarAlisto}
        />
      ) : sucursalSeleccionada ? (
        <OrdenesSucursal
          vista={vista}
          sucursal={sucursalSeleccionada}
          ordenes={ordenesSucursal}
          volver={() => setSucursalSeleccionada(null)}
          abrirOrden={setOrdenSeleccionada}
        />
      ) : vista === "resumen" ? (
        <ResumenKanban ordenes={ordenes} abrirOrden={setOrdenSeleccionada} />
      ) : vista === "faltantes" ? (
        <Faltantes ordenes={ordenes} abrirOrden={setOrdenSeleccionada} />
      ) : vista === "rutas" ? (
        <PlaneacionRutas ordenes={ordenes} abrirOrden={setOrdenSeleccionada} />
      ) : (
        <Home
          vista={vista}
          ordenesBodega={ordenesBodega}
          ordenesChofer={ordenesChofer}
          sucursales={sucursales}
          abrirSucursal={abrirSucursal}
          abrirCrearOrden={() => setModalCrearAbierto(true)}
          actualizarSql={actualizarSql}
          sincronizando={sincronizando}
          cargando={cargando}
          error={error}
        />
      )}
    </div>
  );
}

export default App;