import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import twilio from 'twilio';
import fs from 'fs';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const MessagingResponse = twilio.twiml.MessagingResponse;

const userStates = {};
const producto = JSON.parse(fs.readFileSync('producto.json', 'utf-8'));

const fichaTecnica = `📌 *Ficha Técnica - ${producto.nombre}* ...`;
const ofertaMensaje = `☕🔥 ¡Tu café perfecto te espera! Aprovecha el *50% de descuento*, *envío gratis* y más...`;

const preguntasPersuasivas = [
  "☕ *¿Te gustaría disfrutar de un espresso con crema y sabor intenso sin salir de casa?*",
  "💰 *¿Gastaste mucho dinero en café este mes?*",
  "🔥 *¿Te gustaría empezar tu día con un cappuccino espumoso?*"
];

app.post('/whatsapp', async (req, res) => {
  try {
    const incomingMsg = req.body.Body.trim().toLowerCase();
    const userPhone = req.body.From;

    if (!userStates[userPhone]) {
      userStates[userPhone] = { stage: 'inicio', data: {} };
    }

    let responseMessage;

    if (["sí", "si", "quiero", "comprar"].some(word => incomingMsg.startsWith(word))) {
      responseMessage = ofertaMensaje;
    } else {
      responseMessage = await getChatbotResponse(incomingMsg);
      const preguntaAdicional = preguntasPersuasivas[Math.floor(Math.random() * preguntasPersuasivas.length)];
      responseMessage += `\n\n${preguntaAdicional}`;
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    const twiml = new MessagingResponse();
    twiml.message(responseMessage);
    res.type('text/xml');
    res.send(twiml.toString());

  } catch (error) {
    console.error("❌ Error en el chatbot:", error.message);
    res.status(500).send('Error interno del servidor');
  }
});

async function getChatbotResponse(userMessage) {
  try {
    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: "system", content: `Eres un experto en ventas...` }, { role: "user", content: userMessage }],
      max_tokens: 50,
      temperature: 0.7,
    });
    return openaiResponse.choices?.[0]?.message?.content?.trim() || `☕ La *${producto.nombre}* hace café delicioso en segundos.`;
  } catch (error) {
    console.error("❌ Error en OpenAI:", error.message);
    return `⚠️ Hubo un error. ¿Quieres saber más?`;
  }
}

// Ruta para la raíz "/"
app.get('/', (req, res) => {
  res.send('<h1>¡Bienvenido a tu Chatbot!</h1><p>El chatbot está funcionando correctamente.</p>');
});

// Ruta alternativa "/chat"
app.get('/chat', (req, res) => {
  res.send('<h1>Esta es la interfaz del chatbot en /chat.</h1><p>Puedes personalizar esta página.</p>');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor en ejecución en http://0.0.0.0:${PORT}`);
});
