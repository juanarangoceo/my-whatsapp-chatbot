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

app.post('/whatsapp', async (req, res) => {
    try {
        const incomingMsg = req.body.Body.trim().toLowerCase();
        const userPhone = req.body.From;
        console.log('📩 Mensaje entrante:', incomingMsg);

        if (!userStates[userPhone]) {
            userStates[userPhone] = { stage: 'inicio', data: {} };
        }

        let responseMessage = getChatbotResponse(userStates[userPhone], incomingMsg);
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

function getChatbotResponse(userState, userMessage) {
    const stage = userState.stage;
    switch (stage) {
        case 'inicio':
            userState.stage = 'ciudad';
            return "¡Hola! Soy Juan, tu asesor de café ☕. ¿En qué ciudad te encuentras?";
        case 'ciudad':
            userState.data.ciudad = userMessage;
            userState.stage = 'precios';
            return "🚛 ¡Envío confirmado! Ofrecemos pago contra entrega. ¿Deseas conocer nuestros precios?";
        case 'precios':
            userState.stage = 'uso';
            return "✅ *Máquina para Café Automática*\n\n🔥 *Ahora: $420,000*\n🚚 *Envío GRATIS*\n📦 *Pagas al recibir*\n\n¿Qué uso le darías a la cafetera? ☕";
        case 'uso':
            userState.data.uso = userMessage;
            userState.stage = 'confirmacion';
            return `🎯 Excelente elección. Esta cafetera es perfecta para ${userMessage}. ¿Te la enviamos con pago contra entrega?`;
        case 'confirmacion':
            if (userMessage.includes("sí") || userMessage.includes("claro")) {
                userState.stage = 'datos';
                return "📝 Para proceder con tu pedido, por favor envíame tus datos:\n1. Nombre 😊\n2. Apellido 😊\n3. Teléfono 📞\n4. Departamento 🌄\n5. Ciudad 🏙\n6. Dirección 🏡\n7. Color 🎨";
            } else {
                return "No hay problema, si necesitas más información dime cómo puedo ayudarte.";
            }
        case 'datos':
            userState.data.datos = userMessage;
            userState.stage = 'verificacion';
            return `🔎 Verifiquemos tus datos:\n${userMessage}\n\n¿Están correctos? (Sí/No)`;
        case 'verificacion':
            if (userMessage.includes("sí")) {
                createShopifyOrder(userState.data);
                userState.stage = 'finalizado';
                return "🎉 ¡Todo confirmado! Tu pedido está en camino. Te notificaremos pronto. ¡Gracias por confiar en nosotros!";
            } else {
                userState.stage = 'datos';
                return "Por favor, envíanos nuevamente los datos correctamente.";
            }
        default:
            return "Lo siento, no entendí tu respuesta. ¿Puedes repetirlo?";
    }
}

async function createShopifyOrder(orderData) {
    const shopifyUrl = `${SHOPIFY_STORE_URL}/admin/api/2023-01/orders.json`;
    const auth = {
        username: SHOPIFY_API_KEY,
        password: SHOPIFY_PASSWORD
    };
    
    const orderPayload = {
        order: {
            line_items: [{
                variant_id: "123456789", 
                quantity: 1
            }],
            customer: {
                first_name: orderData.datos.split('\n')[0],
                last_name: orderData.datos.split('\n')[1],
                email: "cliente@email.com"
            },
            shipping_address: {
                address1: orderData.datos.split('\n')[5],
                city: orderData.datos.split('\n')[4],
                country: "Colombia"
            }
        }
    };
    
    try {
        const response = await axios.post(shopifyUrl, orderPayload, { auth });
        console.log("📦 Pedido creado en Shopify:", response.data);
    } catch (error) {
        console.error("❌ Error al crear pedido en Shopify:", error.response?.data || error.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor en ejecución en http://localhost:${PORT}`);
});
