import type { Estado } from "../types/orden";

export function estadoClase(estado: Estado) {
  switch (estado) {
    case "Pendiente":
      return "estado-pendiente";
    case "Alistando":
      return "estado-alistando";
    case "Listo":
    case "Pendiente de Carga":
      return "estado-listo";
    case "En Camión":
      return "estado-camion";
    case "En Entrega":
      return "estado-entrega";
    case "Entregado":
      return "estado-entregado";
    default:
      return "";
  }
}

export function estadoBadgeClase(estado: Estado) {
  switch (estado) {
    case "Pendiente":
      return "badge-yellow";
    case "Alistando":
      return "badge-blue";
    case "Listo":
    case "Pendiente de Carga":
      return "badge-purple";
    case "En Camión":
      return "badge-green";
    case "En Entrega":
      return "badge-orange";
    case "Entregado":
      return "badge-green";
    default:
      return "badge-purple";
  }
}
