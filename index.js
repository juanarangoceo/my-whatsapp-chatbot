app.post('/whatsapp', async (req, res) => {
  try {
    const incomingMsg = req.body.Body.trim().toLowerCase();
    const userPhone = req.body.From;
    console.log('📩 Mensaje entrante:', incomingMsg);

    // Inicializar estado del usuario si es la primera vez
    if (!userStates[userPhone]) {
      userStates[userPhone] = { stage: 'inicio' };
    }

    let botAnswer = '';

    switch (userStates[userPhone].stage) {
      case 'inicio':
        botAnswer = "¡Hola! ☕ Soy *Juan*, tu asesor de café profesional. Estoy aquí para ayudarte a descubrir cómo puedes disfrutar en casa de un café digno de cafetería, con nuestra *Máquina para Café Automática* 🙌. \n\n✍️ Cuéntanos, *¿Desde qué ciudad nos escribes?* 🏙️";
        userStates[userPhone].stage = 'ciudad';
        break;

      case 'ciudad':
        botAnswer = `📍 ¡Gracias! Confirmo que en *${incomingMsg}* el envío es *GRATIS* y con *pago contra entrega* 🚚. \n\n ¿Deseas conocer nuestros *precios*?`;
        userStates[userPhone].stage = 'precios';
        break;

      case 'precios':
        if (incomingMsg.includes('sí') || incomingMsg.includes('ok')) {
          botAnswer = await getProductDetails(); // Obtener detalles de Shopify
          botAnswer += "\n\n📌 ¿Qué uso deseas darle a la máquina?";
          userStates[userPhone].stage = 'uso';
        } else {
          botAnswer = "¿Deseas conocer los precios de la *Máquina para Café Automática*? 😊";
        }
        break;

      case 'uso':
        botAnswer = `¡Excelente elección! Con nuestra *Máquina para Café Automática* podrás preparar *${incomingMsg}* con facilidad. \n\n📦 ¿Deseas que te enviemos el producto y lo pagas al recibir? 🚚`;
        userStates[userPhone].stage = 'confirmacion';
        break;

      case 'confirmacion':
        if (incomingMsg.includes('sí') || incomingMsg.includes('quiero comprar')) {
          botAnswer = "¡Genial! Para procesar tu pedido, por favor proporciona los siguientes datos:\n\n1️⃣ *Nombre* 😊\n2️⃣ *Apellido* 😊\n3️⃣ *Teléfono* 📞\n4️⃣ *Departamento* 🌄\n5️⃣ *Ciudad* 🏙️\n6️⃣ *Dirección* 🏡\n7️⃣ *Color preferido* 🎨";
          userStates[userPhone].stage = 'datos';
        } else {
          botAnswer = "Si necesitas más información, dime en qué puedo ayudarte. ☕";
        }
        break;

      case 'datos':
        botAnswer = "¡Gracias! 🎉 Confirmo que he recibido tus datos correctamente. Pronto te contactaremos para coordinar el envío. 🚛📦";
        delete userStates[userPhone]; // Reiniciar conversación después de confirmar el pedido
        break;

      default:
        botAnswer = await getOpenAIResponse(getPrompt(incomingMsg, userStates[userPhone].stage));
        break;
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
