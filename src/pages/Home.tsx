import { Plus, RefreshCw } from "lucide-react";
import BranchCard from "../components/BranchCard";
import Resumen from "../components/Resumen";
import type { Orden, Vista } from "../types/orden";

type Props = {
  vista: Vista;
  ordenesBodega: Orden[];
  ordenesChofer: Orden[];
  sucursales: string[];
  abrirSucursal: (sucursal: string) => void;
  abrirCrearOrden: () => void;
  actualizarSql: () => void;
  sincronizando: boolean;
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
  abrirCrearOrden,
  actualizarSql,
  sincronizando,
  cargando,
  error,
}: Props) {
  const listaVista = vista === "bodega" ? ordenesBodega : ordenesChofer;

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
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="create-order-btn"
              onClick={actualizarSql}
              disabled={sincronizando || cargando}
              title="Trae órdenes nuevas desde SQL y actualiza SharePoint"
            >
              <RefreshCw size={17} />
              {sincronizando ? "Actualizando..." : "Actualizar SQL"}
            </button>

            <button type="button" className="create-order-btn" onClick={abrirCrearOrden}>
              <Plus size={17} />
              Crear Orden
            </button>
          </div>
        )}
      </div>

      {cargando && <div className="notice-card">Cargando órdenes desde SharePoint...</div>}
      {sincronizando && <div className="notice-card">Sincronizando SQL → SharePoint...</div>}
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
