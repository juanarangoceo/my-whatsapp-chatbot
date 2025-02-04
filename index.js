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

    if (!userStates[userPhone]) {
      userStates[userPhone] = { stage: 'ask_city' };
      botAnswer = "¡Hola! ☕ Soy Juan, tu asesor de café profesional. Estoy aquí para ayudarte a descubrir cómo puedes disfrutar en casa de un café digno de cafetería, con nuestra Máquina para Café Automática. 🙌\n\n✍️ Cuéntanos, *¿Desde qué ciudad nos escribes?* 🏙️";
    } else if (userStates[userPhone].stage === 'ask_city') {
      userStates[userPhone].city = incomingMsg;
      userStates[userPhone].stage = 'interaction_1';
      botAnswer = `Perfecto, confirmo que en ${incomingMsg} el envío es gratis y con pago contra entrega. 🚚 ¿Deseas conocer nuestros precios?`;
    } else if (userStates[userPhone].stage === 'interaction_1' && (incomingMsg === "sí" || incomingMsg === "si" || incomingMsg.includes("precio"))) {
      userStates[userPhone].stage = 'interaction_2';
      botAnswer = "💰 El precio de nuestra *Máquina para Café Automática* es de *$420,000* con *envío GRATIS* y pago contra entrega. 🚚\n\n ¿Qué uso piensas darle a la máquina?";
    } else if (userStates[userPhone].stage === 'interaction_2') {
      userStates[userPhone].stage = 'interaction_3';
      botAnswer = `¡Excelente! Esta máquina es ideal para ${incomingMsg}. Su sistema de 15 bares de presión te permitirá preparar espressos y capuchinos de calidad profesional. ☕\n\n¿Deseas que te enviemos el producto y lo pagas al recibir?`;
    } else if (userStates[userPhone].stage === 'interaction_3' && (incomingMsg === "sí" || incomingMsg === "si" || incomingMsg.includes("quiero"))) {
      userStates[userPhone].stage = 'interaction_4';
      botAnswer = "¡Genial! Para procesar tu pedido, necesitamos estos datos:\n\n1. Nombre 😊\n2. Apellido 😊\n3. Teléfono 📞\n4. Departamento 🌄\n5. Ciudad 🏙️\n6. Dirección 🏡\n7. Color 🎨";
    } else if (userStates[userPhone].stage === 'interaction_4') {
      userStates[userPhone].stage = 'confirmation';
      botAnswer = `Confirma tus datos:\n${incomingMsg}\n\n¿Son correctos? (Responde sí para confirmar)`;
    } else if (userStates[userPhone].stage === 'confirmation' && (incomingMsg === "sí" || incomingMsg === "si")) {
      botAnswer = "¡Todo confirmado! 🎉 Tu pedido ha sido registrado. Te notificaremos cuando esté en camino. 🚚";
      delete userStates[userPhone];
    } else {
      botAnswer = await getOpenAIResponse(incomingMsg);
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
