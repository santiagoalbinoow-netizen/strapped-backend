import { MercadoPagoConfig, Preference } from "mercadopago";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const client = new MercadoPagoConfig({
      accessToken: process.env.MP_TOKEN
    });

    const preference = new Preference(client);

    const body = {
      items: req.body.items,
      back_urls: req.body.back_urls,
      auto_return: "approved"
    };

    const result = await preference.create({ body });

    res.status(200).json({
      id: result.id,
      init_point: result.init_point
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
