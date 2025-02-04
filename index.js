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
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const MessagingResponse = twilio.twiml.MessagingResponse;

// Estado para seguimiento de la interacción
const userStates = {};

// Función para obtener detalles del producto desde Shopify
async function getProductDetails() {
  try {
    const response = await axios.get(`https://tu-shopify-store.com/products/9535019647283.json`);
    return response.data.product;
  } catch (error) {
    console.error("Error al obtener detalles del producto:", error.message);
    return null;
  }
}

// Endpoint de WhatsApp
app.post('/whatsapp', async (req, res) => {
  try {
    const incomingMsg = req.body.Body.trim().toLowerCase();
    const userPhone = req.body.From;
    console.log('📩 Mensaje entrante:', incomingMsg);

    // Inicializar usuario si no existe
    if (!userStates[userPhone]) {
      userStates[userPhone] = { stage: 'inicio', ciudad: null };
    }

    let responseText = '';

    // Manejo de interacciones basado en el estado actual
    if (userStates[userPhone].stage === 'inicio') {
      responseText = "¡Hola! ☕ Soy *Juan*, tu asesor de café profesional. Estoy aquí para ayudarte a disfrutar un café de calidad en casa con nuestra *Máquina para Café Automática* 🙌\n\n✍️ *¿Desde qué ciudad nos escribes?* 🏙️";
      userStates[userPhone].stage = 'ciudad';
    } else if (userStates[userPhone].stage === 'ciudad') {
      userStates[userPhone].ciudad = incomingMsg;
      responseText = `📍 ¡Gracias! Confirmo que en *${incomingMsg}* el envío es *GRATIS* y con *pago contra entrega* 🚛.\n\n¿Deseas conocer nuestros precios?`;
      userStates[userPhone].stage = 'precio';
    } else if (userStates[userPhone].stage === 'precio' && incomingMsg.includes('sí')) {
      responseText = "💲 *El precio de nuestra Máquina para Café Automática es de $420,000* con envío *GRATIS* y pago al recibir. 🚚\n\n¿Qué uso deseas darle a la máquina?";
      userStates[userPhone].stage = 'uso';
    } else if (userStates[userPhone].stage === 'uso') {
      responseText = `¡Genial! Nuestra cafetera es ideal para ${incomingMsg} ☕. Su sistema de *15 bares de presión* garantiza un espresso perfecto.\n\n¿Deseas que te enviemos el producto y lo pagas al recibir?`;
      userStates[userPhone].stage = 'confirmar';
    } else if (userStates[userPhone].stage === 'confirmar' && incomingMsg.includes('sí')) {
      responseText = "✅ ¡Buena elección! Para procesar tu pedido, por favor completa estos datos:\n\n1. Nombre 😊\n2. Apellido 😊\n3. Teléfono 📞\n4. Departamento 🌄\n5. Ciudad 🏙️\n6. Dirección 🏡\n7. Color 🎨";
      userStates[userPhone].stage = 'datos';
    } else if (userStates[userPhone].stage === 'datos') {
      responseText = `📦 Estos son los datos que registramos:\n${incomingMsg}\n\n¿Están correctos? Responde *Sí* para confirmar.`;
      userStates[userPhone].stage = 'finalizar';
    } else if (userStates[userPhone].stage === 'finalizar' && incomingMsg.includes('sí')) {
      responseText = "🎉 ¡Todo confirmado! Tu pedido será enviado en breve. Te contactaremos para la confirmación final. ¡Gracias por tu compra! ☕🚚";
      userStates[userPhone].stage = 'completado';
    } else {
      responseText = await getOpenAIResponse(getPrompt(incomingMsg, userStates[userPhone].stage));
    }

    console.log('🤖 Respuesta generada:', responseText);
    const twiml = new MessagingResponse();
    twiml.message(responseText);
    res.type('text/xml');
    res.send(twiml.toString());

  } catch (error) {
    console.error("❌ Error en el chatbot:", error.message);
    res.status(500).send('Error interno del servidor');
  }
});

async function getOpenAIResponse(prompt) {
  try {
    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.5,
    });

    return openaiResponse.choices?.[0]?.message?.content?.trim() || "Lo siento, no entendí tu pregunta.";
  } catch (error) {
    console.error("❌ Error en OpenAI:", error.message);
    return "Hubo un error al procesar tu solicitud. Intenta nuevamente más tarde.";
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en ejecución en http://localhost:${PORT}`);
});
