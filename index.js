const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const qrcode = require('qrcode-terminal')
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

    // Enviar mensaje al webhook de n8n y usar la respuesta
    try {
      const response = await axios.post('https://n8n-production-a5dc8.up.railway.app/prueba-de-webhook/331dce23-b65e-48b0-8f48-b0ba35688523', {
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

startBot()

