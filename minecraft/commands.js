const config = require('../config');
const minecraftPlayer = require("minecraft-player");
const { EmbedBuilder } = require('discord.js');
const { handleKitsCommand, getKitTriggers } = require('./kits/index');

let ddsActive = {};

async function handleCommand(mensajeDelUsuario, bot, username, banManager, isDiscord = false) {
  if ((mensajeDelUsuario.startsWith('!') || mensajeDelUsuario.startsWith('>!') || mensajeDelUsuario.startsWith('> !')) && username != 'MinelordBOT') {
    const [command, ...args] = mensajeDelUsuario.replace('>!', '!').replace('> !', '!').slice(1).split(' ');

    switch (command) {
      case 'help': {

        const kits = getKitTriggers().join(', ');
        const lines = [
          '=== Comandos DPS Voyager ===',
          '!ping [user] | !players | !info [user]',
          '!tpa | !tpahere (mod+)',
          '!say <msg> (admin/special)',
          '!dds <user> <msg> | !ddsoff <user> (admin)',
          `Kits (escribe sin !): ${kits}`,
          '!kits add/remove/list <user> (managers)',
          '!restart (admin)',
          'voyager | voyager travel <dest>',
        ];

        return { multiline: true, lines };
      }

      case 'kits':
        return handleKitsCommand(username, args);

      case 'restart':
        if (!config.permissions.admin.includes(username)) return 'Usted no puede usar este comando';
        bot.chat('Reiniciando bot...');
        setTimeout(() => {
          banManager.removeAll();
          banManager.save();
          process.exit(0);
        }, 2000);
        return 'Reiniciando el bot completo...';

      case 'voyager':
      case 'dps':
        return "Unauthorized request detected: DPS Engineer Corps(TM) and his parent company Xera INC don't allow unregistered users to access the DPS Voyager Fast Travel Network. A report file has been sent to the logs channel";

      case 'dds':
        if (!config.permissions.admin.includes(username)) return 'Usted no puede usar este comando';
        if (args.length < 2) return 'Uso: !dds <jugador> <mensaje>';
        const ddsTarget = args[0];
        const spamMessage = args.slice(1).join(' ');
        if (!bot.players[ddsTarget]) return `El jugador ${ddsTarget} no esta en linea`;
        if (ddsActive[ddsTarget]) return `Ya hay un DDS activo para ${ddsTarget}`;
        ddsActive[ddsTarget] = { interval: null, count: 0, ignored: false, lastSeen: Date.now() };
        ddsActive[ddsTarget].interval = setInterval(() => {
          if (bot && bot.players && bot.players[ddsTarget]) {
            ddsActive[ddsTarget].lastSeen = Date.now();
            ddsActive[ddsTarget].ignored = false;
          } else {
            const timeSinceLastSeen = Date.now() - ddsActive[ddsTarget].lastSeen;
            if (timeSinceLastSeen > 10000) ddsActive[ddsTarget].ignored = true;
          }
          bot.chat(`/w ${ddsTarget} ${spamMessage}`);
          ddsActive[ddsTarget].count++;
        }, 1000);
        return `DDS activado contra ${ddsTarget}. Usa !ddsoff ${ddsTarget} para detenerlo`;

      case 'ddsoff':
        if (!config.permissions.admin.includes(username)) return 'Usted no puede usar este comando';
        if (args.length < 1) return 'Uso: !ddsoff <jugador>';
        const stopTarget = args[0];
        if (!ddsActive[stopTarget]) return `No hay DDS activo para ${stopTarget}`;
        clearInterval(ddsActive[stopTarget].interval);
        delete ddsActive[stopTarget];
        return `DDS desactivado para ${stopTarget}`;

      case 'tpahere':
        if (!config.permissions.moderator.includes(username)) return 'Usted no puede usar este comando';
        bot.chat(`/tpahere ${username}`);
        bot.waitForTicks(10);
        return 'Se ejecuto tpahere';

      case 'tpa':

        if (!config.permissions.moderator.includes(username) &&
            !config.permissions.admin.includes(username) &&
            !config.permissions.special.includes(username) &&
            !config.permissions.private.includes(username)) {
          return 'Usted no puede usar este comando';
        }
        bot.chat(`/tpa ${username}`);
        bot.waitForTicks(10);
        return 'Se ejecuto tpa';

      case 'say':
        if (!config.permissions.admin.includes(username) && !config.permissions.special.includes(username)) return 'Usted no puede usar este comando';
        const sayMsg = args.join(' ');
        if (!sayMsg) return 'Debes proporcionar un mensaje';
        bot.chat(sayMsg);
        bot.waitForTicks(10);
        return 'Mensaje enviado al chat';

      case 'ping':
        let targetUsername;
        if (args.length === 0 || args[0] == "") {
          if (!bot.players[username]) return "El jugador debe estar en linea.";
          targetUsername = username;
        } else {
          targetUsername = Object.keys(bot.players).find(u => u.toLowerCase() == args[0].toLowerCase());
        }
        if (!bot.players[targetUsername]) return "Jugador no encontrado";
        const ping = bot.players[targetUsername].ping;
        let pingMessage = '';
        if (ping < 50) pingMessage = '&a&lExcelente';
        else if (ping < 100) pingMessage = '&2&lMuy bueno';
        else if (ping < 200) pingMessage = '&3&lBueno';
        else if (ping < 300) pingMessage = '&6&lRegular';
        else if (ping < 500) pingMessage = '&c&lMalo';
        else pingMessage = '&4&lMuy malo';
        if (targetUsername != username) {
          return "&rEl ping de %user%&r es &9&l%ping%&r ms (%status%&r).".replace("%user%", targetUsername).replace("%ping%", ping).replace("%status%", pingMessage);
        } else {
          return "&rTu ping es &9&l%ping%&r ms (%status%&r).".replace("%ping%", ping).replace("%status%", pingMessage);
        }

      case 'player':
      case 'info':
      case 'player-info':
        let userPlayerInfo;
        if (args.length === 0 || args[0] == "") {
          if (!bot.players[username]) return "Usted debe ser un jugador para poder usar este comando";
          userPlayerInfo = username;
        } else {
          let found = Object.keys(bot.players).find(u => u.toLowerCase() == args[0].toLowerCase());
          if (found) {
            const helpers = require('../utils/helpers');
            userPlayerInfo = helpers.getRealUsername(bot, found);
          } else {
            userPlayerInfo = args[0];
          }
        }
        return await getPlayerInfo(userPlayerInfo, bot);

      case 'players':
        if (isDiscord) {
          return await getPlayersEmbed(bot);
        } else {
          const listaJugadores = Object.keys(bot.players).join(', ');
          const cantidad = Object.keys(bot.players).length;
          return `${cantidad} Jugadores: ${listaJugadores}`;
        }

      default:
        return "&cComando desconocido: &6&l%command%".replace("%command%", command);
    }
  }
}

