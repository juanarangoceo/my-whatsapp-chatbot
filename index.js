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

// Endpoint de WhatsApp
app.post('/whatsapp', async (req, res) => {
  try {
    const incomingMsg = req.body.Body.trim();
    console.log('📩 Mensaje entrante:', incomingMsg);

    // Obtener el prompt desde el archivo externo
    const prompt = getPrompt(incomingMsg);

    // Verifica que el prompt no esté vacío antes de enviarlo
    if (!prompt || prompt.trim() === "") {
      console.error("❌ Error: El prompt está vacío. No se enviará la solicitud a OpenAI.");
      return res.status(400).json({ error: "El prompt no puede estar vacío." });
    }

    // Llamar a OpenAI para generar respuesta
    try {
      const openaiResponse = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      });

      const botAnswer = openaiResponse.choices?.[0]?.message?.content?.trim() || "Lo siento, no entendí tu pregunta.";

      console.log('🤖 Respuesta generada:', botAnswer);

      // Enviar respuesta por Twilio
      const twiml = new MessagingResponse();
      twiml.message(botAnswer);
      res.type('text/xml');
      res.send(twiml.toString());

    } catch (error) {
      console.error("❌ Error en OpenAI:", error.response?.data || error.message);
      res.status(500).json({ error: "Error interno al procesar la solicitud de OpenAI" });
    }
  } catch (error) {
    console.error("❌ Error en el chatbot:", error?.response?.data || error.message);
    res.status(500).send('Error interno del servidor');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en ejecución en http://localhost:${PORT}`);
});
