import type { Estado, Orden } from "../types/orden";
import { estadoClase } from "../utils/estado";

type Props = {
  ordenes: Orden[];
  abrirOrden: (orden: Orden) => void;
};

const columnas: Estado[] = [
  "Pendiente",
  "Listo",
  "En Camión",
  "En Entrega",
  "Entregado",
];

function ResumenKanban({ ordenes, abrirOrden }: Props) {
  return (
    <main className="page">
      <h2 className="page-title">Resumen Kanban</h2>
      <p className="page-subtitle">Vista general de órdenes por estado</p>

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
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

export default ResumenKanban;
