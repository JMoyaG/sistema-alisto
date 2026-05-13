import {
  CalendarDays,
  CheckCircle2,
  MapPin,
  Route,
  SlidersHorizontal,
  Truck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Orden } from "../types/orden";
import { estadoBadgeClase } from "../utils/estado";
import { pesoProductoKg as calcularPesoProductoKg } from "../utils/peso";

type Props = {
  ordenes: Orden[];
  abrirOrden: (orden: Orden) => void;
};

type DiaRuta = "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado";
type Chofer = "Sin asignar" | "Roberto" | "Martin";
type Camion = "Camión 1" | "Camión 2";

type OrdenRuta = Orden & {
  diaRuta?: string;
  camion?: string;
  chofer?: string;
  confirmada?: boolean;
};

type AsignacionRuta = {
  dia: DiaRuta;
  camion: Camion;
};

type RutaGuardada = {
  spId?: string;
  Dia?: string;
  dia?: string;
  Camion?: string;
  camion?: string;
  Chofer?: string;
  chofer?: string;
  Confirmada?: boolean;
  confirmada?: boolean;
};

const API_URL = "http://localhost:3001/api/sharepoint";

const dias: DiaRuta[] = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const choferes: Chofer[] = ["Sin asignar", "Roberto", "Martin"];
const camiones: Camion[] = ["Camión 1", "Camión 2"];
const CAPACIDAD_CAMION_KG = 7000;

function rutaKey(dia: string, camion: string) {
  return `${dia}__${camion}`;
}

const selectStyle: React.CSSProperties = {
  height: 38,
  minWidth: 110,
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "0 10px",
  background: "#fff",
  fontWeight: 700,
};

const assignBtnStyle: React.CSSProperties = {
  height: 38,
  border: "1px solid #10b981",
  borderRadius: 10,
  padding: "0 14px",
  background: "#ecfdf5",
  color: "#047857",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const orderRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "36px minmax(0, 1fr)",
  gap: 12,
  alignItems: "start",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  background: "#fff",
  marginBottom: 10,
  overflow: "hidden",
};

const orderActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
  alignItems: "center",
};

const orderTitleStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 900,
  fontSize: 14,
  lineHeight: 1.25,
  wordBreak: "break-word",
};

const orderMetaStyle: React.CSSProperties = {
  display: "block",
  color: "#4b5563",
  fontSize: 12,
  lineHeight: 1.25,
  marginTop: 2,
  wordBreak: "break-word",
};

function pesoProductoKg(producto: Orden["productos"][number]) {
  return calcularPesoProductoKg(producto);
}

function pesoOrdenKg(orden: Orden) {
  return orden.productos.reduce((total, producto) => total + pesoProductoKg(producto), 0);
}

function porcentaje(valor: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((valor / total) * 100));
}

function formatoPeso(peso: number) {
  if (peso >= 1000) return `${(peso / 1000).toFixed(2)} T`;
  return `${Math.round(peso)} kg`;
}

function getDiaRuta(orden: OrdenRuta) {
  return orden.diaRuta || "";
}

function getCamion(orden: OrdenRuta) {
  return orden.camion || "";
}

function esDiaRuta(valor: string): valor is DiaRuta {
  return dias.includes(valor as DiaRuta);
}

function esCamion(valor: string): valor is Camion {
  return camiones.includes(valor as Camion);
}

