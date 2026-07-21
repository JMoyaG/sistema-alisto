export type Estado =
  | "Pendiente"
  | "Alistando"
  | "Listo"
  | "Pendiente de Carga"
  | "En Camión"
  | "En Entrega"
  | "Entregado";

export type Producto = {
  nombre: string;
  descripcion: string;
  codigo: string;
  cantidad: number;
  cantidadOriginal: number;
  pesoUnitarioKg?: number;
  pesoTotalKg?: number;
  unidadMedida?: string;
  faltante?: boolean;
  cantidadFaltante?: number;
  estadoPreparacion?: "Alistando" | "Listo" | "";
};

export type Orden = {
  numero: string;
  referencia?: string | number;
  cliente?: string;
  fecha: string;
  fechaEntrega?: string;
  sucursal: string;
  bodegaOrigen?: string;
  estadoSql?: string;

  chofer?: string;
  camion?: string;
  diaRuta?: string;
  confirmada?: boolean;

  rutaAsignada?: string;

  estado: Estado;
  productos: Producto[];
};

export type Vista =
  | "bodega"
  | "chofer"
  | "resumen"
  | "faltantes"
  | "rutas";