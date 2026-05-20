import { ArrowLeft, Box, Check, CheckCircle, Truck } from "lucide-react";
import { useState } from "react";
import type { Estado, Orden, Producto, Vista } from "../types/orden";
import { estadoBadgeClase } from "../utils/estado";

type Props = {
  vista: Vista;
  orden: Orden;
  volver: () => void;
  actualizarEstado: (numero: string, nuevoEstado: Estado) => void | Promise<void>;
  actualizarProductosOrden: (numero: string, productos: Producto[]) => void;
  confirmarAlisto: (numero: string, productos: Producto[]) => void | Promise<void>;
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

function OrdenDetalle({
  vista,
  orden,
  volver,
  actualizarEstado,
  actualizarProductosOrden,
  confirmarAlisto,
}: Props) {
  const [observacion, setObservacion] = useState(
    orden.estado === "Pendiente"
      ? `Completando orden para ${orden.sucursal}`
      : `Seguimiento de orden para ${orden.sucursal}`
  );

  const esChofer = vista === "chofer" || orden.estado === "En Camión" || orden.estado === "En Entrega";
  const puedeEditarFaltantes = vista === "bodega" && orden.estado === "Pendiente";

  const actualizarProducto = (index: number, cambios: Partial<Producto>) => {
    const productosActualizados = orden.productos.map((producto, i) =>
      i === index ? { ...producto, ...cambios } : producto
    );

    actualizarProductosOrden(orden.numero, productosActualizados);
  };

  const cambiarFaltante = (index: number, activo: boolean) => {
    const producto = orden.productos[index];
    const maximo = Number(producto.cantidadOriginal ?? producto.cantidad);
    const cantidadActual = Number(producto.cantidadFaltante || 1);

    actualizarProducto(index, {
      faltante: activo,
      cantidadFaltante: activo ? Math.min(Math.max(cantidadActual, 1), maximo) : 0,
    });
  };

  const cambiarCantidadFaltante = (index: number, valor: string, maximo: number) => {
    let cantidad = Number(valor);

    if (Number.isNaN(cantidad)) cantidad = 0;
    if (cantidad < 0) cantidad = 0;
    if (cantidad > maximo) cantidad = maximo;

    actualizarProducto(index, {
      faltante: cantidad > 0,
      cantidadFaltante: cantidad,
    });
  };

  const cambiarEstadoPreparacionProducto = (
    index: number,
    estadoPreparacion: "Alistando" | "Listo"
  ) => {
    const producto = orden.productos[index];
    const nuevoEstado =
      producto.estadoPreparacion === estadoPreparacion ? "" : estadoPreparacion;

    actualizarProducto(index, { estadoPreparacion: nuevoEstado });
  };

  const confirmarListo = () => {
  const productosFinales: Producto[] = orden.productos.map((producto) => {
    const cantidadOriginal = Number(producto.cantidadOriginal ?? producto.cantidad);

    const faltante = producto.faltante
      ? Number(producto.cantidadFaltante || 0)
      : 0;

    const faltanteFinal = Math.min(
      Math.max(faltante, 0),
      cantidadOriginal
    );

    const cantidadFinal = Math.max(
      cantidadOriginal - faltanteFinal,
      0
    );

    return {
      ...producto,
      cantidadOriginal,
      cantidad: cantidadFinal,
      faltante: false,
      cantidadFaltante: faltanteFinal,
      estadoPreparacion: "Listo" as "Listo",
    };
  });

  actualizarProductosOrden(orden.numero, productosFinales);

  confirmarAlisto(orden.numero, productosFinales);
};

  return (
    <main className="page">
      <div className="detail-header">
        <button onClick={volver} className="back-btn">
          <ArrowLeft size={18} />
        </button>

        <div>
          <div className="order-title-row">
            <h2 className="order-title">ORD-{orden.numero}</h2>
            <span className={`badge ${estadoBadgeClase(orden.estado)}`}>{orden.estado}</span>
          </div>

          <p className="order-sub">
            {orden.sucursal} • {formatearFecha(orden.fecha)}
          </p>

          {orden.cliente && <p className="order-client">{orden.cliente}</p>}
        </div>
      </div>
      {orden.estado !== "Pendiente de Carga" && (
      <section className="panel">
        <h3 className="panel-title">
          <Box size={18} />
          Productos
        </h3>

        <div className="product-stack">
          {orden.productos.map((p, index) => {
            const maximo = Number(p.cantidadOriginal ?? p.cantidad);
            const tieneFaltante = Boolean(p.faltante);
            const faltanteRegistrado = Number(p.cantidadFaltante || 0);
            const mostrarResumenFaltante = !puedeEditarFaltantes && faltanteRegistrado > 0;

            return (
              <div key={`${p.descripcion}-${index}`} className="product-row product-row-full">
                <div className="product-main">
                  <div className="product-left">
                    <div className="product-icon">
                      <Box size={18} />
                    </div>

                    <div>
                      <p className="product-name">{p.nombre}</p>
                      <p className="product-desc">{p.descripcion}</p>
                      {mostrarResumenFaltante && (
                        <p className="faltante-resumen">
                          Solicitado: {p.cantidadOriginal ?? p.cantidad + faltanteRegistrado} • Faltante: {faltanteRegistrado}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="product-right">
                    <div className="product-qty-box">
                      <p className="product-qty">{p.cantidad}</p>
                      <p className="product-unit">unidades</p>
                    </div>

                    {puedeEditarFaltantes && (
                      <div className="product-status-checks">
                        <button
                          type="button"
                          className={`status-check ${
                            p.estadoPreparacion === "Alistando" ? "status-check-on" : ""
                          }`}
                          onClick={() => cambiarEstadoPreparacionProducto(index, "Alistando")}
                        >
                          <span className="status-check-box">
                            {p.estadoPreparacion === "Alistando" && <Check size={13} strokeWidth={4} />}
                          </span>
                          Alistando
                        </button>

                        <button
                          type="button"
                          className={`status-check ${
                            p.estadoPreparacion === "Listo" ? "status-check-on" : ""
                          }`}
                          onClick={() => cambiarEstadoPreparacionProducto(index, "Listo")}
                        >
                          <span className="status-check-box">
                            {p.estadoPreparacion === "Listo" && <Check size={13} strokeWidth={4} />}
                          </span>
                          Listo
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {puedeEditarFaltantes && (
                  <div className="faltante-box">
                    <label className="faltante-label">¿Faltante?</label>

                    <div className="switch-group">
                      <span>No</span>

                      <button
                        type="button"
                        onClick={() => cambiarFaltante(index, !tieneFaltante)}
                        className={`switch ${tieneFaltante ? "switch-on" : ""}`}
                      >
                        <span></span>
                      </button>

                      <span>Sí</span>
                    </div>

                    {tieneFaltante && (
                      <div className="faltante-input-box">
                        <label>Cantidad faltante</label>

                        <input
                          type="number"
                          min={0}
                          max={maximo}
                          value={p.cantidadFaltante ?? 0}
                          onChange={(e) => cambiarCantidadFaltante(index, e.target.value, maximo)}
                        />

                        <small>Máximo permitido: {maximo}</small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
)}
      <section className="panel">
        <h3 className="panel-title">Observaciones</h3>

        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          className="textarea"
        />
      </section>
      
      {!esChofer && orden.estado === "Pendiente" && (
        <button onClick={confirmarListo} className="action-btn action-orange">
          <CheckCircle size={18} />
          Confirmar Listo
        </button>
      )}

      {!esChofer && (orden.estado === "Listo" || orden.estado === "Pendiente de Carga") && (
  <>
    <section className="panel">
      <h3 className="panel-title">
        <Truck size={18} />
        Carga al Camión
      </h3>

      <div className="product-stack">
        {orden.productos.map((p, index) => (
          <div
            key={`carga-${p.descripcion}-${index}`}
            className="product-row product-row-full"
          >
            <div className="product-main">
              <div className="product-left">
                <div className="product-icon">
                  <Box size={18} />
                </div>

                <div>
                  <p className="product-name">{p.nombre}</p>
                  <p className="product-desc">{p.descripcion}</p>
                </div>
              </div>

              <div className="product-right">
                <div className="product-qty-box">
                  <p className="product-qty">{p.cantidad}</p>
                  <p className="product-unit">unidades</p>
                </div>

                <div className="product-status-checks">
                  <button
                    type="button"
                    className={`status-check ${
                      (p as any).estadoCarga === "Subiendo"
                        ? "status-check-on"
                        : ""
                    }`}
                    onClick={() => {
                      const nuevoEstado =
                        (p as any).estadoCarga === "Subiendo"
                          ? ""
                          : "Subiendo";

                      actualizarProducto(index, {
                        estadoCarga: nuevoEstado,
                      } as any);
                    }}
                  >
                    <span className="status-check-box">
                      {(p as any).estadoCarga === "Subiendo" && (
                        <Check size={13} strokeWidth={4} />
                      )}
                    </span>
                    Subiendo
                  </button>

                  <button
                    type="button"
                    className={`status-check ${
                      (p as any).estadoCarga === "Listo"
                        ? "status-check-on"
                        : ""
                    }`}
                    onClick={() => {
                      const nuevoEstado =
                        (p as any).estadoCarga === "Listo"
                          ? ""
                          : "Listo";

                      actualizarProducto(index, {
                        estadoCarga: nuevoEstado,
                      } as any);
                    }}
                  >
                    <span className="status-check-box">
                      {(p as any).estadoCarga === "Listo" && (
                        <Check size={13} strokeWidth={4} />
                      )}
                    </span>
                    Listo
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>

    <button
      onClick={() => actualizarEstado(orden.numero, "En Camión")}
      className="action-btn action-green"
    >
      <Truck size={18} />
      Subir al Camión
    </button>
  </>
)}

      {esChofer && orden.estado === "En Camión" && (
        <button
          onClick={() => actualizarEstado(orden.numero, "En Entrega")}
          className="action-btn action-orange"
        >
          <Truck size={18} />
          Iniciar Entrega
        </button>
      )}

      {esChofer && orden.estado === "En Entrega" && (
        <button
          onClick={() => actualizarEstado(orden.numero, "Entregado")}
          className="action-btn action-green"
        >
          <CheckCircle size={18} />
          Marcar como Entregado
        </button>
      )}
    </main>
  );
}

export default OrdenDetalle;
