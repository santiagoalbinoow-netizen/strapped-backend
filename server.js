import express from "express";
import cors from "cors";
import mysql from "mysql2";
import { MercadoPagoConfig, Preference } from "mercadopago";

const app = express();
app.use(cors());
app.use(express.json());

/* ============================
    🔹 CONEXIÓN A MYSQL
============================= */

const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
});



db.connect(err => {
    if (err) {
        console.error("❌ Error conectando a MySQL:", err);
    } else {
        console.log("🔥 Conectado a MySQL (strapped)");
    }
});

/* ============================
    🔹 ENDPOINT - REGISTRO
============================= */

app.post("/register", (req, res) => {
    const { nombre, email, password } = req.body;

    db.query(
        "INSERT INTO users (nombre, email, password) VALUES (?, ?, ?)",
        [nombre, email, password],
        err => {
            if (err) {
                return res.status(500).json({ error: "Error creando usuario" });
            }
            res.json({ success: true });
        }
    );
});

/* ============================
    🔹 ENDPOINT - LOGIN
============================= */

app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.query(
        "SELECT * FROM users WHERE email = ? AND password = ?",
        [email, password],
        (err, results) => {
            if (err) return res.status(500).json({ error: "Error interno" });

            if (results.length === 0) {
                return res.status(401).json({ error: "Credenciales incorrectas" });
            }

            res.json({
                id: results[0].id,
                nombre: results[0].nombre,
                email: results[0].email
            });
        }
    );
});

/* ============================
    🔹 OBTENER PRODUCTOS
============================= */

app.get("/products", (req, res) => {
    db.query("SELECT * FROM products", (err, results) => {
        if (err) return res.status(500).json({ error: "Error obteniendo productos" });
        res.json(results);
    });
});

/* ============================
    🔹 PRODUCTO POR ID
============================= */

app.get("/product/:id", (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: "Error interno" });
        res.json(results[0]);
    });
});

/* ============================
    🔹 AÑADIR AL CARRITO
============================= */

app.post("/cart/add", (req, res) => {
    const { user_id, product_id, cantidad } = req.body;

    db.query(
        "INSERT INTO cart_items (cart_id, product_id, cantidad) VALUES (?, ?, ?)",
        [user_id, product_id, cantidad],
        err => {
            if (err) return res.status(500).json({ error: "Error agregando al carrito" });
            res.json({ success: true });
        }
    );
});

/* ============================
    🔹 VER CARRITO
============================= */

app.get("/cart/:user_id", (req, res) => {
    db.query(
        `
        SELECT cart_items.id, products.nombre, products.precio, products.imagen, cart_items.cantidad
        FROM cart_items 
        JOIN products ON cart_items.product_id = products.id
        WHERE cart_items.cart_id = ?
        `,
        [req.params.user_id],
        (err, results) => {
            if (err) return res.status(500).json({ error: "Error obteniendo carrito" });
            res.json(results);
        }
    );
});

/* ============================
    🔹 ELIMINAR DEL CARRITO
============================= */

app.delete("/cart/delete/:id", (req, res) => {
    db.query("DELETE FROM cart_items WHERE id = ?", [req.params.id], err => {
        if (err) return res.status(500).json({ error: "Error eliminando" });
        res.json({ success: true });
    });
});

/* ============================
    🔵 MERCADOPAGO (tu código)
============================= */

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN 
});

const FRONTEND = "https://strapped-six.vercel.app";

app.post("/crear_preferencia", async (req, res) => {
    try {
        let monto = Number(req.body.monto);

        if (!monto || monto <= 0) {
            return res.status(400).json({ error: "Monto inválido" });
        }

        const preferencia = new Preference(client);

        const body = {
            items: [
                {
                    title: "Compra Strapped",
                    quantity: 1,
                    currency_id: "COP",
                    unit_price: monto,
                }
            ],
            back_urls: {
                success: `${FRONTEND}/success.html`,
                pending: `${FRONTEND}/pendiente.html`,
                failure: `${FRONTEND}/error.html`,
            },
            auto_return: "approved"
        };

        const respuesta = await preferencia.create({ body });

        return res.json({
            init_point: respuesta.init_point
        });

    } catch (error) {
        return res.status(500).json({
            error: "Error interno",
            detalle: error.message
        });
    }
});

/* ============================
    🔥 INICIAR SERVIDOR
============================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Backend activo en puerto ${PORT}`);
});


