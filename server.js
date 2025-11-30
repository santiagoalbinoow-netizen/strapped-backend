import express from "express";
import cors from "cors";
import { MercadoPagoConfig, Preference } from "mercadopago";

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 Reemplaza con tu token de producción o prueba
const client = new MercadoPagoConfig({
    accessToken: "APP_USR-2161278205149294-112701-8343c4fa1850cefb1cebbe3a5640a026-3019382479"
});

// 🔥 URL DE TU FRONTEND EN VERCEL
const FRONTEND = "https://strapped-six.vercel.app";

app.post("/crear_preferencia", async (req, res) => {
    try {
        console.log("📥 Datos recibidos:", req.body);

        let monto = Number(req.body.monto);

        if (!monto || monto <= 0) {
            console.log("❌ Monto inválido:", req.body.monto);
            return res.status(400).json({ error: "Monto inválido" });
        }

        console.log("💵 Monto convertido:", monto);

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

        console.log("🔗 BACK_URLS ENVIADAS:", body.back_urls);

        const respuesta = await preferencia.create({ body });

        console.log("✅ Preferencia creada:", respuesta);

        return res.json({
            init_point: respuesta.init_point
        });

    } catch (error) {
        console.error("❌ Error al crear preferencia:", {
            mensaje: error.message,
            error: error.cause,
            estado: error.status,
            causa: error.cause
        });

        return res.status(500).json({
            error: "Error interno al crear preferencia",
            detalle: error.message
        });
    }
});

// Render usa process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Backend MercadoPago activo en puerto ${PORT}`);
});
