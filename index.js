import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import twilio from 'twilio';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, SHOPIFY_API_KEY, SHOPIFY_PASSWORD, SHOPIFY_STORE_URL } = process.env;
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const MessagingResponse = twilio.twiml.MessagingResponse;

const userStates = {};

const fichaTecnica = `📌 *Ficha Técnica de la Máquina para Café Automática*\n\n• ⚡ *Potencia:* 850W\n• 🔌 *Voltaje:* 120V\n• 💨 *Presión de la Bomba:* 15 bar\n• 💧 *Capacidad del Tanque:* 1.6 litros, extraíble y transparente\n• 📲 *Funciones Inteligentes:* Pantalla táctil con selección de espresso, cappuccino, agua caliente y vapor\n• 🏗️ *Material del Filtro:* Aleación de aluminio y acero inoxidable\n• 🛠️ *Componentes Adicionales:* Boquilla de espuma desmontable, bandeja de goteo extraíble, válvula de seguridad automática\n• ☕ *Aplicaciones:* Ideal para quienes buscan calidad y comodidad en cada taza, sin necesidad de salir de casa.`;

app.post('/whatsapp', async (req, res) => {
    try {
        const incomingMsg = req.body.Body.trim();
        const userPhone = req.body.From;
        console.log('📩 Mensaje entrante:', incomingMsg);

        if (!userStates[userPhone]) {
            userStates[userPhone] = { stage: 'inicio', data: {} };
        }

        let responseMessage = await getChatbotResponse(userStates[userPhone], incomingMsg);
        console.log('🤖 Respuesta generada:', responseMessage);

        const twiml = new MessagingResponse();
        twiml.message(responseMessage);
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error("❌ Error en el chatbot:", error.message);
        res.status(500).send('Error interno del servidor');
    }
});

async function getChatbotResponse(userState, userMessage) {
    if (userMessage.toLowerCase().includes("ficha") || userMessage.toLowerCase().includes("características")) {
        return fichaTecnica;
    }
    
    try {
        const openaiResponse = await openai.chat.completions.create({
            model: 'gpt-4-turbo',
            messages: [{ role: "system", content: "Eres un experto en café y ventas. Siempre resalta las ventajas de la cafetera Espresso Pro Coffee Maker en cada respuesta." },
                       { role: "user", content: userMessage }],
            max_tokens: 150,
            temperature: 0.7,
        });

        return openaiResponse.choices?.[0]?.message?.content?.trim() || "Lo siento, no entendí tu pregunta. Pero te cuento que nuestra cafetera Espresso Pro Coffee Maker tiene muchas ventajas. ¿Quieres saber más?";
    } catch (error) {
        console.error("❌ Error en OpenAI:", error.message);
        return "Hubo un error al procesar tu solicitud. Pero no te preocupes, nuestra cafetera Espresso Pro Coffee Maker es increíble. ¿Quieres conocer sus beneficios?";
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor en ejecución en http://localhost:${PORT}`);
});
