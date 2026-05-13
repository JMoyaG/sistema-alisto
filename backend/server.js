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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor backend corriendo en http://0.0.0.0:${PORT}`);
});