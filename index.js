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

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, SHOPIFY_API_KEY, SHOPIFY_PASSWORD, SHOPIFY_STORE_URL } = process.env;
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const MessagingResponse = twilio.twiml.MessagingResponse;

const userStates = {};

// Cargar datos del producto desde producto.json
const producto = JSON.parse(fs.readFileSync('producto.json', 'utf-8'));

const fichaTecnica = `📌 *Ficha Técnica - ${producto.nombre}*

• 🔹 *Tipo:* ${producto.tipo}
• 💧 *Capacidad del Tanque:* ${producto.tanque_agua.capacidad}, desmontable
• ⚡ *Potencia:* ${producto.especificaciones_electricas.potencia}
• 🔌 *Voltaje:* ${producto.especificaciones_electricas.voltaje}
• 💨 *Presión de la Bomba:* ${producto.sistema_extraccion.presion_bomba}
• ⏱️ *Tiempo de Calentamiento:* ${producto.sistema_extraccion.tiempo_calentamiento}
• 📲 *Funciones:* ${producto.funciones_controles.funciones_tactiles.join(", ")}
• ☕ *Compatibilidad:* ${producto.sistema_preparacion_cafe.compatibilidad}
• 🔒 *Garantía:* ${producto.garantia_soporte.duracion_garantia}`;

const preguntasPersuasivas = [
    "☕ ¿Te gustaría disfrutar de un espresso con crema y sabor intenso sin salir de casa?",
    "💰 ¿Gastaste mucho dinero en café este mes? Con esta cafetera ahorras a largo plazo.",
    "☕ ¿El café de tu cafetera de goteo te sabe aguado? ¿Buscas más cuerpo y aroma?",
    "🔥 ¿Te gustaría empezar tu día con un cappuccino espumoso sin depender de una cafetería?",
    "🎛️ ¿Te gustaría controlar tu café con una pantalla táctil y funciones automáticas?",
    "💡 ¿Sabías que esta cafetera tiene el mismo sistema de presión que las cafeteras profesionales?",
    "🛒 ¿Te gustaría recibirla en la puerta de tu casa con envío gratis?",
    "⚡ Solo quedan pocas unidades en stock. ¿Quieres asegurar la tuya antes que se agoten?"
];

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

        // Simular un retardo de 3 segundos antes de responder
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Agregar una pregunta persuasiva al final
        const preguntaAdicional = preguntasPersuasivas[Math.floor(Math.random() * preguntasPersuasivas.length)];
        responseMessage += `\n\n${preguntaAdicional}`;

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

    if (userMessage.toLowerCase().includes("otros productos") || userMessage.toLowerCase().includes("tienen más modelos")) {
        return `📢 Actualmente solo ofrecemos la *${producto.nombre}* ☕, diseñada para brindarte la mejor experiencia en café en casa. ¿Te gustaría saber más?`;
    }

    if (userMessage.toLowerCase().includes("comprar") || userMessage.toLowerCase().includes("dónde comprar")) {
        return `🛒 Puedes comprar la *${producto.nombre}* en el siguiente enlace: ${producto.link_compra}`;
    }

    try {
        const openaiResponse = await openai.chat.completions.create({
            model: 'gpt-4-turbo',
            messages: [{ role: "system", content: `Eres un experto en ventas. Siempre resalta las ventajas de la *${producto.nombre}* en cada respuesta, usa emojis y mantén las respuestas en menos de 25 palabras.` },
                       { role: "user", content: userMessage }],
            max_tokens: 50,
            temperature: 0.7,
        });

        return openaiResponse.choices?.[0]?.message?.content?.trim() || `☕ La *${producto.nombre}* hace café delicioso en segundos. ¿Quieres conocer más ventajas?`;
    } catch (error) {
        console.error("❌ Error en OpenAI:", error.message);
        return `⚠️ Hubo un error. Pero la *${producto.nombre}* sigue siendo increíble. ¿Te gustaría saber más?`;
    }
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor en ejecución en http://0.0.0.0:${PORT}`);
});
