const express = require("express");
const cors = require("cors");
require("dotenv").config();

const ordenesRoutes = require("./routes/ordenes");
const sharepointRoutes = require("./routes/sharepoint");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Backend Sistema de Alisto funcionando" });
});

app.use("/api/ordenes", ordenesRoutes);
app.use("/api/sharepoint", sharepointRoutes);

const PORT = process.env.PORT || 3001;
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
let syncEnCurso = false;

async function ejecutarSyncAutomatico() {
  if (syncEnCurso) {
    console.log("Sync omitido: todavía hay una sincronización en curso");
    return;
  }

  syncEnCurso = true;

  try {
    console.log("Ejecutando sync automático:", new Date().toISOString());

    const respuesta = await fetch(
      `http://127.0.0.1:${PORT}/api/sharepoint/sync-sql`,
      { method: "POST" }
    );

    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}: ${await respuesta.text()}`);
    }

    console.log("Sync completado");
  } catch (error) {
    console.error("Error en sync automático:", error.message);
  } finally {
    syncEnCurso = false;
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor backend corriendo en http://0.0.0.0:${PORT}`);

  // Primera revisión poco después de iniciar y luego cada 5 minutos.
  setTimeout(ejecutarSyncAutomatico, 15 * 1000);
  setInterval(ejecutarSyncAutomatico, SYNC_INTERVAL_MS);
});
