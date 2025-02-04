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
    const incomingMsg = req.body.Body.trim();
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
      const openaiResponse = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.5,
      });

      botAnswer = openaiResponse.choices?.[0]?.message?.content?.trim() || "Hubo un error al procesar tu solicitud. Intenta nuevamente más tarde.";
    } else {
      // Continuar con el flujo de ventas
      const prompt = getPrompt(incomingMsg);
      
      if (!prompt || prompt.trim() === "") {
        console.log("🔄 Mensaje fuera del flujo de ventas, pero se responderá redirigiendo a la venta.");
        prompt = `El cliente ha preguntado: "${incomingMsg}".  
        Como asistente de ventas, responde brevemente y siempre lleva la conversación hacia la compra de la *Máquina para Café Automática*.  
        Si el cliente muestra interés en comprar, sigue con el proceso de venta.  
        **Nunca desvíes la conversación fuera del guion de ventas.**`;
      }

      // Generar respuesta con OpenAI
      try {
        const openaiResponse = await openai.chat.completions.create({
          model: 'gpt-4-turbo',
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
          temperature: 0.5,
        });

        botAnswer = openaiResponse.choices?.[0]?.message?.content?.trim() || "Hubo un error al procesar tu solicitud. Intenta nuevamente más tarde.";
      } catch (error) {
        console.error("❌ Error en OpenAI:", error.response?.data || error.message);
        botAnswer = "Hubo un error al procesar tu solicitud. Intenta nuevamente más tarde.";
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en ejecución en http://localhost:${PORT}`);
});
