const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const qrcode = require('qrcode-terminal')
const axios = require('axios')
const express = require('express')

const app = express()
app.use(express.json())

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
    const nombre = msg.pushName || 'Usuario'
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text

    if (!text) return

    console.log(`📩 Mensaje de ${nombre} (${sender}): ${text}`)

    try {
      // Debug antes de enviar a n8n
      console.log('🔄 Enviando mensaje a n8n:', { de: sender, nombre, mensaje: text })

      const response = await axios.post('https://n8n-production-a5dc8.up.railway.app/webhook/331dce23-b65e-48b0-8f48-b0ba35688523', {
        de: sender,
        nombre,
        mensaje: text
      })

      console.log('✅ Respuesta recibida de n8n:', response.data)

      const respuesta = response.data?.respuesta || '👋 ¡Hola! Somos Han\'ei, ¿cómo podemos ayudarte?'
      await sock.sendMessage(sender, { text: respuesta })
      console.log('✅ Mensaje procesado y respondido desde n8n')

    } catch (error) {
      console.error('❌ Error comunicando con n8n:', error.message)
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
}

// 🟢 Endpoint para que n8n mande mensajes manuales a WhatsApp
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
    console.error('❌ Error al enviar desde /responder:', error.message, error.stack)
    res.status(500).send({ 
      error: 'No se pudo enviar el mensaje',
      detalle: error.message,
      stack: error.stack
    })
  }
})

startBot()

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express escuchando en puerto ${PORT}`)
})
