import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import twilio from 'twilio';
import { getPrompt } from './prompt.js';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const MessagingResponse = twilio.twiml.MessagingResponse;

const userStates = {};

app.post('/whatsapp', async (req, res) => {
    try {
        const incomingMsg = req.body.Body.trim().toLowerCase();
        const userPhone = req.body.From;
        console.log('📩 Mensaje entrante:', incomingMsg);

        if (!userStates[userPhone]) {
            userStates[userPhone] = { stage: 'inicio' };
        }

        let botAnswer = await getOpenAIResponse(getPrompt(incomingMsg, userStates[userPhone].stage));

        userStates[userPhone].stage = getNextStage(userStates[userPhone].stage, incomingMsg);

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

function getNextStage(currentStage, userResponse) {
    const stages = ["inicio", "ciudad", "precios", "uso", "confirmacion", "datos", "verificacion"];
    let currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 1) {
        return stages[currentIndex + 1];
    }
    return currentStage;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor en ejecución en http://localhost:${PORT}`);
});
