import type { Estado, Orden } from "../types/orden";
import { estadoClase } from "../utils/estado";

type Props = {
  ordenes: Orden[];
  abrirOrden: (orden: Orden) => void;
  fechaEntregadas: string;
  cambiarFechaEntregadas: (fecha: string) => void;
  cargando: boolean;
};

const columnas: Estado[] = [
  "Pendiente",
  "Listo",
  "En Camión",
  "En Entrega",
  "Entregado",
];

function ResumenKanban({
  ordenes,
  abrirOrden,
  fechaEntregadas,
  cambiarFechaEntregadas,
  cargando,
}: Props) {
  return (
    <main className="page">
      <div className="kanban-title-row">
        <div>
          <h2 className="page-title">Resumen Kanban</h2>
          <p className="page-subtitle">
            Las órdenes activas se muestran completas. Las entregadas se consultan por día.
          </p>
        </div>

        <label className="delivered-date-filter">
          <span>Entregadas del día</span>
          <input
            type="date"
            value={fechaEntregadas}
            onChange={(event) => {
              if (event.target.value) {
                cambiarFechaEntregadas(event.target.value);
              }
            }}
            aria-label="Fecha de órdenes entregadas"
          />
        </label>
      </div>

      {cargando && (
        <div className="notice-card">Consultando órdenes de la fecha seleccionada...</div>
      )}

      <div className="kanban-board">
        {columnas.map((estado) => {
          const ordenesEstado = ordenes.filter((orden) => {
            if (estado === "Listo") {
              return orden.estado === "Listo" || orden.estado === "Pendiente de Carga";
            }

            return orden.estado === estado;
          });

          return (
            <section key={estado} className="kanban-column">
              <div className="kanban-header">
                <span className={`state-dot ${estadoClase(estado)}`}></span>
                <h3>{estado}</h3>
                <strong>{ordenesEstado.length}</strong>
              </div>

              <div className="kanban-list">
                {ordenesEstado.map((orden) => (
                  <button
                    key={orden.numero}
                    onClick={() => abrirOrden(orden)}
                    className={`kanban-card ${estadoClase(orden.estado)}`}
                  >
                    <strong>ORD-{orden.numero}</strong>
                    <span>{orden.sucursal}</span>
                    <small>{orden.productos.length} productos</small>
                  </button>
                ))}

                {estado === "Entregado" && ordenesEstado.length === 0 && !cargando && (
                  <p className="kanban-empty">No hay entregas para este día.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

export default ResumenKanban;
