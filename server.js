import express from "express";
import cors from "cors";
import mysql from "mysql2";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
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
    🔹 MIDDLEWARE DE SEGURIDAD
============================= */
// 1. Verifica que el token sea válido
const authenticateToken = (req, res, next) => {
// ... (código de autenticación) ...
};

// 2. Verifica que el rol sea 'admin'
const requireAdmin = (req, res, next) => {
// ... (código de requireAdmin) ...
};
/* ============================
    🔹 ENDPOINT - MODIFICAR PRODUCTO (ADMIN PROTEGIDO)
============================= */
app.put("/admin/products/:id", authenticateToken, requireAdmin, (req, res) => {
    const productId = req.params.id;
    const { nombre, descripcion, precio, stock, imagen } = req.body;

    // La consulta UPDATE permite cambiar múltiples campos a la vez
    const updateQuery = `
        UPDATE products
        SET nombre = ?, descripcion = ?, precio = ?, stock = ?, imagen = ?
        WHERE id = ?
    `;

    db.query(
        updateQuery,
        [nombre, descripcion, precio, stock, imagen, productId],
        (err, result) => {
            if (err) {
                console.error("Error al actualizar producto:", err);
                return res.status(500).json({ error: "Error interno al actualizar producto." });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Producto no encontrado." });
            }

            res.json({ success: true, message: `Producto con ID ${productId} actualizado.` });
        }
    );
});

/* ============================
    🔹 ENDPOINT - LOGIN SEGURO (CON JWT)
============================= */
app.post("/login", (req, res) => {
    // ... (Tu código de búsqueda y comparación con bcrypt aquí) ...

    db.query(
        "SELECT id, nombre, email, password AS hashedPassword, rol FROM users WHERE email = ?",
        [email],
        async (err, results) => {
            // ... (Manejo de errores y verificación de contraseña aquí) ...
            
            // Si el match es exitoso:
            const user = results[0];
            
            // 1. Crear el token de acceso
            const token = jwt.sign(
                { id: user.id, rol: user.rol }, 
                process.env.JWT_SECRET, // Usa la clave secreta de Railway
                { expiresIn: '1d' }      // El token expira en 1 día
            );

            // 2. Responder con el token (el Frontend lo guardará)
            res.json({
                token: token, // <--- Enviamos el token al cliente
                id: user.id,
                nombre: user.nombre,
                rol: user.rol || 'cliente' 
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
    🔹 ENDPOINT - AGREGAR PRODUCTO (ADMIN PROTEGIDO)
============================= */
// MODIFICADO: AÑADIMOS authenticateToken y requireAdmin
app.post("/admin/products", authenticateToken, requireAdmin, (req, res) => {
    // Ahora este código solo se ejecuta si el usuario tiene un token válido
    // Y su rol en el token es 'admin'
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
    🔹 ENDPOINT - PRODUCTO POR ID (ADMIN PROTEGIDO)
============================= */
app.get("/admin/product/:id", authenticateToken, requireAdmin, (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: "Error interno" });
        
        if (results.length === 0) {
            return res.status(404).json({ error: "Producto no encontrado." });
        }

        res.json(results[0]);
    });
});

/* ============================
    🔹 MIDDLEWARE DE SEGURIDAD
============================= */

// 1. Verifica que el token sea válido
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // El token viene en formato "Bearer [token]"
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            // Token inválido o expirado
            return res.status(403).json({ error: 'Token inválido o expirado.' });
        }
        req.user = user; // Adjuntamos la info del usuario (id y rol) a la solicitud
        next();
    });
};

// 2. Verifica que el rol sea 'admin'
const requireAdmin = (req, res, next) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Rol de administrador requerido.' });
    }
    next();
};

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

app.delete("/admin/products/:id", authenticateToken, requireAdmin, (req, res) => { // MODIFICADO
    // Ahora este código solo se ejecuta si el usuario es un admin válido
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










