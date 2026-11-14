const { Client, GatewayIntentBits } = require('discord.js');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

// Configuración del servidor Express para la página web
const app = express();
app.use(cors());
app.use(express.json());

// Puerto dinámico para Render
const PORT = process.env.PORT || 10000;

// Base de datos temporal en memoria para las Keys y los tiempos de cada usuario
// Estructura: userId -> { keyHashed, expiresAt }
const activeKeys = new Map();

// Configuración del Bot de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

client.on('ready', () => {
    console.log(`Bot encendido y conectado como ${client.user.tag}`);
});

// Evento cuando un usuario escribe en el chat o por DM
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Comando para solicitar la key
    if (message.content.trim() === '!key') {
        const userId = message.author.id;
        const now = Date.now();
        const cooldownTime = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

        // Verificar si el usuario ya tiene una key activa y no han pasado 24 horas
        if (activeKeys.has(userId)) {
            const userData = activeKeys.get(userId);
            if (now < userData.expiresAt) {
                const timeLeftMinutes = Math.ceil((userData.expiresAt - now) / (1000 * 60));
                const hours = Math.floor(timeLeftMinutes / 60);
                const minutes = timeLeftMinutes % 60;
                
                return message.author.send(`⚠️ Ya tienes una Key activa. Puedes solicitar otra en **${hours} horas y ${minutes} minutos**.`);
            }
        }

        // Generar una Key única y segura para este usuario específico
        const rawKey = `109-FF-${crypto.randomBytes(4).toString('hex').toUpperCase()}-X`;
        const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

        // Guardar la key en la memoria con expiración de 24 horas
        activeKeys.set(userId, {
            keyHashed: hashedKey,
            expiresAt: now + cooldownTime
        });

        try {
            // Enviar la Key por Mensaje Directo (DM)
            await message.author.send(
                `🔐 **Tu System Key personal de 109 Cheats:**\n\`\`\`${rawKey}\`\`\`\n*Esta key es de uso personal, expira en 24 horas y solo puede usarse una vez.*`
            );
            
            if (message.channel.type !== 1) { // Si no fue en DM, avisar en el canal
                await message.reply('✅ ¡Te he enviado tu Key por Mensaje Directo (DM)! Revisa tus mensajes.');
            }
        } catch (err) {
            message.reply('❌ No pude enviarte un mensaje directo. Asegúrate de tener los MDs abiertos en este servidor.');
        }
    }
});

// Ruta de la API que consulta la página web de Netlify para validar la Key
app.post('/api/verify-key', (req, res) => {
    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ success: false, message: 'Key no proporcionada.' });
    }

    // Hashear la key que ingresó el usuario en la web para compararla con la base de datos
    const inputHash = crypto.createHash('sha256').update(key.trim()).digest('hex');
    const now = Date.now();

    let foundValid = false;

    // Buscar si la key existe y sigue vigente en el sistema
    for (const [userId, data] of activeKeys.entries()) {
        if (data.keyHashed === inputHash) {
            if (now < data.expiresAt) {
                foundValid = true;
                // Opcional: Eliminar la key después de usarse si es de un solo uso
                activeKeys.delete(userId); 
            }
            break;
        }
    }

    if (foundValid) {
        return res.json({ success: true, message: 'Acceso concedido.' });
    } else {
        return res.status(401).json({ success: false, message: 'Key inválida, expirada o ya utilizada.' });
    }
});

// Iniciar servidor Express
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

// Iniciar sesión del Bot con el token de entorno de Render
client.login(process.env.DISCORD_TOKEN);
