const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const qrcode = require('qrcode-terminal')
const axios = require('axios')
const express = require('express')

// Express App
const app = express()
app.use(express.json())

// Variable global para el socket
let sock

const startBot = async () => {
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
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text

    if (!text) return // Ignora mensajes vacíos o cifrados

    console.log('📩 Mensaje recibido:', text)

    try {
      const response = await axios.post('https://n8n-production-a5dc8.up.railway.app/webhook/331dce23-b65e-48b0-8f48-b0ba35688523', {
        de: sender,
        mensaje: text
      })

      const respuesta = response.data.respuesta || '👋 ¡Hola! Somos Hanei, gracias por escribirnos. ¿En qué podemos ayudarte hoy?'

      await sock.sendMessage(sender, { text: respuesta })

      console.log('✅ Mensaje procesado y respondido con n8n')
    } catch (error) {
      console.error('❌ Error al enviar/recibir desde n8n:', error.message)
      await sock.sendMessage(sender, {
        text: '😔 Lo siento, hubo un problema. Intenta de nuevo más tarde.'
      })
    }
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('🔐 Escanea este QR con WhatsApp para conectar el bot:')
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
}

// Endpoint para recibir respuesta desde n8n y reenviar por WhatsApp
app.post('/responder', async (req, res) => {
  const { mensaje, destinatario } = req.body

  if (!sock) {
    return res.status(500).send({ error: 'Bot no conectado aún' })
  }

  try {
    await sock.sendMessage(destinatario, { text: mensaje })
    console.log('✅ Mensaje enviado desde endpoint responder:', mensaje)
    res.send({ ok: true })
  } catch (error) {
    console.error('❌ Error al enviar desde endpoint responder:', error)
    res.status(500).send({ error: 'No se pudo enviar mensaje' })
  }
})

// Inicia bot y servidor Express
startBot()

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express escuchando en el puerto ${PORT}`)
})
