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

// Función para obtener respuesta de OpenAI
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

// Endpoint de WhatsApp
app.post('/whatsapp', async (req, res) => {
  try {
    const incomingMsg = req.body.Body.trim();
    const userPhone = req.body.From;
    console.log('📩 Mensaje entrante:', incomingMsg);

    // Obtener la etapa de la conversación
    const stage = userStates[userPhone]?.stage || 'inicio';

    // Obtener respuesta de OpenAI con el flujo del prompt.js
    const prompt = getPrompt(incomingMsg, stage);
    const botAnswer = await getOpenAIResponse(prompt);

    // Avanzar la etapa de la conversación según el flujo
    if (stage === 'inicio') {
      userStates[userPhone] = { stage: 'ciudad' };
    } else if (stage === 'ciudad' && incomingMsg.length > 2) {
      userStates[userPhone] = { stage: 'venta' };
    } else if (stage === 'venta' && incomingMsg.toLowerCase().includes('sí')) {
      userStates[userPhone] = { stage: 'precio' };
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en ejecución en http://localhost:${PORT}`);
});
