import { Boxes, ClipboardList, LayoutDashboard, Map, Truck, Warehouse } from "lucide-react";
import type { Vista } from "../types/orden";

type Props = {
  vista: Vista;
  setVista: (vista: Vista) => void;
};

function Header({ vista, setVista }: Props) {
  return (
    <header className="topbar">
      <div className="flex items-center gap-3">
        <div className="bg-green-500">
          <Boxes size={18} />
        </div>

        <div>
          <h1 className="topbar-title">Sistema de Alisto</h1>
          <p className="topbar-subtitle">Gestión de Pedidos y Entregas</p>
        </div>
      </div>

      <div className="mode-switch">
        <button onClick={() => setVista("bodega")} className={`mode-btn ${vista === "bodega" ? "active" : ""}`}>
          <Warehouse size={16} />
          Bodega
        </button>

        <button onClick={() => setVista("chofer")} className={`mode-btn ${vista === "chofer" ? "active" : ""}`}>
          <Truck size={16} />
          Chofer
        </button>

        <button onClick={() => setVista("resumen")} className={`mode-btn ${vista === "resumen" ? "active" : ""}`}>
          <LayoutDashboard size={16} />
          Resumen
        </button>

        <button onClick={() => setVista("faltantes")} className={`mode-btn ${vista === "faltantes" ? "active" : ""}`}>
          <ClipboardList size={16} />
          Faltantes
        </button>

        <button onClick={() => setVista("rutas")} className={`mode-btn ${vista === "rutas" ? "active" : ""}`}>
          <Map size={16} />
          Planeación de Rutas
        </button>
        <button
        className="mode-btn logout-btn"
         onClick={() => {
          localStorage.removeItem("alisto-user");
          sessionStorage.removeItem("alisto-user");
          window.location.href = "/";
  }}
>
  Salir
</button>
      </div>
    </header>
  );
}

export default Header;
