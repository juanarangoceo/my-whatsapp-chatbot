export function getPrompt(userMessage, stage) {
  const prompts = {
      inicio: "¡Hola! ☕ Soy *Juan*, tu asesor de café. Estoy aquí para ayudarte a disfrutar un café de calidad en casa con nuestra *Máquina para Café Automática* 🙌. ✍️ ¿Desde qué ciudad nos escribes? 🏙️",

      ciudad: "📍 ¡Gracias! Confirma que en *{ciudad}* el envío es *GRATIS* y con *pago contra entrega* 🚚. ¿Deseas conocer nuestros *precios*? 😊",

      precios: "💰 El precio de nuestra *Máquina para Café Automática* es de *$420,000* con envío *GRATIS* y pago al recibir. 🚛 ¿Qué uso piensas darle a la máquina? 😊",

      uso: "🎯 ¡Genial! La máquina es ideal para *{uso}* gracias a su *15 bares de presión* y espumador de leche. ¿Deseas que te la enviemos y pagas al recibir? 😊",

      confirmacion: "✨ ¡Buena elección! Confirma tu pedido llenando estos datos: 1️⃣ *Nombre* 😊 2️⃣ *Apellido* 😊 3️⃣ *Teléfono* 📞 4️⃣ *Departamento* 🌄 5️⃣ *Ciudad* 🏙 6️⃣ *Dirección* 🏡 7️⃣ *Color* 🎨.",

      datos: "📌 ¡Gracias! Confirma que estos son tus datos: 1️⃣ *{nombre}* 2️⃣ *{apellido}* 3️⃣ *{teléfono}* 4️⃣ *{departamento}* 5️⃣ *{ciudad}* 6️⃣ *{dirección}* 7️⃣ *{color}*. ¿Es correcto? ✅",

      verificacion: "¡Todo confirmado! 🎉 Recibirás tu pedido en *{ciudad}* en los próximos días. ¡Gracias por tu compra! ☕✨"
  };

  return prompts[stage] || "¡Estoy aquí para ayudarte con nuestra Máquina para Café Automática! 😊";
}
