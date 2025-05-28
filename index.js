const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const qrcode = require('qrcode-terminal')
const fs = require('fs')
const path = require('path')
const axios = require('axios') // Usamos axios para enviar datos al webhook

const startBot = async () => {
  const authFolder = './auth'

  const { state, saveCreds } = await useMultiFileAuthState(authFolder)

  const sock = makeWASocket({
    auth: state,
    browser: ['Ubuntu', 'Chrome', '22.04.4'],
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0]
    if (!msg.message || msg.key.fromMe) return

    const sender = msg.key.remoteJid
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text

    console.log('📩 Mensaje recibido:', text)

    // Respuesta automática
    await sock.sendMessage(sender, { text: '👋 ¡Hola, soy tu bot y estoy vivaaa!' })

    // 🔗 Enviar datos a n8n vía webhook
    try {
      await axios.post('https://3276-189-157-182-75.ngrok-free.app/webhook-test/331dce23-b65e-48b0-8f48-b0ba35688523', {
        de: sender,
        mensaje: text
      })
      console.log('✅ Mensaje enviado a n8n correctamente')
    } catch (error) {
      console.error('❌ Error al enviar a n8n:', error.message)
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

startBot()
