import express from "express";
import cors from "cors";
import mysql from "mysql2";
import bcrypt from "bcrypt";
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

app.post("/register", async (req, res) => { // <- Ahora debe ser 'async'
    const { nombre, email, password } = req.body;

    try {
        // 1. Hashear la contraseña (10 es la dificultad, o 'salt rounds')
        const hashedPassword = await bcrypt.hash(password, 10); 

        // 2. Insertar el hash, NO la contraseña original
        db.query(
            "INSERT INTO users (nombre, email, password) VALUES (?, ?, ?)",
            [nombre, email, hashedPassword], // <-- USAR hashedPassword
            (err) => {
                if (err) {
                    // Si el email ya existe (UNIQUE constraint), se detecta el error
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ error: "El email ya está registrado." });
                    }
                    console.error(err);
                    return res.status(500).json({ error: "Error creando usuario" });
                }
                res.json({ success: true, message: "Usuario registrado." });
            }
        );
    } catch (hashError) {
        console.error("Error al hashear contraseña:", hashError);
        res.status(500).json({ error: "Error interno de servidor." });
    }
});

/* ============================
    🔹 ENDPOINT - LOGIN SEGURO
============================= */

app.post("/login", (req, res) => {
    const { email, password } = req.body;

    // 1. Buscar al usuario por email
    db.query(
        "SELECT id, nombre, email, password AS hashedPassword, rol FROM users WHERE email = ?",
        [email],
        async (err, results) => { // <- Debe ser 'async' para usar await de bcrypt
            if (err) return res.status(500).json({ error: "Error interno" });

            if (results.length === 0) {
                return res.status(401).json({ error: "Credenciales incorrectas" });
            }

            const user = results[0];

            try {
                // 2. Comparar la contraseña enviada con el hash guardado
                const match = await bcrypt.compare(password, user.hashedPassword);

                if (!match) {
                    return res.status(401).json({ error: "Credenciales incorrectas" });
                }

                // 3. Login exitoso (omitir el hash en la respuesta)
                res.json({
                    id: user.id,
                    nombre: user.nombre,
                    email: user.email,
                    rol: user.rol || 'cliente' // Asumir rol 'cliente' si no existe
                });

            } catch (compareError) {
                console.error("Error al comparar contraseñas:", compareError);
                return res.status(500).json({ error: "Error en la verificación." });
            }
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
    🔹 ENDPOINT - AGREGAR PRODUCTO (ADMIN)
============================= */

app.post("/admin/products", (req, res) => {
    // ⚠️ Idealmente, aquí se debe verificar el rol del usuario (JWT o Sesión)
    const { nombre, descripcion, precio, stock, imagen } = req.body;

    db.query(
        "INSERT INTO products (nombre, descripcion, precio, stock, imagen) VALUES (?, ?, ?, ?, ?)",
        [nombre, descripcion, precio, stock, imagen],
        (err, result) => {
            if (err) {
                console.error("Error al insertar producto:", err);
                return res.status(500).json({ error: "Error interno al guardar producto." });
            }
            res.status(201).json({ 
                success: true, 
                message: "Producto agregado",
                id: result.insertId 
            });
        }
    );
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

app.delete("/admin/products/:id", (req, res) => {
    // ⚠️ Idealmente, aquí se debe verificar el rol del usuario (JWT o Sesión)
    const productId = req.params.id;

    db.query("DELETE FROM products WHERE id = ?", [productId], (err, result) => {
        if (err) {
            console.error("Error al eliminar producto:", err);
            return res.status(500).json({ error: "Error interno al eliminar producto." });
        }
        
        // Verifica si se eliminó alguna fila
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Producto no encontrado." });
        }
        
        res.json({ success: true, message: `Producto con ID ${productId} eliminado.` });
    });
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





