export function normalizarTextoPeso(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

export function inferirPesoUnitarioKg(nombre?: string, descripcion?: string, unidadMedida?: string, pesoUnitarioKg?: number) {
  const pesoExistente = Number(pesoUnitarioKg || 0);
  if (pesoExistente > 0) return pesoExistente;

  const texto = normalizarTextoPeso(`${nombre || ""} ${descripcion || ""}`);

  const matchKg = texto.match(/(\d+(?:[.,]\d+)?)\s*(KG|KGS|KILOS|KILOGRAMOS)\b/);
  if (matchKg) return Number(matchKg[1].replace(",", "."));

  const matchGr = texto.match(/(\d+(?:[.,]\d+)?)\s*(G|GR|GRM|GRAMOS)\b/);
  if (matchGr) return Number(matchGr[1].replace(",", ".")) / 1000;

  const unidad = normalizarTextoPeso(unidadMedida || "");
  if (["KG", "KGS", "KILOGRAMO", "KILOGRAMOS"].includes(unidad)) return 1;
  if (["GRM", "G", "GR", "GRAMO", "GRAMOS"].includes(unidad)) return 0.001;
  if (["LTR", "L", "LT", "LITRO", "LITROS"].includes(unidad)) return 1;

  return 0;
}

export function pesoProductoKg(producto: { nombre?: string; descripcion?: string; cantidad?: number; unidadMedida?: string; pesoUnitarioKg?: number }) {
  const cantidad = Number(producto.cantidad || 0);
  const pesoUnitario = inferirPesoUnitarioKg(producto.nombre, producto.descripcion, producto.unidadMedida, producto.pesoUnitarioKg);
  return cantidad * pesoUnitario;
}
