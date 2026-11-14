const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Base de datos en memoria
const activeKeys = new Map();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

// Evento cuando el bot conecta
client.once('ready', () => {
    console.log(`¡EXITO! Bot conectado como ${client.user.tag}`);
});

// Evento de mensajes
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.trim() === '!key') {
        try {
            const userId = message.author.id;
            const now = Date.now();

            if (activeKeys.has(userId)) {
                const userData = activeKeys.get(userId);
                if (now < userData.expiresAt) {
                    const horasRestantes = Math.ceil((userData.expiresAt - now) / (1000 * 60 * 60));
                    await message.author.send(`🔑 Ya tienes una key activa. Te quedan **${horasRestantes} horas**:\n\`${userData.key}\``);
                    return;
                }
            }

            const rawString = `${userId}-${now}-109Cheats`;
            const uniqueKey = crypto.createHash('sha256').update(rawString).digest('hex');
            const expiresAt = now + (24 * 60 * 60 * 1000);

            activeKeys.set(userId, { key: uniqueKey, expiresAt });
            await message.author.send(`✅ **Tu nueva Key por 24 horas es:**\n\`${uniqueKey}\``);
            
        } catch (error) {
            console.error('Error al enviar DM:', error);
        }
    }
});

// Ruta web de prueba
app.get('/', (req, res) => {
    res.send('Backend de 109 Cheats activo y funcionando.');
});

// Ruta de verificación para Netlify
app.post('/api/verify-key', (req, res) => {
    try {
        const { key } = req.body;
        if (!key) return res.status(400).json({ success: false, message: 'Key no proporcionada.' });

        const now = Date.now();
        let keyEncontrada = false;

        for (const [userId, data] of activeKeys.entries()) {
            if (data.key.trim() === key.trim()) {
                if (now < data.expiresAt) keyEncontrada = true;
                break;
            }
        }

        if (keyEncontrada) {
            return res.json({ success: true, message: 'Key válida.' });
        } else {
            return res.status(401).json({ success: false, message: 'Key inválida o expirada.' });
        }
    } catch (err) {
        console.error('Error en verify-key:', err);
        return res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// Iniciar sesión con manejo de errores blindado
if (!process.env.DISCORD_TOKEN) {
    console.error('ERROR: Falta el DISCORD_TOKEN en las variables de entorno de Render.');
} else {
    console.log('Intentando conectar el bot de Discord...');
    client.login(process.env.DISCORD_TOKEN).catch(err => {
        console.error('ERROR CRÍTICO AL INICIAR SESIÓN EN DISCORD:', err);
    });
}

// Servidor Express
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor Express corriendo en el puerto ${PORT}`);
});
