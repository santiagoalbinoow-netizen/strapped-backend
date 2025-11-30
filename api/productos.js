import { pool } from "./db.js";

export default async function handler(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM productos");
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
