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

const getMessageText = (message) => {
  if (message.conversation) return message.conversation
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text
  if (message.imageMessage?.caption) return message.imageMessage.caption
  return null
}

const startBot = async () => {
  try {
    const authFolder = './auth'
    const { state, saveCreds } = await useMultiFileAuthState(authFolder)

    sock = makeWASocket({
      auth: state,
      browser: ['Ubuntu', 'Chrome', '22.04.4'],
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0]
      if (!msg.message || msg.key.fromMe) return

      const sender = msg.key.remoteJid
      const nombre = msg.pushName || 'Usuario'
      const text = getMessageText(msg.message)
      if (!text) return

      console.log(`📩 Mensaje de ${nombre} (${sender}): ${text}`)

      try {
        console.log('🔄 Enviando mensaje a n8n:', { de: sender, nombre, mensaje: text })

        const response = await axios.post(N8N_WEBHOOK_URL, {
          de: sender,
          nombre,
          mensaje: text
        })

        console.log('✅ Respuesta recibida de n8n:', response.data)

        // ⚠️ Ya no se responde desde aquí para evitar mensajes duplicados
        // El mensaje será enviado por n8n usando el endpoint /responder

      } catch (error) {
        console.error('❌ Error comunicando con n8n:', error)
        await sock.sendMessage(sender, {
          text: '😔 Hubo un error. Intenta más tarde, por favor.'
        })
      }
    })

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update
      if (qr) {
        console.log('🔐 Escanea este QR para conectar el bot:')
        qrcode.generate(qr, { small: true })
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        console.log('❌ Conexión cerrada. ¿Reconectar?', shouldReconnect)
        if (shouldReconnect) {
          startBot()
        }
      } else if (connection === 'open') {
        console.log('✅ ¡Bot conectado a WhatsApp!')
      }
    })

  } catch (error) {
    console.error('❌ Error iniciando el bot:', error)
    process.exit(1)
  }
}

// Endpoint para que n8n envíe mensajes a WhatsApp
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

// Iniciar servidor
const PORT = process.env.PORT || 3000
;(async () => {
  await startBot()
  app.listen(PORT, () => {
    console.log(`🚀 Servidor Express escuchando en puerto ${PORT}`)
  })
})()