function getDDSActive() {
  return ddsActive;
}

async function getPlayerInfo(username, bot) {
  return new Promise(async (resolve) => {
    if (!bot || !bot.players || !bot.players[username]) {
      resolve("El jugador %user% debe estar en linea.".replace("%user%", username));
      return;
    }
    let player = bot.players[username];
    let infoString = `Username: ${username}, Displayname: ${player.displayName}, Ping: ${player.ping}, UUID: ${player.uuid}}`;
    try {
      const { uuid, usernameHistory, createdAt } = await minecraftPlayer(username);
      infoString += `, Created at: ${createdAt}, Minecraft UUID: ${uuid}`;
    } catch (error) {
      infoString += `, NO PREMIUM`;
    }
    bot.chat(`/joindate ${username}`);
    await bot.waitForTicks(2);
    bot.once('chat', (sender, message) => {
      let joinDate = null;
      let matchPlayer = message.toString().match(/\w+ joined the server on (.+)/);
      if (matchPlayer) joinDate = matchPlayer[1];
      if (joinDate) infoString += `, 8b8t Join Date: ${joinDate}`;
      else infoString += `, 8b8t Join Date: N/A`;
      resolve(infoString);
    });
  });
}

function getDisplayName(bot, username) {
  if (!bot || !bot.players || !bot.players[username]) return null;
  const playerInfo = bot.players[username];
  if (!playerInfo.displayName) return null;
  const displayNameStr = playerInfo.displayName.toString();
  const cleaned = (displayNameStr.match(/(?:\[\S+\]\s*)?(.*)/) || [])[1] || null;
  if (cleaned && cleaned !== username) return cleaned;
  return null;
}

async function getPlayersEmbed(bot) {

  const playerNames = Object.keys(bot.players)
    .filter(name => {
      if (name === bot.username) return false;
      const p = bot.players[name];
      return p && p.ping !== null && p.ping !== undefined;
    })
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const cantidad = playerNames.length;

  if (cantidad === 0) {
    return new EmbedBuilder()
      .setColor('#1a1a2e')
      .setTitle('Jugadores Online — 8b8t.me')
      .setDescription('```\nNo hay jugadores conectados actualmente.\n```')
      .setTimestamp();
  }

  const premiumChecks = await Promise.allSettled(
    playerNames.map(async (playerName) => {
      try {
        const { uuid } = await minecraftPlayer(playerName);
        return { playerName, premium: !!uuid };
      } catch {
        return { playerName, premium: false };
      }
    })
  );

  const premiumMap = {};
  for (const result of premiumChecks) {
    if (result.status === 'fulfilled') {
      premiumMap[result.value.playerName] = result.value.premium;
    }
  }

  const chunkSize = 20;
  const chunks = [];
  for (let i = 0; i < playerNames.length; i += chunkSize) {
    chunks.push(playerNames.slice(i, i + chunkSize));
  }

  const fields = chunks.map((chunk, idx) => {
    const lines = chunk.map((playerName, i) => {
      const globalIndex = idx * chunkSize + i + 1;
      const displayName = getDisplayName(bot, playerName);
      const tag = premiumMap[playerName] ? ' [P] ' : '[NP] ';
      const ping = bot.players[playerName]?.ping ?? '?';
      let line = `${String(globalIndex).padStart(2, ' ')}. ${tag}${playerName}`;
      if (displayName) line += ` (${displayName})`;
      line += `  ${ping}ms`;
      return line;
    });
    return {
      name: idx === 0 ? 'N.   Tag   Nombre — Ping' : '\u200b',
      value: '```\n' + lines.join('\n') + '\n```',
      inline: false
    };
  });

  const premiumCount = Object.values(premiumMap).filter(Boolean).length;
  const npCount = cantidad - premiumCount;

  return new EmbedBuilder()
    .setColor('#16213e')
    .setTitle('Jugadores Online — 8b8t.me')
    .setDescription(`**Total:** ${cantidad}   |   **Premium [P]:** ${premiumCount}   |   **No Premium [NP]:** ${npCount}`)
    .addFields(fields)
    .setFooter({ text: '[P] Premium  •  [NP] No Premium  •  Ordenados alfabeticamente' })
    .setTimestamp();
}

function stopAllDDS() {
  for (let target in ddsActive) {
    clearInterval(ddsActive[target].interval);
  }
  ddsActive = {};
}

module.exports = { handleCommand, stopAllDDS, getDDSActive };