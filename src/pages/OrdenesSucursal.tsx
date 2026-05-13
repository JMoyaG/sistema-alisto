import { ArrowLeft, Calendar, ChevronRight, Package, User } from "lucide-react";
import type { Orden, Vista } from "../types/orden";
import { estadoBadgeClase, estadoClase } from "../utils/estado";

type Props = {
  vista: Vista;
  sucursal: string;
  ordenes: Orden[];
  volver: () => void;
  abrirOrden: (orden: Orden) => void;
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

function OrdenesSucursal({ vista, sucursal, ordenes, volver, abrirOrden }: Props) {
  return (
    <main className="page">
      <div className="detail-header">
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

      <section className="orders-list">
        {ordenes.map((orden) => (
          <button
            key={orden.numero}
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
        ))}
      </section>
    </main>
  );
}

export default OrdenesSucursal;
