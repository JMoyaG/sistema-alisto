const express = require("express");
const msal = require("@azure/msal-node");
const { getPool, sqlConfig } = require("../db");

const router = express.Router();

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  SP_HOSTNAME,
  SP_SITE_PATH,
} = process.env;

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const columnMapCache = new Map();

const msalClient = new msal.ConfidentialClientApplication({
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    clientSecret: AZURE_CLIENT_SECRET,
  },
});

function getColumnType(column) {
  if (column.lookup) return "lookup";
  if (column.personOrGroup) return "personOrGroup";
  if (column.number) return "number";
  if (column.boolean) return "boolean";
  if (column.dateTime) return "dateTime";
  if (column.choice) return "choice";
  if (column.text) return "text";
  return "other";
}

function cleanText(value) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

function cleanNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function getAccessToken() {
  const result = await msalClient.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });

  if (!result?.accessToken) {
    throw new Error("No se pudo obtener token de Azure");
  }

  return result.accessToken;
}

async function graphRequest(url, options = {}) {
  const token = await getAccessToken();

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();

  if (!res.ok) {
    console.log("GRAPH ERROR STATUS:", res.status);
    console.log("GRAPH ERROR URL:", url);
    console.log("GRAPH ERROR BODY:", text);
    throw new Error(`Graph error ${res.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function getSiteId() {
  const data = await graphRequest(
    `${GRAPH_BASE}/sites/${SP_HOSTNAME}:${SP_SITE_PATH}`
  );
  return data.id;
}

async function getListId(siteId, listName) {
  const data = await graphRequest(
    `${GRAPH_BASE}/sites/${siteId}/lists?$filter=displayName eq '${listName}'`
  );

  if (!data.value?.length) {
    throw new Error(`No encontré la lista: ${listName}`);
  }

  return data.value[0].id;
}

async function getColumnMap(listName, forceRefresh = false) {
  if (!forceRefresh && columnMapCache.has(listName)) {
    return columnMapCache.get(listName);
  }

  const siteId = await getSiteId();
  const listId = await getListId(siteId, listName);

  const data = await graphRequest(
    `${GRAPH_BASE}/sites/${siteId}/lists/${listId}/columns`
  );

  const map = {};
  const columns = [];

  for (const c of data.value || []) {
  if (
    c.readOnly ||
    c.hidden ||
    c.name === "LinkTitle" ||
    c.name === "LinkTitleNoMenu"
  ) {
    continue;
  }

  const info = {
    displayName: c.displayName,
    internalName: c.name,
    type: getColumnType(c),
    required: c.required || false,
    hidden: c.hidden || false,
  };

  columns.push(info);
  map[c.displayName] = info;
  map[c.name] = info;
}

  const titleInfo = {
    displayName: "Título",
    internalName: "Title",
    type: "text",
    required: false,
    hidden: false,
  };

  map["Título"] = map.Title || titleInfo;
  map.Titulo = map.Title || titleInfo;
  map.Title = map.Title || titleInfo;

  const result = { map, columns };
  columnMapCache.set(listName, result);
  return result;
}

async function normalizeFields(listName, fields) {
  const { map } = await getColumnMap(listName);
  const normalized = {};

  for (const [key, rawValue] of Object.entries(fields)) {
    const info = map[key];

    if (!info) {
      console.log(`Campo ignorado en ${listName}:`, key);
      continue;
    }

    if (rawValue === undefined || rawValue === null) continue;

    if (info.type === "lookup" || info.type === "personOrGroup") {
      const lookupId = Number(
        typeof rawValue === "object" ? rawValue.lookupId : rawValue
      );

      if (Number.isFinite(lookupId) && lookupId > 0) {
        normalized[`${info.internalName}LookupId`] = lookupId;
      }
      continue;
    }

    if (info.type === "number") {
      normalized[info.internalName] = cleanNumber(rawValue);
      continue;
    }

    if (info.type === "boolean") {
      normalized[info.internalName] = Boolean(rawValue);
      continue;
    }

    if (info.type === "dateTime") {
      normalized[info.internalName] = rawValue
        ? new Date(rawValue).toISOString()
        : new Date().toISOString();
      continue;
    }

    normalized[info.internalName] = cleanText(rawValue);
  }

  return normalized;
}

async function createListItem(listName, fields) {
  const siteId = await getSiteId();
  const listId = await getListId(siteId, listName);
  const normalizedFields = await normalizeFields(listName, fields);

  console.log("Creando en lista:", listName);
  console.log("Fields enviados:", normalizedFields);

  return graphRequest(`${GRAPH_BASE}/sites/${siteId}/lists/${listId}/items`, {
    method: "POST",
    body: JSON.stringify({ fields: normalizedFields }),
  });
}

async function updateListItem(listName, itemId, fields) {
  const siteId = await getSiteId();
  const listId = await getListId(siteId, listName);
  const normalizedFields = await normalizeFields(listName, fields);

  return graphRequest(
    `${GRAPH_BASE}/sites/${siteId}/lists/${listId}/items/${itemId}/fields`,
    {
      method: "PATCH",
      body: JSON.stringify(normalizedFields),
    }
  );
}

async function getItems(listName) {
  const siteId = await getSiteId();
  const listId = await getListId(siteId, listName);

  let url = `${GRAPH_BASE}/sites/${siteId}/lists/${listId}/items?expand=fields&$top=999`;
  const value = [];

  while (url) {
    const data = await graphRequest(url);
    value.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }

  return { value };
}

function escapeODataText(value) {
  return String(value ?? "").replace(/'/g, "''");
}

async function getItemsByTextFieldValues(listName, fieldName, values) {
  const uniqueValues = Array.from(
    new Set((values || []).map((value) => cleanText(value)).filter(Boolean))
  );

  if (!uniqueValues.length) {
    return { value: [] };
  }

  const siteId = await getSiteId();
  const listId = await getListId(siteId, listName);
  const { map } = await getColumnMap(listName);
  const internalFieldName = map[fieldName]?.internalName || fieldName;
  const items = [];

  try {
    // Microsoft Graph limita la complejidad del filtro. Se consultan grupos pequeños
    // para evitar descargar completa la lista DetalleOrden en cada carga.
    for (let index = 0; index < uniqueValues.length; index += 15) {
      const chunk = uniqueValues.slice(index, index + 15);
      const filter = chunk
        .map(
          (value) =>
            `fields/${internalFieldName} eq '${escapeODataText(value)}'`
        )
        .join(" or ");

      let url =
        `${GRAPH_BASE}/sites/${siteId}/lists/${listId}/items` +
        `?expand=fields&$top=999&$filter=${encodeURIComponent(filter)}`;

      while (url) {
        const data = await graphRequest(url, {
          headers: {
            Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
          },
        });

        items.push(...(data.value || []));
        url = data["@odata.nextLink"] || null;
      }
    }

    const uniqueItems = new Map(items.map((item) => [String(item.id), item]));
    return { value: Array.from(uniqueItems.values()) };
  } catch (error) {
    console.log(
      `Filtro rápido no disponible para ${listName}.${fieldName}; usando respaldo:`,
      error.message
    );

    const data = await getItems(listName);
    const wanted = new Set(uniqueValues);

    return {
      value: data.value.filter((item) =>
        wanted.has(cleanText(item.fields?.[internalFieldName] ?? item.fields?.[fieldName]))
      ),
    };
  }
}

function fechaEnCostaRica(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "";
}

function fechaConsultaValida(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
    ? String(value)
    : fechaEnCostaRica(new Date());
}

async function getItemsWithFilter(listName, filter) {
  const siteId = await getSiteId();
  const listId = await getListId(siteId, listName);
  const value = [];
  let url =
    `${GRAPH_BASE}/sites/${siteId}/lists/${listId}/items` +
    `?expand=fields&$top=999&$filter=${encodeURIComponent(filter)}`;

  while (url) {
    const data = await graphRequest(url, {
      headers: {
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    });

    value.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }

  return { value };
}

function rangoUtcCostaRica(fecha) {
  const inicio = new Date(`${fecha}T06:00:00.000Z`);
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

  return {
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
  };
}

async function getOrdenesVisibles(fechaEntregadas) {
  const estadosActivos = [
    "Pendiente",
    "Alistando",
    "Listo",
    "Pendiente de Carga",
    "En Camión",
    "En Entrega",
  ];

  const activosData = await getItemsByTextFieldValues(
    "OrdenesAlisto",
    "Estado",
    estadosActivos
  );

  let entregadosData;

  try {
    const { map } = await getColumnMap("OrdenesAlisto");
    const estadoField = map.Estado?.internalName || "Estado";
    const fechaField = map.FechaEntrega?.internalName || "FechaEntrega";
    const { inicio, fin } = rangoUtcCostaRica(fechaEntregadas);

    const entregadosPorFecha = await getItemsWithFilter(
      "OrdenesAlisto",
      `fields/${fechaField} ge '${inicio}' and fields/${fechaField} lt '${fin}'`
    );

    entregadosData = {
      value: entregadosPorFecha.value.filter(
        (item) => cleanText(item.fields?.[estadoField] ?? item.fields?.Estado) === "Entregado"
      ),
    };
  } catch (error) {
    console.log(
      "Filtro de FechaEntrega no disponible; usando respaldo por estado:",
      error.message
    );

    const todosEntregados = await getItemsByTextFieldValues(
      "OrdenesAlisto",
      "Estado",
      ["Entregado"]
    );

    entregadosData = {
      value: todosEntregados.value.filter((item) => {
        const fields = item.fields || {};
        const fechaEntrega =
          fields.FechaEntrega || item.lastModifiedDateTime || fields.FechaCreacion;

        return fechaEnCostaRica(fechaEntrega) === fechaEntregadas;
      }),
    };
  }

  const items = [...activosData.value, ...entregadosData.value];
  const uniqueItems = new Map(items.map((item) => [String(item.id), item]));
  return Array.from(uniqueItems.values());
}

async function findItemByField(listName, fieldName, value) {
  const data = await getItemsByTextFieldValues(listName, fieldName, [value]);
  const { map } = await getColumnMap(listName);
  const internalFieldName = map[fieldName]?.internalName || fieldName;
  const safeValue = String(value);

  return (
    data.value?.find((item) => {
      const fields = item.fields || {};
      return (
        String(fields[internalFieldName] ?? "") === safeValue ||
        String(fields[fieldName] ?? "") === safeValue ||
        String(fields.Title ?? "") === safeValue
      );
    }) || null
  );
}

async function findRutaByDiaCamion(dia, camion) {
  const data = await getItems("Rutas");
  return (
    data.value?.find((item) => {
      const fields = item.fields || {};
      return String(fields.Dia || "") === String(dia || "") && String(fields.Camion || "") === String(camion || "");
    }) || null
  );
}

async function findRutaDetalleByOrden(orden) {
  const data = await getItems("RutaDetalle");
  return (
    data.value?.find((item) => {
      const fields = item.fields || {};
      return String(fields.Orden || "") === String(orden || "");
    }) || null
  );
}

function buildDetalleFields(orden, producto, ordenSpItemId) {
  const title = `${orden.id} - ${producto.codigo}`;

  return {
    Título: title,
    IdOrden: String(orden.id),
    IdOrdenLookupId: Number(ordenSpItemId),
    Producto: producto.producto,
    Codigo: producto.codigo,
    Cantidad: producto.cantidad,
    CantidadOriginal: producto.cantidadOriginal,
    PesoUnitarioKg: producto.pesoUnitarioKg,
    PesoTotalKg: producto.pesoTotalKg,
    Medida: producto.medida,
  };
}

async function createDetalleSeguro(orden, producto, ordenSpItemId) {
  const fullFields = buildDetalleFields(orden, producto, ordenSpItemId);

  try {
    return await createListItem("DetalleOrden", fullFields);
  } catch (fullError) {
    console.log("Falló detalle completo:", fullError.message);
  }

  const mediumFields = {
  Título: `${orden.id} - ${producto.codigo}`,
  IdOrden: String(orden.id),
  IdOrdenLookupId: Number(ordenSpItemId),
  Producto: producto.producto,
  Codigo: producto.codigo,
  Cantidad: producto.cantidad,
};

  try {
    return await createListItem("DetalleOrden", mediumFields);
  } catch (mediumError) {
    console.log("Falló detalle básico:", mediumError.message);
  }

  return createListItem("DetalleOrden", {
    Título: `${orden.id} - ${producto.codigo} - ${producto.producto} - Cant: ${producto.cantidad}`,
  });
}

router.get("/test-sql", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        @@SERVERNAME AS serverName,
        DB_NAME() AS databaseName,
        SUSER_SNAME() AS loginName,
        SYSTEM_USER AS systemUser,
        GETDATE() AS fechaServidor
    `);

    res.json({
      ok: true,
      message: "SQL Server conectado correctamente",
      config: {
        server: sqlConfig.server,
        port: sqlConfig.port,
        database: sqlConfig.database,
        user: sqlConfig.user,
        encrypt: sqlConfig.options.encrypt,
        trustServerCertificate: sqlConfig.options.trustServerCertificate,
      },
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("Error test SQL:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/test", async (req, res) => {
  try {
    const siteId = await getSiteId();
    res.json({ ok: true, message: "Azure Graph conectado correctamente", siteId });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/debug-columns/:listName", async (req, res) => {
  try {
    const info = await getColumnMap(req.params.listName, true);
    res.json({ ok: true, listName: req.params.listName, columns: info.columns });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/orden", async (req, res) => {
  try {
    const orden = req.body;
    const existente = await findItemByField("OrdenesAlisto", "IdOrden", orden.id);

    const fields = {
      Título: String(orden.id || ""),
      IdOrden: String(orden.id || ""),
      Origen: orden.origen || "Manual",
      Sucursal: orden.sucursal || "",
      Estado: orden.estado || "Pendiente",
      FechaCreacion: orden.fechaCreacion || new Date().toISOString(),
      Chofer: orden.chofer || "",
      Camion: orden.camion || "",
      DiaRuta: orden.diaRuta || "",
      Confirmada: orden.confirmada || false,
    };

    if (existente) {
      const updated = await updateListItem("OrdenesAlisto", existente.id, fields);
      return res.json({ ok: true, message: "Orden actualizada", item: updated });
    }

    const item = await createListItem("OrdenesAlisto", fields);
    res.json({ ok: true, message: "Orden guardada", item });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/detalle", async (req, res) => {
  try {
    const p = req.body;
    const orden = { id: String(p.idOrden || "") };
    const producto = {
      codigo: cleanText(p.codigo),
      producto: cleanText(p.producto),
      cantidad: cleanNumber(p.cantidad),
      cantidadOriginal: cleanNumber(p.cantidadOriginal || p.cantidad),
      pesoUnitarioKg: cleanNumber(p.pesoUnitarioKg),
      pesoTotalKg: cleanNumber(p.pesoTotalKg),
      medida: cleanText(p.medida),
    };

    const ordenSp = await findItemByField("OrdenesAlisto", "IdOrden", orden.id);
    const item = await createDetalleSeguro(orden, producto, ordenSp?.id);

    res.json({ ok: true, message: "Detalle guardado", item });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/faltante", async (req, res) => {
  try {
    const f = req.body;

    const item = await createListItem("Faltantes", {
      Título: `${f.idOrden || ""} - ${f.producto || ""}`,
      IdOrden: String(f.idOrden || ""),
      Producto: String(f.producto || ""),
      CantidadFaltante: Number(f.cantidadFaltante || 0),
      Fecha: f.fecha || new Date().toISOString(),
    });

    res.json({ ok: true, message: "Faltante guardado", item });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/ruta", async (req, res) => {
  try {
    const r = req.body;
    const fields = {
      Título: `${r.dia || ""} - ${r.camion || ""}`,
      Dia: r.dia || "",
      Camion: r.camion || "",
      Chofer: r.chofer || "",
      Confirmada: r.confirmada || false,
      Fecha: r.fecha || new Date().toISOString(),
    };

    const existente = await findRutaByDiaCamion(r.dia, r.camion);

    if (existente) {
      const item = await updateListItem("Rutas", existente.id, fields);
      return res.json({ ok: true, message: "Ruta actualizada", item, updated: true });
    }

    const item = await createListItem("Rutas", fields);
    res.json({ ok: true, message: "Ruta guardada", item, created: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/ruta-detalle", async (req, res) => {
  try {
    const d = req.body;
    const fields = {
      Título: `${d.dia || ""} - ${d.orden || ""}`,
      Dia: d.dia || "",
      Orden: d.orden || "",
      Sucursal: d.sucursal || "",
      Posicion: Number(d.posicion || 0),
      Camion: d.camion || "",
    };

    const existente = await findRutaDetalleByOrden(d.orden);

    if (existente) {
      const item = await updateListItem("RutaDetalle", existente.id, fields);
      return res.json({ ok: true, message: "Ruta detalle actualizado", item, updated: true });
    }

    const item = await createListItem("RutaDetalle", fields);
    res.json({ ok: true, message: "Ruta detalle guardado", item, created: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/estado", async (req, res) => {
  try {
    const { idOrden, estado, chofer, camion, diaRuta, confirmada } = req.body;

    const item = await findItemByField("OrdenesAlisto", "IdOrden", idOrden);

    if (!item) {
      return res.status(404).json({
        ok: false,
        error: `No encontré la orden ${idOrden} en SharePoint`,
      });
    }

    const updated = await updateListItem("OrdenesAlisto", item.id, {
      Estado: estado,
      Chofer: chofer ?? item.fields.Chofer ?? "",
      Camion: camion ?? item.fields.Camion ?? "",
      DiaRuta: diaRuta ?? item.fields.DiaRuta ?? "",
      Confirmada: confirmada ?? item.fields.Confirmada ?? false,
      ...(estado === "Entregado" ? { FechaEntrega: new Date().toISOString() } : {}),
    });

    res.json({ ok: true, message: "Estado actualizado", item: updated });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/ordenes", async (req, res) => {
  try {
    const fechaEntregadas = fechaConsultaValida(req.query.fechaEntregadas);
    const visibles = await getOrdenesVisibles(fechaEntregadas);

    const ordenes = visibles.map((item) => ({
      spId: item.id,
      ...item.fields,
      FechaEntrega:
        item.fields?.FechaEntrega ||
        (cleanText(item.fields?.Estado) === "Entregado"
          ? item.lastModifiedDateTime || ""
          : ""),
    }));

    res.json({ ok: true, fechaEntregadas, ordenes });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/carga", async (req, res) => {
  try {
    const fechaEntregadas = fechaConsultaValida(req.query.fechaEntregadas);
    const ordenesItems = await getOrdenesVisibles(fechaEntregadas);

    const idsOrden = ordenesItems
      .map((item) => cleanText(item.fields?.IdOrden ?? item.fields?.Title))
      .filter(Boolean);

    const [detallesData, faltantesData] = await Promise.all([
      getItemsByTextFieldValues("DetalleOrden", "IdOrden", idsOrden),
      getItemsByTextFieldValues("Faltantes", "IdOrden", idsOrden),
    ]);

    const ordenes = ordenesItems.map((item) => ({
      spId: item.id,
      ...item.fields,
      FechaEntrega:
        item.fields?.FechaEntrega ||
        (cleanText(item.fields?.Estado) === "Entregado"
          ? item.lastModifiedDateTime || ""
          : ""),
    }));

    const detalles = detallesData.value.map((item) => ({
      spId: item.id,
      ...item.fields,
    }));

    const faltantes = faltantesData.value.map((item) => ({
      spId: item.id,
      ...item.fields,
    }));

    res.json({
      ok: true,
      fechaEntregadas,
      conteos: {
        ordenes: ordenes.length,
        detalles: detalles.length,
        faltantes: faltantes.length,
      },
      ordenes,
      detalles,
      faltantes,
    });
  } catch (error) {
    console.error("Error carga optimizada:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/sync-sql", async (req, res) => {
  try {
    const pool = await getPool();
    const top = Number(req.query.top || 25);
    const safeTop = Number.isFinite(top) && top > 0 && top <= 500 ? top : 25;

    const result = await pool.request().query(`
      SELECT
          CAST(D.idDocEntradaSalida AS varchar(50)) AS referencia,
          CAST(D.NumEntSalida AS varchar(50)) AS requisicion,
          DP.Codigo AS codigo,
          MAX(PR.DescripLarga) AS producto,
          SUM(ISNULL(DP.Cantidad, 0)) AS cantidad,
          ISNULL(MAX(PR.Cantidad), 0) AS pesoUnitarioKg,
          ISNULL(MAX(PR.idUnidadMedida), '') AS medida,
          MAX(BDcat.Descripcion) AS sucursal,
          MAX(D.FechaIngreso) AS fecha
      FROM inDocEntradaSalida D
      INNER JOIN inDocEntSalProdDetalle DP
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
      WHERE
          DP.Codigo IS NOT NULL
          AND DP.Cantidad > 0
          AND ME.Descripcion IN ('Procesado', 'Aprobado')
          AND BOcat.Descripcion = 'CEDI GRUPO SURCO'
          AND D.FechaIngreso >= DATEADD(DAY, -2, GETDATE())
      GROUP BY
          D.idDocEntradaSalida,
          D.NumEntSalida,
          DP.Codigo
      HAVING SUM(ISNULL(DP.Cantidad, 0)) <> 0;
    `);

    console.log("Filas SQL encontradas:", result.recordset.length);
    console.log("Primera fila SQL:", result.recordset[0]);

    const ordenesMap = new Map();

    for (const row of result.recordset) {
      const idOrden = cleanText(row.referencia);
      if (!idOrden) continue;

      if (!ordenesMap.has(idOrden)) {
        ordenesMap.set(idOrden, {
          id: idOrden,
          requisicion: cleanText(row.requisicion),
          sucursal: cleanText(row.sucursal),
          fechaCreacion: row.fecha,
          productos: [],
        });
      }

      const cantidad = cleanNumber(row.cantidad);
      const pesoUnitarioKg = cleanNumber(row.pesoUnitarioKg);

      ordenesMap.get(idOrden).productos.push({
        codigo: cleanText(row.codigo),
        producto: cleanText(row.producto),
        cantidad,
        cantidadOriginal: cantidad,
        pesoUnitarioKg,
        pesoTotalKg: cantidad * pesoUnitarioKg,
        medida: cleanText(row.medida),
      });
    }

    let ordenesCreadas = 0;
    let ordenesExistentes = 0;
    let detallesCreados = 0;
    let detallesExistentes = 0;
    const erroresDetalle = [];

    const idsOrdenSql = Array.from(ordenesMap.keys());
    const [ordenesData, detallesData] = await Promise.all([
      getItemsByTextFieldValues("OrdenesAlisto", "IdOrden", idsOrdenSql),
      getItemsByTextFieldValues("DetalleOrden", "IdOrden", idsOrdenSql),
    ]);

    const ordenesPorId = new Map(
      ordenesData.value.map((item) => [
        cleanText(item.fields?.IdOrden ?? item.fields?.Title),
        item,
      ])
    );

    const detallesExistentesSet = new Set(
      detallesData.value.map((item) => {
        const fields = item.fields || {};
        return `${cleanText(fields.IdOrden)}|${cleanText(fields.Codigo)}`;
      })
    );

    for (const orden of ordenesMap.values()) {
      let ordenSpItem = ordenesPorId.get(orden.id);

      if (!ordenSpItem) {
        ordenSpItem = await createListItem("OrdenesAlisto", {
          Título: orden.id,
          IdOrden: orden.id,
          Origen: "SQL",
          Sucursal: orden.sucursal,
          Estado: "Pendiente",
          FechaCreacion: orden.fechaCreacion
            ? new Date(orden.fechaCreacion).toISOString()
            : new Date().toISOString(),
          Chofer: "",
          Camion: "",
          DiaRuta: "",
          Confirmada: false,
        });
        ordenesPorId.set(orden.id, ordenSpItem);
        ordenesCreadas++;
      } else {
        ordenesExistentes++;
      }

      for (const p of orden.productos) {
        const detalleKey = `${orden.id}|${p.codigo}`;

        if (detallesExistentesSet.has(detalleKey)) {
          detallesExistentes++;
          continue;
        }

        try {
          console.log("Creando detalle:", orden.id, p.codigo);
          await createDetalleSeguro(orden, p, ordenSpItem?.id);
          detallesExistentesSet.add(detalleKey);
          detallesCreados++;
        } catch (detalleError) {
          erroresDetalle.push({
            orden: orden.id,
            codigo: p.codigo,
            error: detalleError.message,
          });
          console.log("No se pudo crear detalle:", orden.id, p.codigo, detalleError.message);
        }
      }
    }

    res.json({
      ok: erroresDetalle.length === 0,
      message:
        erroresDetalle.length === 0
          ? "Sincronización SQL → SharePoint completada"
          : "Sincronización parcial: algunas líneas de detalle fallaron",
      filasSql: result.recordset.length,
      ordenesSql: ordenesMap.size,
      ordenesCreadas,
      ordenesExistentes,
      detallesCreados,
      detallesExistentes,
      erroresDetalle,
    });
  } catch (error) {
    console.error("Error sync SQL -> SP:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});
router.get("/detalles", async (req, res) => {
  try {
    const data = await getItems("DetalleOrden");

    const detalles = data.value.map((item) => ({
      spId: item.id,
      ...item.fields,
    }));

    res.json({
      ok: true,
      detalles,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.post("/sync-productos", async (req, res) => {
  try {
    const detallesData = await getItems("DetalleOrden");
    const detalles = detallesData.value.map((item) => ({
      spId: item.id,
      ...item.fields,
    }));

    const productosMap = new Map();

    for (const d of detalles) {
      const codigo = String(d.Codigo || "").trim();
      if (!codigo) continue;

      if (!productosMap.has(codigo)) {
        productosMap.set(codigo, {
          Codigo: codigo,
          Producto: String(d.Producto || ""),
          UnidadMedida: String(d.Medida || "UND"),
          PesoUnitarioKg: Number(d.PesoUnitarioKg || 0),
          Activo: true,
        });
      }
    }

    const productosData = await getItems("Productos");
    const productosExistentes = productosData.value.map((item) => ({
      spId: item.id,
      ...item.fields,
    }));

    const existentes = new Set(
      productosExistentes.map((p) => String(p.Codigo || "").trim())
    );

    let creados = 0;

    for (const producto of productosMap.values()) {
      if (existentes.has(producto.Codigo)) continue;

      await createListItem("Productos", {
        Título: producto.Codigo,
        Codigo: producto.Codigo,
        Producto: producto.Producto,
        UnidadMedida: producto.UnidadMedida,
        PesoUnitarioKg: producto.PesoUnitarioKg,
        Activo: producto.Activo,
      });

      creados++;
    }

    res.json({
      ok: true,
      encontrados: productosMap.size,
      creados,
    });
  } catch (error) {
    console.error("Error sync productos:", error.message);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.get("/productos", async (req, res) => {
  try {
    const data = await getItems("Productos");

    const productos = data.value.map((item) => ({
      spId: item.id,
      ...item.fields,
    }));

    res.json({
      ok: true,
      productos,
    });
  } catch (error) {
    console.error("Error productos:", error.message);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.post("/producto", async (req, res) => {
  try {
    const p = req.body;

    const item = await createListItem("Productos", {
      Title: String(p.Codigo || ""),
      Codigo: String(p.Codigo || ""),
      Producto: String(p.Producto || ""),
      UnidadMedida: String(p.UnidadMedida || "UND"),
      PesoUnitarioKg: Number(p.PesoUnitarioKg || 0),
      Activo: Boolean(p.Activo),
    });

    res.json({
      ok: true,
      item,
    });
  } catch (error) {
    console.error("Error creando producto:", error.message);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});
router.post("/sync-productos-sql", async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT DISTINCT
          i.codigo AS Codigo,
          p.DescripLarga AS Producto,

          CASE
              WHEN p.idUnidadMedida IN ('Kg','Grm','Lbl') THEN 'Kg'
              WHEN p.idUnidadMedida IN ('Ltr','Ml','Cc','Gal') THEN 'Ltr'
              WHEN p.idUnidadMedida = 'Und' THEN 'UND'
              ELSE ISNULL(p.idUnidadMedida, 'UND')
          END AS UnidadMedida,

          ISNULL(p.Cantidad, 0) AS PesoUnitarioKg,

          1 AS Activo

      FROM inInventario i
      INNER JOIN inProductos p
          ON p.idProducto = i.idProducto

      WHERE i.codigo IS NOT NULL
          AND i.codigo <> ''

      ORDER BY i.codigo ASC
    `);

    console.log("Productos SQL encontrados:", result.recordset.length);

    const productosData = await getItems("Productos");

    const existentes = new Set(
      productosData.value.map((x) =>
        String(x.fields.Codigo || "").trim()
      )
    );

    let creados = 0;
    let existentesCount = 0;

    for (const p of result.recordset) {
      const codigo = cleanText(p.Codigo);

      if (!codigo) continue;

      if (existentes.has(codigo)) {
        existentesCount++;
        continue;
      }

      try {
        await createListItem("Productos", {
          Título: codigo,
          Codigo: codigo,
          Producto: cleanText(p.Producto),
          UnidadMedida: cleanText(p.UnidadMedida),
          PesoUnitarioKg: cleanNumber(p.PesoUnitarioKg),
          Activo: true,
        });

        creados++;
      } catch (err) {
        console.log("Error creando producto:", codigo, err.message);
      }
    }

    res.json({
      ok: true,
      encontradosSql: result.recordset.length,
      creados,
      existentes: existentesCount,
    });
  } catch (error) {
    console.error("Error sync productos SQL:", error.message);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.post("/sync-productos-sql", async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT DISTINCT
          i.codigo AS Codigo,
          p.DescripLarga AS Producto,
          CASE
              WHEN p.idUnidadMedida IN ('Kg','Grm','Lbl') THEN 'Kg'
              WHEN p.idUnidadMedida IN ('Ltr','Ml','Cc','Gal') THEN 'Ltr'
              WHEN p.idUnidadMedida = 'Und' THEN 'UND'
              ELSE ISNULL(p.idUnidadMedida, 'UND')
          END AS UnidadMedida,
          ISNULL(p.Cantidad, 0) AS PesoUnitarioKg,
          1 AS Activo
      FROM inInventario i
      INNER JOIN inProductos p
          ON p.idProducto = i.idProducto
      WHERE i.codigo IS NOT NULL
          AND i.codigo <> ''
      ORDER BY i.codigo ASC
    `);

    console.log("Productos SQL encontrados:", result.recordset.length);

    const productosData = await getItems("Productos");
    const existentes = new Set(
      productosData.value.map((x) => String(x.fields.Codigo || "").trim())
    );

    let creados = 0;
    let existentesCount = 0;
    let errores = 0;

    for (const p of result.recordset) {
      const codigo = cleanText(p.Codigo);
      if (!codigo) continue;

      if (existentes.has(codigo)) {
        existentesCount++;
        continue;
      }

      try {
        await createListItem("Productos", {
          Título: codigo,
          Codigo: codigo,
          Producto: cleanText(p.Producto),
          UnidadMedida: cleanText(p.UnidadMedida) || "UND",
          PesoUnitarioKg: cleanNumber(p.PesoUnitarioKg),
          Activo: true,
        });
        existentes.add(codigo);
        creados++;
      } catch (err) {
        errores++;
        console.log("Error creando producto:", codigo, err.message);
      }
    }

    res.json({
      ok: errores === 0,
      encontradosSql: result.recordset.length,
      creados,
      existentes: existentesCount,
      errores,
    });
  } catch (error) {
    console.error("Error sync productos SQL:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/faltantes", async (req, res) => {
  try {
    const data = await getItems("Faltantes");
    const faltantes = data.value.map((item) => ({ spId: item.id, ...item.fields }));
    res.json({ ok: true, faltantes });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});


router.post("/alisto", async (req, res) => {
  try {
    const { idOrden, productos = [] } = req.body;

    const ordenItem = await findItemByField("OrdenesAlisto", "IdOrden", idOrden);
    if (!ordenItem) {
      return res.status(404).json({ ok: false, error: `No encontré la orden ${idOrden}` });
    }

    const detallesData = await getItemsByTextFieldValues(
      "DetalleOrden",
      "IdOrden",
      [idOrden]
    );

    const detallesPorCodigo = new Map(
      detallesData.value.map((item) => [cleanText(item.fields?.Codigo), item])
    );

    let detallesActualizados = 0;
    let faltantesCreados = 0;

    for (const p of productos) {
      const codigo = cleanText(p.codigo);
      const cantidadOriginal = cleanNumber(p.cantidadOriginal || p.cantidad);
      const cantidadFaltante = cleanNumber(p.cantidadFaltante);
      const cantidadFinal = Math.max(cantidadOriginal - cantidadFaltante, 0);

      const detalle = detallesPorCodigo.get(codigo);
      if (detalle) {
        await updateListItem("DetalleOrden", detalle.id, {
          Cantidad: cantidadFinal,
          CantidadOriginal: cantidadOriginal,
          PesoTotalKg: cantidadFinal * cleanNumber(p.pesoUnitarioKg),
        });
        detallesActualizados++;
      }

      if (cantidadFaltante > 0) {
        await createListItem("Faltantes", {
          Título: `${idOrden} - ${codigo}`,
          IdOrden: String(idOrden),
          Producto: cleanText(p.nombre || p.producto || p.descripcion),
          CantidadFaltante: cantidadFaltante,
          Fecha: new Date().toISOString(),
        });
        faltantesCreados++;
      }
    }

    await updateListItem("OrdenesAlisto", ordenItem.id, { Estado: "Listo" });

    res.json({ ok: true, detallesActualizados, faltantesCreados, estado: "Listo" });
  } catch (error) {
    console.error("Error confirmar alisto:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/rutas", async (req, res) => {
  try {
    const data = await getItems("Rutas");
    const rutas = data.value.map((item) => ({ spId: item.id, ...item.fields }));
    res.json({ ok: true, rutas });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/ruta-detalles", async (req, res) => {
  try {
    const data = await getItems("RutaDetalle");
    const detalles = data.value.map((item) => ({ spId: item.id, ...item.fields }));
    res.json({ ok: true, detalles });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
router.get("/usuarios", async (req, res) => {
  try {
    const data = await getItems("UsuariosAlisto");

    const usuarios = data.value.map((item) => ({
      spId: item.id,
      ...item.fields,
    }));

    res.json({
      ok: true,
      usuarios,
    });
  } catch (error) {
    console.error("Error usuarios:", error.message);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;
