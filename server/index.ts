import "dotenv/config";
import express from "express";
import { streamOpenRouter } from "./openrouter.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

app.post("/api/chat", (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  streamOpenRouter(messages, res);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
