import { Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Producto } from "../types/orden";
import { inferirPesoUnitarioKg } from "../utils/peso";

type ProductoForm = {
  codigo: string;
  nombre: string;
  cantidad: string;
  manual: boolean;
  unidadMedida: string;
  pesoUnitarioKg: string;
  busqueda: string;
};

type Props = {
  abierto: boolean;
  productosDisponibles: Producto[];
  onCerrar: () => void;
  onCrearOrden: (sucursal: string, productos: Producto[]) => void | Promise<void>;
};

const productoVacio: ProductoForm = {
  codigo: "",
  nombre: "",
  cantidad: "1",
  manual: false,
  unidadMedida: "UND",
  pesoUnitarioKg: "",
  busqueda: "",
};

function etiquetaProducto(item: Producto) {
  return `${item.codigo ? `${item.codigo} - ` : ""}${item.nombre}`;
}

function CrearOrdenModal({ abierto, productosDisponibles, onCerrar, onCrearOrden }: Props) {
  const productosOrdenados = useMemo(
    () =>
      [...productosDisponibles]
        .filter((p) => p.nombre || p.codigo)
        .sort((a, b) => etiquetaProducto(a).localeCompare(etiquetaProducto(b))),
    [productosDisponibles]
  );

  const [sucursal, setSucursal] = useState("");
  const [productos, setProductos] = useState<ProductoForm[]>([{ ...productoVacio }]);
  const [error, setError] = useState("");

  if (!abierto) return null;

  const buscarProductoBase = (codigo: string, nombre?: string) =>
    productosDisponibles.find((producto) => producto.codigo === codigo) ||
    productosDisponibles.find((producto) => producto.nombre === nombre);

  const filtrarProductos = (texto: string) => {
    const termino = texto.trim().toLowerCase();

    if (!termino) return [];

    return productosOrdenados
      .filter((item) => {
        const nombre = item.nombre?.toLowerCase() || "";
        const descripcion = item.descripcion?.toLowerCase() || "";
        const codigo = item.codigo?.toLowerCase() || "";

        return (
          nombre.includes(termino) ||
          descripcion.includes(termino) ||
          codigo.includes(termino)
        );
      })
      .slice(0, 30);
  };

  const cambiarProducto = (index: number, cambios: Partial<ProductoForm>) => {
    setProductos((prev) =>
      prev.map((producto, i) => (i === index ? { ...producto, ...cambios } : producto))
    );
  };

  const seleccionarProducto = (index: number, base: Producto) => {
    const pesoUnitarioKg = inferirPesoUnitarioKg(
      base.nombre,
      base.descripcion,
      base.unidadMedida,
      base.pesoUnitarioKg
    );

    cambiarProducto(index, {
      codigo: base.codigo || "",
      nombre: base.nombre,
      unidadMedida: base.unidadMedida || "UND",
      pesoUnitarioKg: String(pesoUnitarioKg || ""),
      busqueda: etiquetaProducto(base),
    });
  };

  const agregarProducto = () => {
    setProductos((prev) => [...prev, { ...productoVacio }]);
  };

  const eliminarProducto = (index: number) => {
    setProductos((prev) => prev.filter((_, i) => i !== index));
  };

  const crearOrden = async () => {
    setError("");
    const destino = sucursal.trim().toUpperCase();

    if (!destino) {
      setError("Escriba la bodega destino.");
      return;
    }

    const productosFinales = productos.map((producto) => {
      const cantidad = Number(producto.cantidad);
      const base = buscarProductoBase(producto.codigo, producto.nombre);
      const pesoDigitado = Number(producto.pesoUnitarioKg);

      const pesoUnitarioKg =
        pesoDigitado > 0
          ? pesoDigitado
          : inferirPesoUnitarioKg(
              producto.nombre,
              base?.descripcion,
              producto.unidadMedida || base?.unidadMedida,
              base?.pesoUnitarioKg
            );

      const nombre = producto.nombre.trim() || base?.nombre || "";
      const unidadMedida = producto.unidadMedida || base?.unidadMedida || "UND";

      return {
        nombre,
        descripcion: producto.manual ? "Producto agregado manualmente" : base?.descripcion || nombre,
        codigo: producto.codigo || base?.codigo || "",
        cantidad,
        cantidadOriginal: cantidad,
        faltante: false,
        cantidadFaltante: 0,
        unidadMedida,
        pesoUnitarioKg,
        pesoTotalKg: cantidad * Number(pesoUnitarioKg || 0),
      };
    });

    const invalido = productosFinales.some(
      (producto) =>
        !producto.nombre ||
        !Number.isFinite(producto.cantidad) ||
        producto.cantidad <= 0
    );

    if (invalido) {
      setError("Revise que todos los productos tengan nombre y cantidad mayor a 0.");
      return;
    }

    await onCrearOrden(destino, productosFinales);
    setProductos([{ ...productoVacio }]);
    setSucursal("");
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2>Crear Orden</h2>
            <p>Seleccione productos del catálogo, cantidades y bodega destino.</p>
          </div>

          <button type="button" className="icon-btn" onClick={onCerrar}>
            <X size={18} />
          </button>
        </div>

        <div className="form-group">
          <label>Bodega destino</label>
          <input
            value={sucursal}
            onChange={(e) => setSucursal(e.target.value)}
            placeholder="Ejemplo: COT, PACAYAS, EL GUARCO..."
          />
        </div>

        <div className="modal-products">
          {productos.map((producto, index) => {
            const opciones = filtrarProductos(producto.busqueda);

            return (
              <div key={index} className="modal-product-row">
                <div className="manual-row">
                  <strong>Producto {index + 1}</strong>

                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={producto.manual}
                      onChange={(e) =>
                        cambiarProducto(index, {
                          manual: e.target.checked,
                          codigo: "",
                          nombre: "",
                          unidadMedida: "UND",
                          pesoUnitarioKg: "",
                          busqueda: "",
                        })
                      }
                    />
                    Producto no existe / agregar manual
                  </label>
                </div>

                <div className="modal-grid-2">
                  <div className="form-group">
                    <label>Producto</label>

                    {producto.manual ? (
                      <input
                        value={producto.nombre}
                        onChange={(e) =>
                          cambiarProducto(index, {
                            nombre: e.target.value,
                            pesoUnitarioKg:
                              producto.pesoUnitarioKg ||
                              String(inferirPesoUnitarioKg(e.target.value) || ""),
                          })
                        }
                        placeholder="Escriba el producto"
                      />
                    ) : (
                      <div className="producto-search-box">
                        <input
                          value={producto.busqueda}
                          onChange={(e) =>
                            cambiarProducto(index, {
                              busqueda: e.target.value,
                              codigo: "",
                              nombre: "",
                            })
                          }
                          placeholder="Buscar por código o nombre..."
                        />

                        {producto.busqueda.trim() && opciones.length > 0 && (
                          <div className="producto-results">
                            {opciones.map((item) => (
                              <button
                                key={`${item.codigo}-${item.nombre}`}
                                type="button"
                                className="producto-result-btn"
                                onClick={() => seleccionarProducto(index, item)}
                              >
                                {etiquetaProducto(item)}
                              </button>
                            ))}
                          </div>
                        )}

                        <small>
                          {producto.busqueda.trim()
                            ? `${opciones.length} producto(s) encontrado(s) de ${productosOrdenados.length}`
                            : `Escriba para buscar entre ${productosOrdenados.length} productos`}
                        </small>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Cantidad</label>
                    <input
                      type="number"
                      min={1}
                      value={producto.cantidad}
                      onChange={(e) => cambiarProducto(index, { cantidad: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-grid-2">
                  <div className="form-group">
                    <label>Medida</label>
                    <input
                      value={producto.unidadMedida}
                      onChange={(e) => cambiarProducto(index, { unidadMedida: e.target.value })}
                      placeholder="UND, KG, LTR..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Peso por unidad en kg</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={producto.pesoUnitarioKg}
                      onChange={(e) => cambiarProducto(index, { pesoUnitarioKg: e.target.value })}
                      placeholder="Ejemplo: 45"
                    />
                  </div>
                </div>

                {productos.length > 1 && (
                  <button
                    type="button"
                    className="remove-product-btn"
                    onClick={() => eliminarProducto(index)}
                  >
                    <Trash2 size={15} />
                    Quitar producto
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={agregarProducto}>
            <Plus size={16} />
            Agregar otro producto
          </button>

          <button type="button" className="primary-btn" onClick={crearOrden}>
            Crear orden
          </button>
        </div>
      </div>
    </div>
  );
}

export default CrearOrdenModal;