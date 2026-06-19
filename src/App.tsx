import { useEffect, useMemo, useState } from "react";
import CrearOrdenModal from "./components/CrearOrdenModal";
import Header from "./components/Header";
import Login from "./pages/Login";
import {
  actualizarEstadoSharePoint,
  confirmarAlistoSharePoint,
  crearOrdenSharePoint,
  obtenerOrdenes,
  obtenerProductosCatalogo,
 
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

function ordenarProductosAZ(productos: Producto[]): Producto[] {
  return [...productos].sort((a, b) => {
    const nombreA = (a.nombre || a.descripcion || "").trim();
    const nombreB = (b.nombre || b.descripcion || "").trim();

    const comparacionNombre = nombreA.localeCompare(nombreB, "es", {
      sensitivity: "base",
      numeric: true,
    });

    if (comparacionNombre !== 0) return comparacionNombre;

    return String(a.codigo || "").localeCompare(String(b.codigo || ""), "es", {
      sensitivity: "base",
      numeric: true,
    });
  });
}

function normalizarOrdenes(data: Orden[]): Orden[] {
  return data.map((orden) => ({
    ...orden,
    productos: ordenarProductosAZ(
      orden.productos.map((producto) => ({
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
        codigo: producto.codigo || "",
      }))
    ),
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
  const usuarioLogueado = localStorage.getItem("alisto-user");

  const [vista, setVista] = useState<Vista>("bodega");
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [productosCatalogo, setProductosCatalogo] = useState<Producto[]>([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Orden | null>(null);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string | null>(null);
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);

  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usuarioLogueado) return;

    let timeout: ReturnType<typeof setTimeout>;

    const cerrarPorInactividad = () => {
      localStorage.removeItem("alisto-user");
      sessionStorage.removeItem("alisto-user");
      window.location.href = "/";
    };

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(cerrarPorInactividad, 10 * 60 * 1000);
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer);
    window.addEventListener("touchstart", resetTimer);

    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer);
      window.removeEventListener("touchstart", resetTimer);
    };
  }, [usuarioLogueado]);

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
      setError("No se pudieron cargar las órdenes desde SharePoint.");
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

 

  useEffect(() => {
    if (!usuarioLogueado) return;

    localStorage.removeItem("sistema-alisto-ordenes-locales");
    cargarOrdenes();
    cargarProductos();
  }, [usuarioLogueado]);

  if (!usuarioLogueado) {
    return <Login />;
  }

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
      productos: ordenarProductosAZ(productos),
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
      setError("No se pudo crear la orden en SharePoint.");
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
    const productosOrdenados = ordenarProductosAZ(productosActualizados);

    setOrdenes((prev) =>
      prev.map((orden) =>
        orden.numero === numero ? { ...orden, productos: productosOrdenados } : orden
      )
    );

    setOrdenSeleccionada((prev) =>
      prev && prev.numero === numero ? { ...prev, productos: productosOrdenados } : prev
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
          
          
          cargando={cargando}
          error={error}
        />
      )}
    </div>
  );
}

export default App;