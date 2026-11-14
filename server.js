const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

// Configuración del servidor Express (API para la web)
const app = express();
app.use(express.json());
app.use(cors());

// Listas de seguridad en memoria
const activeKeys = new Set();    // Almacena los hashes SHA-256 de las keys válidas
const userCooldowns = new Map(); // Guarda la última fecha en que un usuario pidió una key

// Función para cifrar en SHA-256
function sha256(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

// ENDPOINT: Tu página web en Netlify consultará aquí para validar la key
app.post('/api/verify-key', (req, res) => {
    const { key } = req.body;
    if (!key) return res.status(400).json({ success: false, message: "Key no proporcionada" });

    const hashedInput = sha256(key.trim());

    if (activeKeys.has(hashedInput)) {
        // La key es válida, la eliminamos para que no se pueda volver a usar (se "quema")
        activeKeys.delete(hashedInput);
        return res.json({ success: false, message: "Key válida" }); // Espera, aquí debe ser true:
    }
    // Corrección rápida de retorno positivo:
    // (Asegúrate de que devuelva success: true si se encuentra)
    
    // Si no está en el Set:
    return res.status(401).json({ success: false, message: "Key inválida o ya utilizada" });
});

// Ajuste para el endpoint correcto de éxito:
app.post('/api/verify-key', (req, res) => {
    const { key } = req.body;
    if (!key) return res.status(400).json({ success: false, message: "Key no proporcionada" });

    const hashedInput = sha256(key.trim());

    if (activeKeys.has(hashedInput)) {
        activeKeys.delete(hashedInput);
        return res.json({ success: true, message: "Key válida" });
    }

    return res.status(401).json({ success: false, message: "Key inválida o ya utilizada" });
});

// Configuración del Bot de Discord
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

client.once('ready', () => {
    console.log(`🤖 ¡Bot conectado como ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Comando para solicitar la Key diaria
    if (message.content === '!key' || message.content === '!pedirkey') {
        const userId = message.author.id;
        const ahora = Date.now();
        const unDiaEnMs = 24 * 60 * 60 * 1000; // 24 horas

        // Verificar si ya pidió su key en las últimas 24 horas
        if (userCooldowns.has(userId)) {
            const ultimaVez = userCooldowns.get(userId);
            const tiempoPasado = ahora - ultimaVez;

            if (tiempoPasado < unDiaEnMs) {
                const horasRestantes = Math.ceil((unDiaEnMs - tiempoPasado) / (1000 * 60 * 60));
                return message.reply(`❌ Ya reclamaste tu key hoy. Vuelve a intentarlo en **${horasRestantes} horas**.`);
            }
        }

        // Generar Key única
        const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const rawKey = `109-DC-${randomCode}-X`;

        // Guardar el hash SHA-256 de la key en la lista de válidas del servidor
        const hashedKey = sha256(rawKey);
        activeKeys.add(hashedKey);

        // Actualizar el tiempo del usuario
        userCooldowns.set(userId, ahora);

        // Enviar la key por Mensaje Privado (DM)
        try {
            const embed = new EmbedBuilder()
                .setColor('#00f2fe')
                .setTitle('🔑 Tu Key Diaria - 109 Cheats')
                .setDescription(`Aquí tienes tu key exclusiva generada por el bot:\n\n\`\`\`${rawKey}\`\`\`\n*Esta key es personal, de un solo uso y expira al utilizarse.*`)
                .setFooter({ text: 'Sistema de Seguridad 109 Cheats' })
                .setTimestamp();

            await message.author.send({ embeds: [embed] });
            message.reply('✅ ¡Te he enviado tu key por mensaje privado (DM)!');
        } catch (error) {
            message.reply('❌ No pude enviarte un mensaje privado. Asegúrate de tener los DMs abiertos en este servidor.');
        }
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor corriendo en el puerto ${PORT}`);
});

// Iniciar sesión con el token de Discord
client.login(process.env.DISCORD_TOKEN);