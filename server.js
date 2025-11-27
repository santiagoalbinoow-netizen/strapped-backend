import express from "express";
import cors from "cors";
import { MercadoPagoConfig, Preference } from "mercadopago";

const app = express();
app.use(cors());
app.use(express.json());

const client = new MercadoPagoConfig({
    accessToken: "APP_USR-8480279919484651-112700-6bb5b82a5b676428fd3360c29d254c3f-3019737673",
});

app.post("/crear_preferencia", async (req, res) => {
    try {
        const monto = req.body.monto;

        const preference = new Preference(client);

        console.log("BACK_URLS ENVIADAS:", {
            success: "http://localhost:5500/success.html",
            pending: "http://localhost:5500/pendiente.html",
            failure: "http://localhost:5500/error.html"
        });

        // 🌟 BLOQUE ARREGLADO
        const result = await preference.create({
            body: {
                items: [
                    {
                        title: "Compra en STRAPPED",
                        quantity: 1,
                        unit_price: Number(monto),
                    },
                ],
                back_urls: {
                    success: "http://localhost:5500/success.html",
                    pending: "http://localhost:5500/pendiente.html",
                    failure: "http://localhost:5500/error.html"
                },
                auto_return: "approved",
                notification_url: "http://localhost:3000/notificacion"
            },
        });

        res.json({ init_point: result.body.init_point });

    } catch (error) {
        console.error("❌ Error creando preferencia:", error);
        res.status(500).json({ error: "Error creando preferencia" });
    }
});

app.listen(3000, () => {
    console.log("🔥 Backend MercadoPago activo en puerto 3000");
});
