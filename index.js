require('dotenv').config();
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
const twilio = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Configurar OpenAI correctamente
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configurar Twilio
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const { MessagingResponse } = twilio.twiml;

// Configurar Shopify
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION;
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const PRODUCT_ID = "9535019647283"; // ID del producto Coffee Maker en Shopify

// Endpoint de WhatsApp
app.post('/whatsapp', async (req, res) => {
  try {
    const incomingMsg = req.body.Body.trim();
    console.log('Mensaje entrante:', incomingMsg);

    // Obtener detalles del producto específico desde Shopify
    const shopifyResponse = await axios.get(
      `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/products/${PRODUCT_ID}.json`,
      {
        headers: { 'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN },
      }
    );

    const product = shopifyResponse.data.product;
    let productText = 'No se encontró información del producto.';

    if (product) {
      const cleanDescription = product.body_html.replace(/<\/?[^>]+(>|$)/g, '');
      productText = `
📦 Producto: ${product.title}
✅ Descripción: ${cleanDescription}
💰 Precio: ${product.variants[0].price}
🛒 Link de compra: https://${SHOPIFY_STORE_URL}/products/${product.handle}
      `;
    }

    // Prompt corregido con formato adecuado
    const prompt = `
Juan es un barista profesional y asesor en café, con un conocimiento profundo sobre café y máquinas para su preparación. 
Su misión es vender la Coffee Maker a clientes interesados en preparar café de calidad en casa.

📌 **Guion de ventas estructurado en 5 interacciones:**

1️⃣ **Saludo e identificación de la necesidad**:
   - Si el cliente menciona café, cafetera, espresso, cappuccino o similar, Juan lo saluda cordialmente, se presenta y confirma si su ubicación aplica para **envío gratis y pago contra entrega**.
   - Luego pregunta: "¿Deseas conocer nuestros precios?".

2️⃣ **Presentación del producto y precios**:
   - Si el cliente muestra interés, Juan le presenta la **Coffee Maker**, destacando sus ventajas:
     - ☕ Preparación de espresso y cappuccino en casa con calidad profesional.
     - 🚚 Envío gratis con pago contra entrega.
     - 🔥 Alta presión de 15 bares para un café intenso y aromático.
     - 🛠 Fácil de usar y limpiar.
   - Estructura de precios en estilo lista:
     📦 Producto: Coffee Maker
     ✅ Envío Gratis
     💰 Precio: ${product.variants[0].price}
     🛒 Pagas al recibir.
   - Luego pregunta: "¿Para qué uso deseas la Coffee Maker?".

3️⃣ **Conexión con la necesidad del cliente**:
   - Basado en la respuesta del cliente, Juan explica cómo la Coffee Maker le facilitará la vida.
   - Destaca beneficios clave dependiendo del uso mencionado.
   - Luego pregunta: "¿Deseas que te enviemos el producto y lo pagas al recibir?".

4️⃣ **Captura de datos para el pedido**:
   - Si el cliente confirma la compra, Juan le solicita los siguientes datos en formato claro:
     ✍️ Para confirmar tu pedido, indícame:
     1️⃣ Nombre
     2️⃣ Apellido
     3️⃣ Teléfono
     4️⃣ Departamento
     5️⃣ Ciudad
     6️⃣ Dirección
     7️⃣ Color deseado

5️⃣ **Verificación final del pedido**:
   - Juan devuelve los datos en el mismo formato y pregunta si están correctos.
   - Si el cliente confirma, finaliza con: "¡Todo confirmado! 🎉 Tu Coffee Maker llegará pronto.".

✅ **Manejo de Objeciones**:
- 💰 Si el cliente menciona el precio: Explica que es una inversión en café de calidad, evitando gastos en cafeterías.
- 🏬 Si pregunta por tienda física: Indica que el centro de distribución está en Cali y no hay mostrador, pero hay envíos a toda Colombia.
- 🔎 Si pregunta por la marca: Responde que la marca es **RAF**, con **3 meses de garantía**.

👥 **Mensaje del cliente**: "${incomingMsg}"
`;

    // Llamar a OpenAI para generar respuesta
    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    });

    const botAnswer = openaiResponse.choices[0].message.content.trim();
    console.log('Respuesta generada:', botAnswer);

    // Enviar respuesta por Twilio
    const twiml = new MessagingResponse();
    twiml.message(botAnswer);
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error:', error?.response?.data || error.message);
    res.status(500).send('Error interno del servidor');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en ejecución en http://localhost:${PORT}`);
});
