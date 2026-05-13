import { ChevronRight, MapPin, Package } from "lucide-react";
import type { Estado, Vista } from "../types/orden";
import { estadoClase } from "../utils/estado";

type Props = {
  sucursal: string;
  cantidad: number;
  vista: Vista;
  estadoPrincipal?: Estado;
  onClick: () => void;
};

function BranchCard({ sucursal, cantidad, vista, estadoPrincipal, onClick }: Props) {
  const activa = cantidad > 0;
  const claseEstado = activa && estadoPrincipal ? estadoClase(estadoPrincipal) : "";

  return (
    <button
      onClick={onClick}
      disabled={!activa}
      className={`branch-card ${
        activa ? (vista === "bodega" ? "active-bodega" : "active-chofer") : ""
      } ${claseEstado}`}
    >
      <div
        className={`branch-icon ${
          activa ? (vista === "bodega" ? "blue" : "green") : "gray"
        }`}
      >
        <MapPin size={16} />
      </div>

      {activa && (
        <span className={`branch-count ${vista === "chofer" ? "green" : ""}`}>
          {cantidad}
        </span>
      )}

      <h3 className="branch-name">{sucursal}</h3>

      <p className="branch-status">
        {activa ? (
          <>
            <Package size={12} />
            {cantidad} {vista === "bodega" ? "órdenes" : "entregas"}
          </>
        ) : vista === "bodega" ? (
          "Sin órdenes pendientes"
        ) : (
          "Sin entregas asignadas"
        )}
      </p>

      {activa && <ChevronRight className="branch-arrow" size={16} />}
    </button>
  );
}

export default BranchCard;
