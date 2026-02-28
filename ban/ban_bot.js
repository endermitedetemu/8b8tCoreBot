const mineflayer = require('mineflayer');

const targetUsername = process.argv[2];

if (!targetUsername) {
    console.error('Error: No se proporciono un nombre de usuario');
    process.exit(1);
}

const botArgs = {
    host: '8b8t.me',
    port: 25565,
    username: targetUsername,
    version: '1.12.2'
};

function createBot() {
    const bot = mineflayer.createBot(botArgs);

    bot.on('spawn', () => {
        console.log(`Bot conectado con el nombre ${targetUsername}`);
    });

    bot.on('kick', (reason) => {
        console.log(`Expulsado: ${reason}. Reconectando...`);
        setTimeout(createBot, 1000);
    });

    bot.on('end', () => {
        console.log('Conexion perdida. Reconectando...');
        setTimeout(createBot, 1000);
    });

    bot.on('error', (err) => {
        console.error('Error:', err.message);
        setTimeout(createBot, 2000);
    });
}

createBot();