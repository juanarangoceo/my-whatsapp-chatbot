import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import twilio from 'twilio';
import { getPrompt } from './prompt.js';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Configurar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configurar Twilio
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN } = process.env;
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const MessagingResponse = twilio.twiml.MessagingResponse;

// Estado para seguimiento de la interacción
const userStates = {};

// Función para obtener detalles del producto desde Shopify
async function getProductDetails() {
  try {
    const response = await axios.get(`${SHOPIFY_STORE_URL}/admin/api/2023-10/products/9535019647283.json`, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const product = response.data.product;
    return `🛒 *${product.title}*  
📦 *Precio:* $${product.variants[0].price}  
📄 *Descripción:* ${product.body_html.replace(/<[^>]*>?/gm, '')}  
🚚 *Envío GRATIS* con pago contra entrega.`;
  } catch (error) {
    console.error("❌ Error al obtener el producto de Shopify:", error.message);
    return "No puedo obtener la información del producto en este momento. Inténtalo más tarde.";
  }
}

// Endpoint de WhatsApp
app.post('/whatsapp', async (req, res) => {
  try {
    const incomingMsg = req.body.Body.trim().toLowerCase();
    const userPhone = req.body.From;
    console.log('📩 Mensaje entrante:', incomingMsg);

    // Inicializar estado del usuario si es la primera vez
    if (!userStates[userPhone]) {
      userStates[userPhone] = { stage: 'inicio' };
    }

    let botAnswer = '';

    // Manejo del flujo de la conversación basado en el estado del usuario
    switch (userStates[userPhone].stage) {
      case 'inicio':
        botAnswer = "¡Hola! ☕ Soy *Juan*, tu asesor de café profesional. Estoy aquí para ayudarte a descubrir cómo puedes disfrutar en casa de un café digno de cafetería, con nuestra *Máquina para Café Automática* 🙌. \n\n✍️ Cuéntanos, *¿Desde qué ciudad nos escribes?* 🏙️";
        userStates[userPhone].stage = 'ciudad';
        break;

      case 'ciudad':
        botAnswer = `📍 ¡Gracias! Confirmo que en *${incomingMsg}* el envío es *GRATIS* y con *pago contra entrega* 🚚. \n\n ¿Deseas conocer nuestros *precios*?`;
        userStates[userPhone].stage = 'precios';
        break;

      case 'precios':
        if (incomingMsg.includes('sí') || incomingMsg.includes('ok')) {
          botAnswer = await getProductDetails();
          botAnswer += "\n\n📌 ¿Qué uso deseas darle a la máquina?";
          userStates[userPhone].stage = 'uso';
        } else {
          botAnswer = "¿Deseas conocer los precios de la *Máquina para Café Automática*? 😊";
        }
        break;

      case 'uso':
        botAnswer = `¡Excelente elección! Con nuestra *Máquina para Café Automática* podrás preparar *${incomingMsg}* con facilidad. \n\n📦 ¿Deseas que te enviemos el producto y lo pagas al recibir? 🚚`;
        userStates[userPhone].stage = 'confirmacion';
        break;

      case 'confirmacion':
        if (incomingMsg.includes('sí') || incomingMsg.includes('quiero comprar')) {
          botAnswer = "¡Genial! Para procesar tu pedido, por favor proporciona los siguientes datos:\n\n1️⃣ *Nombre* 😊\n2️⃣ *Apellido* 😊\n3️⃣ *Teléfono* 📞\n4️⃣ *Departamento* 🌄\n5️⃣ *Ciudad* 🏙️\n6️⃣ *Dirección* 🏡\n7️⃣ *Color preferido* 🎨";
          userStates[userPhone].stage = 'datos';
        } else {
          botAnswer = "Si necesitas más información, dime en qué puedo ayudarte. ☕";
        }
        break;

      case 'datos':
        botAnswer = "¡Gracias! 🎉 Confirmo que he recibido tus datos correctamente. Pronto te contactaremos para coordinar el envío. 🚛📦";
        delete userStates[userPhone]; // Reiniciar conversación
        break;

      default:
        botAnswer = await getOpenAIResponse(getPrompt(incomingMsg, userStates[userPhone].stage));
        break;
    }

    console.log('🤖 Respuesta generada:', botAnswer);
    const twiml = new MessagingResponse();
    twiml.message(botAnswer);
    res.type('text/xml');
    res.send(twiml.toString());

  } catch (error) {
    console.error("❌ Error en el chatbot:", error?.response?.data || error.message);
    res.status(500).send('Error interno del servidor');
  }
});

async function getOpenAIResponse(prompt) {
  try {
    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.5,
    });

    return openaiResponse.choices?.[0]?.message?.content?.trim() || "Lo siento, no entendí tu pregunta.";
  } catch (error) {
    console.error("❌ Error en OpenAI:", error.response?.data || error.message);
    return "Hubo un error al procesar tu solicitud. Intenta nuevamente más tarde.";
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en ejecución en http://localhost:${PORT}`);
});
