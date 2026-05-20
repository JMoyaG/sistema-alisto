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

// Sync automático cada 1 minuto
setInterval(async () => {
  try {
    console.log("Sincronizando SQL automáticamente...");

    const axios = require("axios");

    await axios.post(
      "http://localhost:3001/api/sharepoint/sync-sql"
    );

    console.log("Sync completado");
  } catch (error) {
    console.error("Error en sync automático:", error.message);
  }
}, 10000);

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor backend corriendo en http://0.0.0.0:${PORT}`);
});