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

// Endpoint de WhatsApp
app.post('/whatsapp', async (req, res) => {
  try {
    const incomingMsg = req.body.Body.trim().toLowerCase();
    const userPhone = req.body.From;
    console.log('📩 Mensaje entrante:', incomingMsg);

    let botAnswer = "";

    // Si es la primera interacción, saluda y pregunta la ciudad
    if (!userStates[userPhone]) {
      userStates[userPhone] = { stage: 'ask_city' };
      botAnswer = "¡Hola! ☕ Soy Juan, tu asesor de café profesional. Estoy aquí para ayudarte a descubrir cómo puedes disfrutar en casa de un café digno de cafetería, con nuestra Máquina para Café Automática. 🙌\n\n✍️ Cuéntanos, *¿Desde qué ciudad nos escribes?* 🏙️";
    } else if (userStates[userPhone].stage === 'ask_city') {
      // Guardar la ciudad y continuar con la primera interacción usando OpenAI
      userStates[userPhone].city = incomingMsg;
      userStates[userPhone].stage = 'interaction_1';
      const prompt = getPrompt("INTERACCIÓN 1: " + incomingMsg);
      botAnswer = await getOpenAIResponse(prompt);
    } else {
      // Manejo de respuestas afirmativas
      if (incomingMsg === "sí" || incomingMsg === "si" || incomingMsg === "claro" || incomingMsg === "ok") {
        if (userStates[userPhone].stage === 'interaction_1') {
          userStates[userPhone].stage = 'interaction_2';
          botAnswer = getPrompt("INTERACCIÓN 2: Aquí están los precios detallados de nuestra Máquina para Café Automática:\n\n\u2022 💰 *Precio: $420,000*\n\u2022 🚚 *Envío GRATIS* con pago contra entrega\n\n¿Te gustaría saber más sobre las características o cómo realizar el pedido?");
        } else if (userStates[userPhone].stage === 'interaction_2') {
          userStates[userPhone].stage = 'interaction_3';
          botAnswer = getPrompt("INTERACCIÓN 3: Confirmación de uso de la cafetera");
        } else {
          botAnswer = "Perfecto, continuemos con el proceso de compra.";
        }
      } else {
        // Obtener el prompt desde el archivo externo y continuar con OpenAI
        const prompt = getPrompt(incomingMsg);
        botAnswer = await getOpenAIResponse(prompt);
      }
    }

    console.log('🤖 Respuesta generada:', botAnswer);

    // Enviar respuesta por Twilio
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
      max_tokens: 500,
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
