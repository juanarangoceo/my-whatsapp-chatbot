require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');
const twilio = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Configurar OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

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
        Producto: ${product.title}
        Descripción: ${cleanDescription}
        Precio: ${product.variants[0].price}
        Link de compra: https://${SHOPIFY_STORE_URL}/products/${product.handle}
      `;
    }

    // Construcción del prompt basado en el guion de ventas
    const prompt = `
      Juan es un barista profesional y asesor en café. Su misión es vender la Coffee Maker.
      Sigue un guion de ventas estructurado en 5 interacciones y responde en menos de 25 palabras.
      
      Información del producto disponible:
      ${productText}

      Pregunta del usuario: "${incomingMsg}"
    `;

    // Llamar a OpenAI para generar respuesta
    const openaiResponse = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: prompt,
      max_tokens: 150,
      temperature: 0.7,
    });

    const botAnswer = openaiResponse.data.choices[0].text.trim();
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
