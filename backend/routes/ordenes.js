const express = require("express");
const router = express.Router();
const { getPool } = require("../db");

function agruparOrdenes(data) {
  const ordenesMap = {};

  data.forEach((item) => {
    const numero = String(item.requisicion || item.referencia);

    if (!ordenesMap[numero]) {
      ordenesMap[numero] = {
        numero,
        referencia: item.referencia,
        cliente: "Orden CEDI",
        fecha: item.fecha || new Date().toISOString(),
        sucursal: item.sucursal || "Sin sucursal",
        bodegaOrigen: item.bodegaOrigen || "",
        estadoSql: item.estadoSql || "",
        estado: "Pendiente",
        productos: [],
      };
    }

    ordenesMap[numero].productos.push({
      nombre: item.producto || "Producto sin nombre",
      descripcion: item.codigo || "",
      codigo: item.codigo || "",
      cantidad: Number(item.cantidad || 0),
      cantidadOriginal: Number(item.cantidad || 0),
      unidadMedida: item.unidadMedida || "UND",
      pesoUnitarioKg: Number(item.pesoUnitarioKg || 0),
      faltante: false,
      cantidadFaltante: 0,
    });
  });

  return Object.values(ordenesMap);
}

router.get("/", async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
       SELECT  
          D.idDocEntradaSalida AS referencia,
          D.NumEntSalida AS requisicion,
          ME.Descripcion AS estadoSql,
          BOcat.Descripcion AS bodegaOrigen,
          BDcat.Descripcion AS sucursal,
          DP.Codigo AS codigo,
          PR.DescripLarga AS producto,
          DP.Cantidad AS cantidad,
          D.FechaProceso AS fecha,
          0 AS pesoUnitarioKg,
          ISNULL(PR.idUnidadMedida, '') AS medida
      FROM inDocEntradaSalida D
      LEFT JOIN inDocEntSalProdDetalle DP
          ON D.idDocEntradaSalida = DP.idDocEntradaSalida
      LEFT JOIN inProductos PR
          ON DP.idProducto = PR.idProducto
      LEFT JOIN inMovEstado ME
          ON D.idMovEstado = ME.idMovEstado
      LEFT JOIN inBodegas BO
          ON D.idBodegaOrigen = BO.idBodega
      LEFT JOIN inBodegaCat BOcat
          ON BO.idBodegaCat = BOcat.idBodegaCat
      LEFT JOIN inBodegas BD
          ON D.idBodegaDestino = BD.idBodega
      LEFT JOIN inBodegaCat BDcat
          ON BD.idBodegaCat = BDcat.idBodegaCat
      WHERE DP.Codigo IS NOT NULL  and CAST(D.FechaIngreso AS DATE) >= '2026-05-08' and ME.Descripcion = 'Aprobado' and BOcat.Descripcion ='CEDI GRUPO SURCO'
      ORDER BY D.idDocEntradaSalida DESC
    `);

    res.json(agruparOrdenes(result.recordset));
  } catch (error) {
    console.error("Error consultando órdenes:", error);

    res.status(500).json({
      message: "Error consultando SQL Server",
      error: error.message,
    });
  }
});

module.exports = router;
