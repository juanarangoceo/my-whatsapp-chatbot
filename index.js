require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');
const twilio = require('twilio');

const app = express();

// Twilio: parseamos datos de formularios y JSON
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

// Endpoint principal de WhatsApp
app.post('/whatsapp', async (req, res) => {
  try {
    // Este campo Body es el texto que el usuario envía por WhatsApp
    const incomingMsg = req.body.Body || '';
    console.log('Mensaje entrante del usuario:', incomingMsg);

    // 1. Obtener datos de producto desde Shopify
    //    -> En la práctica, podrías filtrar por ID, nombre, etc.
    //       Aquí, obtendremos todos y tomamos el primero a modo de demo.
    const shopifyResponse = await axios.get(
      `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/products.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
        },
      }
    );

    const products = shopifyResponse.data.products;
    let productText = 'No se encontró ningún producto.';
    if (products.length > 0) {
      const product = products[0]; 
      // Quitamos etiquetas HTML de la descripción
      const cleanDescription = product.body_html.replace(/<\/?[^>]+(>|$)/g, '');
      productText = `
        Producto: ${product.title}
        Descripción: ${cleanDescription}
        Precio (ej. variante 0): ${product.variants[0].price}
        Link de compra: https://${SHOPIFY_STORE_URL}/products/${product.handle}
      `;
    }

    // 2. Construir prompt para OpenAI (GPT)
    const prompt = `
      Eres un chatbot de ventas para una tienda en Shopify.
      Responde en un tono amable y profesional, y trata de guiar al usuario hacia la compra.
      Información del producto disponible:
      ${productText}

      El usuario pregunta: "${incomingMsg}"
    `;

    // 3. Llamar a la API de OpenAI
    const openaiResponse = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: prompt,
      max_tokens: 150,
      temperature: 0.7,
    });

    const botAnswer = openaiResponse.data.choices[0].text.trim();
    console.log('Respuesta generada por GPT:', botAnswer);

    // 4. Enviar la respuesta de vuelta al usuario vía Twilio
    //    Creando un TwiML (Twilio Markup Language)
    const twiml = new MessagingResponse();
    twiml.message(botAnswer);

    // Twilio exige que la respuesta sea en formato XML
    res.type('text/xml');
    res.send(twiml.toString());

  } catch (error) {
    console.error('Error en /whatsapp:', error?.response?.data || error.message);
    res.status(500).send('Error interno del servidor');
  }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
