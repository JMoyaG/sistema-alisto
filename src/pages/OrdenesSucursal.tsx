import { useMemo, useState } from "react";
import { ArrowLeft, Calendar, CheckCircle, ChevronRight, Package, Search, User, X } from "lucide-react";
import type { Orden, Vista } from "../types/orden";
import { estadoBadgeClase, estadoClase } from "../utils/estado";

type Props = {
  vista: Vista;
  sucursal: string;
  ordenes: Orden[];
  volver: () => void;
  abrirOrden: (orden: Orden) => void;
  entregarDirecto: (numeros: string[]) => void | Promise<void>;
};

function formatearFecha(fecha: string) {
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return fecha;

  return date.toLocaleString("es-CR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrdenesSucursal({ vista, sucursal, ordenes, volver, abrirOrden, entregarDirecto }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  const ordenesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase().replace(/^ord-/, "");
    if (!termino) return ordenes;
    return ordenes.filter((orden) =>
      String(orden.numero).toLowerCase().includes(termino) ||
      String(orden.cliente || "").toLowerCase().includes(termino)
    );
  }, [busqueda, ordenes]);

  const alternarSeleccion = (numero: string) => {
    setSeleccionadas((actuales) =>
      actuales.includes(numero)
        ? actuales.filter((item) => item !== numero)
        : [...actuales, numero]
    );
  };

  const confirmarEntregaDirecta = async () => {
    if (!seleccionadas.length) return;
    const texto = seleccionadas.length === 1 ? "esta orden" : `estas ${seleccionadas.length} órdenes`;
    if (!window.confirm(`¿Marcar ${texto} como entregada mediante entrega directa?`)) return;

    try {
      setGuardando(true);
      await entregarDirecto(seleccionadas);
      setSeleccionadas([]);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <main className="page">
      <div className="detail-header orders-header">
        <button onClick={volver} className="back-btn">
          <ArrowLeft size={18} />
        </button>

        <div>
          <div className="order-title-row">
            <h2 className="order-title">{sucursal}</h2>
            <span className={`badge ${vista === "bodega" ? "badge-blue" : "badge-green"}`}>
              {ordenes.length} {vista === "bodega" ? "órdenes" : "entregas"}
            </span>
          </div>

          <p className="order-sub">
            {vista === "bodega" ? "Órdenes pendientes para dejar en Listo" : "Entregas asignadas al chofer"}
          </p>
        </div>
      </div>

      <div className="orders-tools">
        <div className="orders-search">
          <Search size={20} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar factura u orden dentro de la sucursal"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda"><X size={18} /></button>
          )}
        </div>

        {vista === "bodega" && (
          <button
            type="button"
            className="direct-delivery-btn"
            disabled={!seleccionadas.length || guardando}
            onClick={confirmarEntregaDirecta}
          >
            <CheckCircle size={20} />
            {guardando ? "Marcando..." : `Entrega directa${seleccionadas.length ? ` (${seleccionadas.length})` : ""}`}
          </button>
        )}
      </div>

      {vista === "bodega" && (
        <p className="selection-help">Seleccione una o varias órdenes con el cuadro grande de la izquierda.</p>
      )}

      <section className="orders-list">
        {ordenesFiltradas.map((orden) => {
          const seleccionada = seleccionadas.includes(orden.numero);
          return (
            <div key={orden.numero} className={`order-select-row ${seleccionada ? "order-selected" : ""}`}>
              {vista === "bodega" && (
                <button
                  type="button"
                  className={`order-big-check ${seleccionada ? "checked" : ""}`}
                  onClick={() => alternarSeleccion(orden.numero)}
                  aria-label={`${seleccionada ? "Quitar" : "Seleccionar"} orden ${orden.numero}`}
                >
                  {seleccionada && <CheckCircle size={25} />}
                </button>
              )}

              <button
                className={`order-card ${estadoClase(orden.estado)}`}
                onClick={() => abrirOrden(orden)}
              >
                <div className="order-card-main">
                  <div className="order-card-icon">
                    <Package size={18} />
                  </div>

                  <div>
                    <div className="order-card-title-row">
                      <h3>ORD-{orden.numero}</h3>
                      <span className={`badge ${estadoBadgeClase(orden.estado)}`}>{orden.estado}</span>
                    </div>

                    <p className="order-card-line">
                      <User size={13} />
                      {orden.cliente || "Cliente no indicado"}
                    </p>

                    <p className="order-card-line">
                      <Calendar size={13} />
                      {formatearFecha(orden.fecha)}
                    </p>
                  </div>
                </div>

                <div className="order-card-right">
                  <strong>{orden.productos.length}</strong>
                  <span>productos</span>
                  <ChevronRight size={17} />
                </div>
              </button>
            </div>
          );
        })}

        {ordenesFiltradas.length === 0 && (
          <div className="notice-card">No se encontraron órdenes con esa búsqueda.</div>
        )}
      </section>
    </main>
  );
}

export default OrdenesSucursal;