async function actualizarOrdenRuta(
  orden: Orden,
  asignacion: AsignacionRuta,
  choferCamion1: Chofer,
  choferCamion2: Chofer
) {
  const chofer = asignacion.camion === "Camión 1" ? choferCamion1 : choferCamion2;

  const res = await fetch(`${API_URL}/estado`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idOrden: orden.numero,
      estado: "En Camión",
      chofer,
      camion: asignacion.camion,
      diaRuta: asignacion.dia,
      confirmada: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudo actualizar ORD-${orden.numero}: ${text}`);
  }
}

async function guardarCabeceraRuta(
  dia: DiaRuta,
  camion: Camion,
  chofer: Chofer,
  confirmada: boolean
) {
  const res = await fetch(`${API_URL}/ruta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dia,
      camion,
      chofer,
      confirmada,
      fecha: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudo guardar ruta ${dia} ${camion}: ${text}`);
  }
}

async function guardarDetalleRuta(dia: DiaRuta, camion: Camion, orden: Orden, posicion: number) {
  const res = await fetch(`${API_URL}/ruta-detalle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dia,
      camion,
      orden: orden.numero,
      sucursal: orden.sucursal,
      posicion,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudo guardar detalle ORD-${orden.numero}: ${text}`);
  }
}


async function obtenerRutasGuardadas() {
  const res = await fetch(`${API_URL}/rutas`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudieron cargar las rutas: ${text}`);
  }

  const data = await res.json();
  return (data.rutas || []) as RutaGuardada[];
}

