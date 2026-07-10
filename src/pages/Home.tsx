import { useMemo, useState } from "react";
import BranchCard from "../components/BranchCard";
import Resumen from "../components/Resumen";
import type { Orden, Vista } from "../types/orden";
import { Package, Plus, Search, X } from "lucide-react";
import { estadoBadgeClase } from "../utils/estado";

type Props = {
  vista: Vista;
  ordenesBodega: Orden[];
  ordenesChofer: Orden[];
  sucursales: string[];
  abrirSucursal: (sucursal: string) => void;
  abrirOrden: (orden: Orden) => void;
  abrirCrearOrden: () => void;
  cargando: boolean;
  error: string | null;
};

function ordenesPorSucursal(ordenes: Orden[], sucursal: string) {
  return ordenes.filter((orden) => orden.sucursal === sucursal);
}

function Home({
  vista,
  ordenesBodega,
  ordenesChofer,
  sucursales,
  abrirSucursal,
  abrirOrden,
  abrirCrearOrden,
  cargando,
  error,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const listaVista = vista === "bodega" ? ordenesBodega : ordenesChofer;

  const resultados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase().replace(/^ord-/, "");
    if (!termino) return [];

    return listaVista
      .filter((orden) => {
        const numero = String(orden.numero || "").toLowerCase();
        const sucursal = String(orden.sucursal || "").toLowerCase();
        const cliente = String(orden.cliente || "").toLowerCase();
        return numero.includes(termino) || sucursal.includes(termino) || cliente.includes(termino);
      })
      .slice(0, 10);
  }, [busqueda, listaVista]);

  return (
    <main className="page">
      <div className="page-row">
        <div>
          <h2 className="page-title">
            {vista === "bodega" ? "Pendientes de Listo por Sucursal" : "Entregas Asignadas"}
          </h2>

          <p className="page-subtitle">
            {vista === "bodega"
              ? "Seleccione una sucursal para ver las órdenes pendientes"
              : `${ordenesChofer.length} órdenes en ruta`}
          </p>
        </div>
        {vista === "bodega" && (
          <button onClick={abrirCrearOrden} className="primary-btn">
            <Plus size={18} />
            Crear Orden
          </button>
        )}
      </div>

      <div className="invoice-search-wrap">
        <div className="invoice-search">
          <Search size={21} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar factura u orden (ej. 4948)"
            aria-label="Buscar factura u orden"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda">
              <X size={18} />
            </button>
          )}
        </div>

        {busqueda.trim() && (
          <div className="invoice-results">
            {resultados.length === 0 ? (
              <p className="invoice-empty">No se encontraron facturas u órdenes.</p>
            ) : (
              resultados.map((orden) => (
                <button
                  key={orden.numero}
                  type="button"
                  className="invoice-result"
                  onClick={() => abrirOrden(orden)}
                >
                  <span className="invoice-result-icon"><Package size={18} /></span>
                  <span className="invoice-result-info">
                    <strong>ORD-{orden.numero}</strong>
                    <small>{orden.sucursal} · {orden.productos.length} productos</small>
                  </span>
                  <span className={`badge ${estadoBadgeClase(orden.estado)}`}>{orden.estado}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {cargando && <div className="notice-card">Cargando órdenes desde SharePoint...</div>}
      {error && <div className="error-card">{error}</div>}

      <div className="branch-grid">
        {sucursales.map((sucursal) => {
          const ordenesSucursal = ordenesPorSucursal(listaVista, sucursal);
          const estadoPrincipal = ordenesSucursal[0]?.estado;

          return (
            <BranchCard
              key={sucursal}
              sucursal={sucursal}
              cantidad={ordenesSucursal.length}
              vista={vista}
              estadoPrincipal={estadoPrincipal}
              onClick={() => abrirSucursal(sucursal)}
            />
          );
        })}
      </div>

      {vista === "bodega" && (
        <section className="panel">
          <h3>Estados de Orden</h3>

          <div className="status-legend">
            <div className="legend-item"><span className="legend-dot dot-pendiente"></span>Pendiente</div>
            <div className="legend-item"><span className="legend-dot dot-alistando"></span>Alistando</div>
            <div className="legend-item"><span className="legend-dot dot-listo"></span>Listo</div>
            <div className="legend-item"><span className="legend-dot dot-camion"></span>En Camión</div>
            <div className="legend-item"><span className="legend-dot dot-entrega"></span>En Entrega</div>
            <div className="legend-item"><span className="legend-dot dot-entregado"></span>Entregado</div>
          </div>
        </section>
      )}

      {vista === "chofer" && (
        <section className="panel">
          <h3>Resumen de Ruta</h3>

          <div className="summary-grid">
            <Resumen titulo="Sucursales" valor={new Set(ordenesChofer.map((o) => o.sucursal)).size} />
            <Resumen titulo="Entregas" valor={ordenesChofer.length} />
            <Resumen titulo="En Entrega" valor={ordenesChofer.filter((o) => o.estado === "En Entrega").length} />
            <Resumen titulo="En Camión" valor={ordenesChofer.filter((o) => o.estado === "En Camión").length} />
          </div>
        </section>
      )}
    </main>
  );
}

export default Home;
