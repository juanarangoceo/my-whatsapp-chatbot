import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import twilio from 'twilio';
import { getPrompt } from './prompt.js';
import { faq } from './faq.js';
import stringSimilarity from 'string-similarity';

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

// Estado para seguimiento de la conversación
const userStates = {};

// Función para verificar si la pregunta es similar a una en las FAQ
function checkFAQ(incomingMsg) {
  const faqKeys = Object.keys(faq);
  const matches = stringSimilarity.findBestMatch(incomingMsg, faqKeys);
  if (matches.bestMatch.rating > 0.7) {
    return faq[matches.bestMatch.target];
  }
  return null;
}

// Función para manejar el flujo de conversación y evitar bucles
function handleConversation(userPhone, incomingMsg) {
  if (!userStates[userPhone]) {
    userStates[userPhone] = { stage: "saludo" };
  }

  let response = "";

  switch (userStates[userPhone].stage) {
    case "saludo":
      response = "¡Hola! ☕ Soy Juan, tu asesor de café profesional. Estoy aquí para ayudarte a descubrir cómo puedes disfrutar en casa de un café digno de cafetería, con nuestra Máquina para Café Automática. 🙌\n\n✍️ *¿Desde qué ciudad nos escribes?* 🏙️";
      userStates[userPhone].stage = "preguntar_ciudad";
      break;

    case "preguntar_ciudad":
      response = `📍 ¡Gracias! Confirmo que en *${incomingMsg}* el envío es *gratis* y con *pago contra entrega*. 🚚\n\n¿Deseas conocer nuestros precios?`;
      userStates[userPhone].stage = "preguntar_precio";
      break;

    case "preguntar_precio":
      if (incomingMsg.toLowerCase().includes("sí") || incomingMsg.toLowerCase().includes("precio")) {
        response = "🛒 *Precio de nuestra Máquina para Café Automática:* 💰\n\n- *Precio actual:* $420,000\n- 🚚 *Envío GRATIS*\n- 📦 *Pago contra entrega*\n\n📌 ¿Qué uso deseas darle a la máquina?";
        userStates[userPhone].stage = "preguntar_uso";
      } else {
        response = "Si necesitas más información, dime qué te gustaría saber. 😊";
      }
      break;

    case "preguntar_uso":
      response = `¡Excelente! Nuestra máquina es perfecta para *${incomingMsg}*. 🍵☕\n\n📦 ¿Deseas que te enviemos el producto con pago al recibir? 🚚`;
      userStates[userPhone].stage = "confirmar_pedido";
      break;

    case "confirmar_pedido":
      if (incomingMsg.toLowerCase().includes("sí")) {
        response = "¡Perfecto! 🎉 Para continuar, por favor completa los siguientes datos:\n\n1️⃣ *Nombre:* 😊\n2️⃣ *Apellido:* 😊\n3️⃣ *Teléfono:* 📞\n4️⃣ *Departamento:* 🌄\n5️⃣ *Ciudad:* 🏙️\n6️⃣ *Dirección:* 🏡\n7️⃣ *Color:*";
        userStates[userPhone].stage = "datos_cliente";
      } else {
        response = "No hay problema, dime si tienes alguna otra pregunta. ☕";
      }
      break;

    case "datos_cliente":
      response = "📋 ¡Gracias por tus datos! Voy a confirmarlos:\n" + incomingMsg + "\n\n✅ ¿Son correctos? (Sí/No)";
      userStates[userPhone].stage = "confirmar_datos";
      break;

    case "confirmar_datos":
      if (incomingMsg.toLowerCase().includes("sí")) {
        response = "🎉 ¡Todo confirmado! Tu pedido está en proceso y recibirás información del envío pronto. 🚚☕";
        userStates[userPhone] = { stage: "saludo" }; // Reinicia la conversación
      } else {
        response = "Por favor revisa los datos y envíalos nuevamente.";
        userStates[userPhone].stage = "datos_cliente";
      }
      break;

    default:
      response = "¿Cómo puedo ayudarte hoy? ☕";
      break;
  }

  return response;
}

// Endpoint de WhatsApp
app.post('/whatsapp', async (req, res) => {
  try {
    const incomingMsg = req.body.Body.trim();
    const userPhone = req.body.From;
    console.log('📩 Mensaje entrante:', incomingMsg);

    let botAnswer = "";

    // Si el usuario está en flujo de ventas, continuar el flujo
    if (userStates[userPhone] && userStates[userPhone].stage !== "saludo") {
      botAnswer = handleConversation(userPhone, incomingMsg);
    } else {
      // Verifica si el mensaje coincide con el FAQ
      botAnswer = checkFAQ(incomingMsg);
      if (!botAnswer) {
        botAnswer = await getOpenAIResponse(getPrompt(incomingMsg, userStates[userPhone]?.stage || 'default'));
      }
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
      max_tokens: 100,
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
