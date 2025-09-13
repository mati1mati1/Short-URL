import "dotenv/config";
import express from "express";
import linkRouter from "./routes/link.routes.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
app.use("/links", linkRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