function PlaneacionRutas({ ordenes, abrirOrden }: Props) {
  const [diaSeleccionado, setDiaSeleccionado] = useState<DiaRuta>("Lunes");
  const [choferCamion1, setChoferCamion1] = useState<Chofer>("Roberto");
  const [choferCamion2, setChoferCamion2] = useState<Chofer>("Martin");
  const [asignaciones, setAsignaciones] = useState<Record<string, AsignacionRuta>>({});
  const [pendientes, setPendientes] = useState<Record<string, AsignacionRuta>>({});
  const [guardadasLocal, setGuardadasLocal] = useState<Record<string, AsignacionRuta>>({});
  const [rutasGuardadas, setRutasGuardadas] = useState<Record<string, RutaGuardada>>({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    obtenerRutasGuardadas()
      .then((rutas) => {
        if (!activo) return;

        const mapa: Record<string, RutaGuardada> = {};
        rutas.forEach((ruta) => {
          const dia = ruta.Dia || ruta.dia || "";
          const camion = ruta.Camion || ruta.camion || "";
          if (dia && camion) mapa[rutaKey(dia, camion)] = ruta;
        });

        setRutasGuardadas(mapa);
      })
      .catch((err) => console.error("No se pudieron cargar rutas guardadas:", err));

    return () => {
      activo = false;
    };
  }, []);

  const getAsignacionReal = (orden: OrdenRuta): AsignacionRuta | null => {
    const local = asignaciones[orden.numero] || guardadasLocal[orden.numero];
    if (local) return local;

    const diaSp = getDiaRuta(orden);
    const camionSp = getCamion(orden);

    if (esDiaRuta(diaSp) && esCamion(camionSp)) {
      return { dia: diaSp, camion: camionSp };
    }

    return null;
  };

  const ordenesParaRuta = useMemo(() => {
    return (ordenes as OrdenRuta[]).filter((orden) => {
      if (orden.estado === "Entregado") return false;

      return (
        orden.estado === "Listo" ||
        orden.estado === "Pendiente de Carga" ||
        orden.estado === "En Camión" ||
        orden.estado === "En Entrega"
      );
    });
  }, [ordenes]);

  const ordenesSinAsignar = useMemo(() => {
    return ordenesParaRuta.filter((orden) => !getAsignacionReal(orden));
  }, [ordenesParaRuta, asignaciones, guardadasLocal]);

  const ordenesAsignadasDia = useMemo(() => {
    return ordenesParaRuta.filter((orden) => {
      const asignacion = getAsignacionReal(orden);
      return asignacion?.dia === diaSeleccionado;
    });
  }, [ordenesParaRuta, asignaciones, guardadasLocal, diaSeleccionado]);

  const planPorCamion = useMemo(() => {
    return camiones.map((camion) => {
      const chofer = camion === "Camión 1" ? choferCamion1 : choferCamion2;

      const ordenesCamion = ordenesAsignadasDia.filter((orden) => {
        const asignacion = getAsignacionReal(orden);
        return asignacion?.camion === camion;
      });

      const pesoUsado = ordenesCamion.reduce((total, orden) => total + pesoOrdenKg(orden), 0);

      return {
        camion,
        chofer,
        pesoUsado,
        ordenes: ordenesCamion,
      };
    });
  }, [ordenesAsignadasDia, asignaciones, guardadasLocal, choferCamion1, choferCamion2]);

  const totalPeso = planPorCamion.reduce((total, plan) => total + plan.pesoUsado, 0);
  const totalDisponible = Math.max(CAPACIDAD_CAMION_KG * 2 - totalPeso, 0);
  const sucursalesEnRuta = new Set(ordenesAsignadasDia.map((orden) => orden.sucursal)).size;
  const rutaDelDiaYaExiste = camiones.some((camion) => Boolean(rutasGuardadas[rutaKey(diaSeleccionado, camion)]));

  const actualizarPendiente = (orden: Orden, cambios: Partial<AsignacionRuta>) => {
    setPendientes((prev) => ({
      ...prev,
      [orden.numero]: {
        dia: cambios.dia ?? prev[orden.numero]?.dia ?? diaSeleccionado,
        camion: cambios.camion ?? prev[orden.numero]?.camion ?? "Camión 1",
      },
    }));
  };

  const asignarOrden = (orden: Orden) => {
    const asignacion = pendientes[orden.numero] ?? {
      dia: diaSeleccionado,
      camion: "Camión 1" as Camion,
    };

    setAsignaciones((prev) => ({
      ...prev,
      [orden.numero]: asignacion,
    }));

    setPendientes((prev) => {
      const copia = { ...prev };
      delete copia[orden.numero];
      return copia;
    });
  };

  const cambiarCamion = (orden: Orden, camion: Camion) => {
    const actual = getAsignacionReal(orden as OrdenRuta) ?? {
      dia: diaSeleccionado,
      camion,
    };

    setAsignaciones((prev) => ({
      ...prev,
      [orden.numero]: {
        ...actual,
        camion,
      },
    }));
  };

  const quitarAsignacion = (orden: Orden) => {
    setAsignaciones((prev) => {
      const copia = { ...prev };
      delete copia[orden.numero];
      return copia;
    });

    setGuardadasLocal((prev) => {
      const copia = { ...prev };
      delete copia[orden.numero];
      return copia;
    });
  };

  const guardarRuta = async (confirmada = false) => {
    try {
      setGuardando(true);
      setMensaje(null);
      setError(null);

      const ordenesDelDia = ordenesAsignadasDia;

      for (const camion of camiones) {
        const chofer = camion === "Camión 1" ? choferCamion1 : choferCamion2;

        const ordenesCamion = ordenesDelDia.filter((orden) => {
          const asignacion = getAsignacionReal(orden);
          return asignacion?.camion === camion;
        });

        if (ordenesCamion.length === 0) continue;

        await guardarCabeceraRuta(diaSeleccionado, camion, chofer, confirmada);

        for (let index = 0; index < ordenesCamion.length; index++) {
          const orden = ordenesCamion[index];
          const asignacion = getAsignacionReal(orden as OrdenRuta);

          if (!asignacion) continue;

          await actualizarOrdenRuta(orden, asignacion, choferCamion1, choferCamion2);
          await guardarDetalleRuta(diaSeleccionado, camion, orden, index + 1);
        }
      }

      const nuevasGuardadas = { ...guardadasLocal };

      ordenesDelDia.forEach((orden) => {
        const asignacion = getAsignacionReal(orden as OrdenRuta);
        if (asignacion) nuevasGuardadas[orden.numero] = asignacion;
      });

      setGuardadasLocal(nuevasGuardadas);
      setAsignaciones((prev) => {
        const copia = { ...prev };
        ordenesDelDia.forEach((orden) => {
          delete copia[orden.numero];
        });
        return copia;
      });

      setRutasGuardadas((prev) => {
        const copia = { ...prev };
        camiones.forEach((camion) => {
          const tieneOrdenes = ordenesDelDia.some((orden) => getAsignacionReal(orden as OrdenRuta)?.camion === camion);
          if (tieneOrdenes) {
            copia[rutaKey(diaSeleccionado, camion)] = {
              Dia: diaSeleccionado,
              Camion: camion,
              Chofer: camion === "Camión 1" ? choferCamion1 : choferCamion2,
              Confirmada: confirmada,
            };
          }
        });
        return copia;
      });

      setMensaje(rutaDelDiaYaExiste ? "Ruta editada y guardada en SharePoint." : "Ruta confirmada y guardada en SharePoint.");
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la ruta en SharePoint. Revisá la consola del backend.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <main className="page">
      <div className="page-row">
        <div>
          <h2 className="page-title">Planeación de Rutas</h2>
          <p className="page-subtitle">
            Asigne órdenes listas a un día y camión. Al confirmar se guarda o edita la ruta en SharePoint.
          </p>
        </div>
      </div>

      <section className="panel route-panel">
        <div className="route-days">
          {dias.map((dia) => (
            <button
              key={dia}
              onClick={() => setDiaSeleccionado(dia)}
              className={`day-btn ${diaSeleccionado === dia ? "active" : ""}`}
            >
              <CalendarDays size={15} />
              {dia}
            </button>
          ))}
        </div>

        <div className="route-tools">
          <button type="button" className="suggest-btn active">
            <SlidersHorizontal size={16} />
            Rutas manuales activas
          </button>

          <div className="driver-select">
            <UserRound size={16} />
            <label>Camión 1</label>
            <select value={choferCamion1} onChange={(e) => setChoferCamion1(e.target.value as Chofer)}>
              {choferes.map((chofer) => (
                <option key={chofer} value={chofer}>{chofer}</option>
              ))}
            </select>
          </div>

          <div className="driver-select">
            <UserRound size={16} />
            <label>Camión 2</label>
            <select value={choferCamion2} onChange={(e) => setChoferCamion2(e.target.value as Chofer)}>
              {choferes.map((chofer) => (
                <option key={chofer} value={chofer}>{chofer}</option>
              ))}
            </select>
          </div>

          <button type="button" className="confirm-route-btn" onClick={() => guardarRuta(true)} disabled={guardando}>
            <CheckCircle2 size={16} />
            {guardando ? "Guardando..." : rutaDelDiaYaExiste ? "Editar ruta" : "Confirmar ruta"}
          </button>
        </div>

        {mensaje && <div className="notice-card">{mensaje}</div>}
        {error && <div className="error-card">{error}</div>}

        <div className="route-summary-grid">
          <div className="route-summary-card">
            <Route size={20} />
            <span>Día</span>
            <strong>{diaSeleccionado}</strong>
          </div>
          <div className="route-summary-card">
            <MapPin size={20} />
            <span>Sucursales</span>
            <strong>{sucursalesEnRuta}</strong>
          </div>
          <div className="route-summary-card">
            <Truck size={20} />
            <span>Órdenes en ruta</span>
            <strong>{ordenesAsignadasDia.length}</strong>
          </div>
          <div className="route-summary-card">
            <Truck size={20} />
            <span>Disponible total</span>
            <strong>{formatoPeso(totalDisponible)}</strong>
          </div>
        </div>
      </section>

      <section className="route-layout">
        <div className="panel">
          <h3 className="panel-title">
            <Route size={18} />
            Órdenes sin asignar
          </h3>

          <div className="route-sequence">
            {ordenesSinAsignar.length === 0 ? (
              <p className="empty-text">No hay órdenes listas sin asignar.</p>
            ) : (
              ordenesSinAsignar.map((orden, index) => {
                const pendiente = pendientes[orden.numero] ?? {
                  dia: diaSeleccionado,
                  camion: "Camión 1" as Camion,
                };

                return (
                  <div key={orden.numero} style={orderRowStyle}>
                    <span className="route-position">{index + 1}</span>

                    <div style={{ minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => abrirOrden(orden)}
                        style={{
                          border: 0,
                          background: "transparent",
                          padding: 0,
                          textAlign: "left",
                          cursor: "pointer",
                          width: "100%",
                        }}
                      >
                        <span style={orderTitleStyle}>ORD-{orden.numero}</span>
                        <span style={orderMetaStyle}>
                          {orden.sucursal} • {formatoPeso(pesoOrdenKg(orden))} • {orden.productos.length} productos
                        </span>
                      </button>

                      <div style={orderActionsStyle}>
                        <select
                          value={pendiente.dia}
                          onChange={(e) => actualizarPendiente(orden, { dia: e.target.value as DiaRuta })}
                          title="Día de ruta"
                          style={selectStyle}
                        >
                          {dias.map((dia) => (
                            <option key={dia} value={dia}>{dia}</option>
                          ))}
                        </select>

                        <select
                          value={pendiente.camion}
                          onChange={(e) => actualizarPendiente(orden, { camion: e.target.value as Camion })}
                          title="Camión"
                          style={selectStyle}
                        >
                          {camiones.map((camion) => (
                            <option key={camion} value={camion}>{camion}</option>
                          ))}
                        </select>

                        <button type="button" onClick={() => asignarOrden(orden)} style={assignBtnStyle}>
                          Asignar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <p className="route-note">
            Asigne cada orden a un día y camión. Una vez asignada, desaparece de esta lista.
          </p>
        </div>

        <div className="truck-plan-grid">
          {planPorCamion.map((plan) => {
            const ocupado = porcentaje(plan.pesoUsado, CAPACIDAD_CAMION_KG);
            const disponible = Math.max(CAPACIDAD_CAMION_KG - plan.pesoUsado, 0);
            const disponiblePct = Math.max(0, 100 - ocupado);

            return (
              <div key={plan.camion} className="panel truck-card">
                <div className="truck-header">
                  <div>
                    <h3 className="panel-title">
                      <Truck size={18} />
                      {plan.camion}
                    </h3>
                    <p>{plan.chofer}</p>
                  </div>
                  <strong>{ocupado}% usado</strong>
                </div>

                <div className="capacity-bar">
                  <span style={{ width: `${Math.min(ocupado, 100)}%` }}></span>
                </div>

                <div className="capacity-text">
                  <span>Usado: {formatoPeso(plan.pesoUsado)}</span>
                  <span>Disponible: {formatoPeso(disponible)} / {disponiblePct}%</span>
                </div>

                {plan.ordenes.length === 0 ? (
                  <p className="empty-text">No hay órdenes asignadas.</p>
                ) : (
                  <div className="route-orders">
                    {plan.ordenes.map((orden, index) => (
                      <div key={orden.numero} className="route-order-card">
                        <button type="button" className="route-order-left" onClick={() => abrirOrden(orden)}>
                          <span className="route-position">{index + 1}</span>
                          <div>
                            <strong>ORD-{orden.numero}</strong>
                            <p>
                              {orden.sucursal} • {formatoPeso(pesoOrdenKg(orden))} • {orden.productos.length} productos
                            </p>
                          </div>
                        </button>

                        <select
                          value={(getAsignacionReal(orden as OrdenRuta)?.camion || plan.camion) as Camion}
                          onChange={(e) => cambiarCamion(orden, e.target.value as Camion)}
                          style={selectStyle}
                        >
                          {camiones.map((camion) => (
                            <option key={camion} value={camion}>{camion}</option>
                          ))}
                        </select>

                        <button type="button" onClick={() => quitarAsignacion(orden)} style={assignBtnStyle}>
                          Quitar
                        </button>

                        <span className={`badge ${estadoBadgeClase(orden.estado)}`}>{orden.estado}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default PlaneacionRutas;
