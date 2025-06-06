// Cargar variables de entorno desde archivo .env
require('dotenv').config();

// Importar librerías necesarias
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const axios = require('axios')
const express = require('express')


const app = express()
// Middleware para interpretar JSON en las solicitudes HTTP
app.use(express.json())

let sock  // Variable global para la instancia del socket de WhatsApp

// URL del webhook de n8n (mejor ponerla en el .env)
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL

/**
 * Función auxiliar para extraer el texto del mensaje recibido,
 * manejando distintos tipos de mensajes de WhatsApp.
 */
const getMessageText = (message) => {
  if (message.conversation) return message.conversation
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text
  if (message.imageMessage?.caption) return message.imageMessage.caption
  return null
}

/**
 * Función principal para iniciar el bot de WhatsApp.
 * Se encarga de manejar la conexión, eventos y mensajes entrantes.
 */
const startBot = async () => {
  try {
    // Carpeta donde se almacenan las credenciales de sesión
    const authFolder = './auth'

    // Obtener estado y función para guardar credenciales (persistencia de sesión)
    const { state, saveCreds } = await useMultiFileAuthState(authFolder)

    // Crear la instancia del socket de WhatsApp con la sesión
    sock = makeWASocket({
      auth: state,
      browser: ['Ubuntu', 'Chrome', '22.04.4'],  // Nombre del navegador (puede ser cualquier cosa)
    })

    // Cuando cambian las credenciales, guardarlas para persistencia
    sock.ev.on('creds.update', saveCreds)

    // Evento que se dispara cuando llegan mensajes nuevos
    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0]

      // Ignorar mensajes sin contenido o mensajes enviados por el propio bot
      if (!msg.message || msg.key.fromMe) return

      // Obtener información del remitente y nombre
      const sender = msg.key.remoteJid
      const nombre = msg.pushName || 'Usuario'

      // Extraer el texto del mensaje usando la función auxiliar
      const text = getMessageText(msg.message)

      // Si no hay texto, no procesar
      if (!text) return

      // Log para ver el mensaje recibido
      console.log(`📩 Mensaje de ${nombre} (${sender}): ${text}`)

      try {
        // Enviar el mensaje a n8n para procesar la lógica del bot
        console.log('🔄 Enviando mensaje a n8n:', { de: sender, nombre, mensaje: text })

        const response = await axios.post(N8N_WEBHOOK_URL, {
          de: sender,
          nombre,
          mensaje: text
        })

        // Log de la respuesta recibida desde n8n
        console.log('✅ Respuesta recibida de n8n:', response.data)

        // Obtener respuesta para enviar al usuario, o mensaje default si no hay respuesta
        const respuesta = response.data?.respuesta || 
  `👋 ¡Hola! Somos *Han'ei*, tu tienda de productos personalizados.

✨ ¿En qué podemos ayudarte hoy?
1️⃣ Ver productos disponibles  
2️⃣ Conocer precios  
3️⃣ Envíos a domicilio  
4️⃣ Seguimiento a mi pedido  
5️⃣ Quiero ser mayorista  
6️⃣ Busco productos personalizados para mi evento (boda, baby shower, cumpleaños...)  
7️⃣ Deseo hacer un pedido   
8️⃣ Tengo otra duda


📩 *Responde con el número de la opción que te interesa*`


        // Enviar mensaje de vuelta a WhatsApp
        await sock.sendMessage(sender, { text: respuesta })

        console.log('✅ Mensaje procesado y respondido desde n8n')

      } catch (error) {
        // Si hay error en la comunicación con n8n, avisar al usuario
        console.error('❌ Error comunicando con n8n:', error)

        await sock.sendMessage(sender, {
          text: '😔 Hubo un error. Intenta más tarde, por favor.'
        })
      }
    })

    // Evento para manejar cambios en el estado de la conexión (ej. QR, reconexión)
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      // Si hay QR, mostrar en consola para escanear con WhatsApp
      if (qr) {
        console.log('🔐 Escanea este QR para conectar el bot:')
        qrcode.generate(qr, { small: true })
      }

      // Si la conexión se cierra, intentar reconectar salvo que haya sido un logout
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        console.log('❌ Conexión cerrada. ¿Reconectar?', shouldReconnect)

        if (shouldReconnect) {
          startBot()
        }
      } else if (connection === 'open') {
        // Confirmar que el bot está conectado y listo
        console.log('✅ ¡Bot conectado a WhatsApp!')
      }
    })

  } catch (error) {
    // Si hay error crítico al iniciar el bot, terminar la app (o podrías intentar reconectar)
    console.error('❌ Error iniciando el bot:', error)
    process.exit(1)
  }
}

// Endpoint HTTP para que n8n pueda enviar mensajes manuales a WhatsApp
app.post('/responder', async (req, res) => {
  const { mensaje, destinatario } = req.body

  console.log('📥 Recibido en /responder:', { mensaje, destinatario })

  if (!sock) {
    console.error('❌ Bot no conectado al intentar enviar mensaje')
    return res.status(500).send({ error: 'Bot no conectado' })
  }
  if (!mensaje || !destinatario) {
    console.error('❌ Faltan datos en /responder:', { mensaje, destinatario })
    return res.status(400).send({ error: 'Faltan mensaje o destinatario' })
  }

  try {
    await sock.sendMessage(destinatario, { text: mensaje })
    console.log(`📤 Mensaje enviado a ${destinatario} desde endpoint /responder: ${mensaje}`)
    res.send({ ok: true })
  } catch (error) {
    console.error('❌ Error al enviar desde /responder:', error)
    res.status(500).send({ 
      error: 'No se pudo enviar el mensaje',
      detalle: error.message,
      stack: error.stack
    })
  }
})

// Puerto donde correrá el servidor Express
const PORT = process.env.PORT || 3000

// Iniciar el bot y el servidor HTTP
;(async () => {
  await startBot()
  app.listen(PORT, () => {
    console.log(`🚀 Servidor Express escuchando en puerto ${PORT}`)
  })
})()
