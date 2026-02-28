const DiscordBot = require('./discord/bot');
const MinecraftBot = require('./minecraft/bot');
const BanManager = require('./ban/manager');
const UserManager = require('./users/manager');
const MessagingHandler = require('./messaging/handler');
const LogsManager = require('./logs/manager');

async function main() {
  console.log('Iniciando bot...');

  const discordBot = new DiscordBot();
  await discordBot.start();

  console.log('Discord bot iniciado...');

  const channels = discordBot.getChannels();

  const banManager = new BanManager(channels.main, channels.alert);
  const userManager = new UserManager();
  const messagingHandler = new MessagingHandler(userManager);
  const logsManager = new LogsManager();

  if (channels.logs) {
    const checkpoint = logsManager.checkpoint.lastMessageId;
    if (checkpoint) {
      console.log(`[Logs] Checkpoint encontrado: ${checkpoint}. Escaneando solo mensajes nuevos...`);
      const result = await logsManager.scanChannelForward(channels.logs, 1000);
      console.log(`[Logs] ${result.messagesProcessed} mensajes procesados, ${result.logsAdded} logs nuevos.`);
    } else {
      console.log('[Logs] Sin checkpoint, escaneando canal completo por primera vez...');
      const result = await logsManager.scanChannelBackwards(channels.logs, 10000);
      console.log(`[Logs] Escaneo inicial completo: ${result.messagesProcessed} mensajes, ${result.logsAdded} logs.`);
    }
  } else {
    console.error('ERROR: No se pudo cargar el canal de logs');
  }

  const usuariosBaneados = banManager.load();
  if (usuariosBaneados.length > 0) {
    console.log(`Reiniciando baneos para ${usuariosBaneados.length} usuarios...`);
    for (const usuario of usuariosBaneados) {
      setTimeout(() => {
        banManager.create(usuario, true);
      }, 2000 * usuariosBaneados.indexOf(usuario));
    }
  }

  const minecraftBot = new MinecraftBot(channels.main, banManager, messagingHandler, discordBot.getClient());
  minecraftBot.start();

  discordBot.setMinecraftBot(minecraftBot.getBot()); // bot mineflayer para presencia
  discordBot.setBanManager(banManager);
  discordBot.setUserManager(userManager);
  discordBot.setMessagingHandler(messagingHandler);
  discordBot.setLogsManager(logsManager);
  discordBot.setJoindateManager(minecraftBot.getJoindateManager()); // para /8b8tlogs

  await discordBot.setupEvents();

  setInterval(() => {
    banManager.checkOnline(minecraftBot.getBot());
  }, 10000);

  setInterval(() => {
    const estado = banManager.getStatus();
    if (estado.total > 0) {
      console.log(`Estado bots: ${estado.activos} activos, ${estado.inactivos} reiniciando`);
    }
  }, 60000);

  setInterval(async () => {
    if (channels.logs) {
      console.log('[AUTO] Buscando nuevos logs...');
      const result = await logsManager.scanChannelForward(channels.logs, 500);
      if (result.logsAdded > 0) {
        console.log(`[AUTO] ${result.logsAdded} logs nuevos`);
      }
    }
  }, 300000);

  process.on('SIGINT', () => {
    console.log('Cerrando bot...');
    banManager.removeAll();
    banManager.save();
    setTimeout(() => process.exit(0), 3000);
  });

  process.on('SIGTERM', () => {
    console.log('Cerrando bot...');
    banManager.removeAll();
    banManager.save();
    setTimeout(() => process.exit(0), 3000);
  });

  console.log('Bot completamente inicializado');
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});