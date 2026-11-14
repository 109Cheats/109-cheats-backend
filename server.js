const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Base de datos en memoria (ID de Discord -> { key, expiresAt })
const activeKeys = new Map();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

// Evento cuando el bot enciende correctamente
client.once('ready', () => {
    console.log(`Bot conectado exitosamente como ${client.user.tag}`);
});

// Evento cuando recibe un mensaje
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.trim() === '!key') {
        try {
            const userId = message.author.id;
            const now = Date.now();

            // Verificar si ya tiene una key activa y no ha expirado (24 horas)
            if (activeKeys.has(userId)) {
                const userData = activeKeys.get(userId);
                if (now < userData.expiresAt) {
                    const horasRestantes = Math.ceil((userData.expiresAt - now) / (1000 * 60 * 60));
                    await message.author.send(`🔑 Ya tienes una key activa. Te quedan **${horasRestantes} horas** de uso:\n\`${userData.key}\``);
                    return;
                }
            }

            // Generar nueva key única basada en su ID y el momento actual (SHA-256)
            const rawString = `${userId}-${now}-109Cheats`;
            const uniqueKey = crypto.createHash('sha256').update(rawString).digest('hex');
            
            // Expiración a 24 horas
            const expiresAt = now + (24 * 60 * 60 * 1000);

            // Guardar en el mapa
            activeKeys.set(userId, { key: uniqueKey, expiresAt });

            // Enviar por Mensaje Directo
            await message.author.send(`✅ **Tu nueva Key por 24 horas es:**\n\`${uniqueKey}\``);
            
        } catch (error) {
            console.error('Error al enviar DM:', error);
            try {
                await message.reply('❌ No pude enviarte el mensaje directo. Asegúrate de tener los DMs abiertos.');
            } catch (e) {
                // Ignorar
            }
        }
    }
});

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('Backend de 109 Cheats activo y funcionando.');
});

// Ruta que consulta Netlify para verificar la key
app.post('/api/verify-key', (req, res) => {
    try {
        const { key } = req.body;
        
        if (!key) {
            return res.status(400).json({ success: false, message: 'Key no proporcionada.' });
        }

        const now = Date.now();
        let keyEncontrada = false;

        for (const [userId, data] of activeKeys.entries()) {
            if (data.key.trim() === key.trim()) {
                if (now < data.expiresAt) {
                    keyEncontrada = true;
                }
                break;
            }
        }

        if (keyEncontrada) {
            return res.json({ success: true, message: 'Key válida.' });
        } else {
            return res.status(401).json({ success: false, message: 'Key inválida o expirada.' });
        }
    } catch (err) {
        console.error('Error en /api/verify-key:', err);
        return res.status(500).json({ success: false, message: 'Error interno en el servidor.' });
    }
});

// Iniciar sesión del bot de Discord usando la variable de entorno
if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN);
} else {
    console.error('ERROR CRÍTICO: Falta la variable de entorno DISCORD_TOKEN en Render.');
}

// Encender el servidor Express para Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor de 109 Cheats corriendo en el puerto ${PORT}`);
});
