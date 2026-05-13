import type { Orden } from "../types/orden";

type Props = {
  ordenes: Orden[];
  abrirOrden: (orden: Orden) => void;
};

function Faltantes({ ordenes, abrirOrden }: Props) {
  const faltantes = ordenes.flatMap((orden) =>
    orden.productos
      .filter((producto) => Number(producto.cantidadFaltante || 0) > 0)
      .map((producto) => {
        const cantidadFaltante = Number(producto.cantidadFaltante || 0);
        const cantidadOriginal = Number(producto.cantidadOriginal ?? producto.cantidad + cantidadFaltante);

        return {
          orden,
          producto,
          cantidadOriginal,
          cantidadFaltante,
          cantidadFinal: producto.cantidad,
        };
      })
  );

  return (
    <main className="page">
      <h2 className="page-title">Faltantes</h2>
      <p className="page-subtitle">Productos reportados como faltantes durante el proceso de Listo</p>

      <section className="panel">
        {faltantes.length === 0 ? (
          <p className="empty-text">No hay faltantes registrados.</p>
        ) : (
          <div className="faltantes-table">
            <div className="faltantes-head">
              <span>Orden</span>
              <span>Sucursal</span>
              <span>Producto</span>
              <span>Solicitado</span>
              <span>Faltante</span>
              <span>Final</span>
            </div>

            {faltantes.map((item, index) => (
              <button
                key={`${item.orden.numero}-${item.producto.descripcion}-${index}`}
                onClick={() => abrirOrden(item.orden)}
                className="faltantes-row"
              >
                <span>ORD-{item.orden.numero}</span>
                <span>{item.orden.sucursal}</span>
                <span>{item.producto.nombre}</span>
                <span>{item.cantidadOriginal}</span>
                <span className="faltante-number">{item.cantidadFaltante}</span>
                <span>{item.cantidadFinal}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Faltantes;
