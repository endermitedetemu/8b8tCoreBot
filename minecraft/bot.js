const mineflayer = require('mineflayer');
const config = require('../config');
const helpers = require('../utils/helpers');
const { handleCommand, stopAllDDS, getDDSActive } = require('./commands');
const { handleDupeCommand, stopDupe } = require('../dupe/bot');
const JoindateManager = require('../joindate/manager');
const { handleKit } = require('./kits/index');

const VOYAGER_MENU = [
  '[ DPS Voyager Fast Travel Network v2.4 ] - Available destinations:',
  '33 | base kurtz | base htp1p0 | base tobias | base panaiker | base PIGY | base _aksn | base DPS-central',
  'To travel type: voyager travel <destination name>',
];

class MinecraftBot {
  constructor(discordChannel, banManager, discordClient) {
    this.bot = null;
    this.reconnecting = false;
    this.discordChannel = discordChannel;
    this.banManager = banManager;
    this.discordClient = discordClient;
    this.lastWhisperTime = {};
    this.whisperCount = {};
    this.lastChatTime = {};
    this.chatCount = {};
    this.waitingRefillTpa = false;
    this.waitingKitTpa = false;
    this.joindateManager = new JoindateManager();
    this.joindateQueue = [];
    this.joindateQuerying = false;
    this.joindateInterval = null;
    this._endLoopInterval = null;
    this._endLoopTimeout = null;
    this.discordBot = null;
  }

  setDiscordBot(discordBot) {
    this.discordBot = discordBot;
  }

  start() {
    if (this.reconnecting) return;
    this.reconnecting = false;
    console.log('Conectando al servidor de Minecraft...');
    this.bot = mineflayer.createBot({
      host: config.minecraft.host,
      port: config.minecraft.port,
      username: config.minecraft.username,
      version: config.minecraft.version
    });
    this.setupEvents();
  }

  async handleVoyager(username, msgLower) {
    if (/^(?:!)?voyager(?:\s+travel)?$/.test(msgLower) || /^(?:!)?dps$/.test(msgLower)) {
      for (const line of VOYAGER_MENU) {
        const partes = helpers.dividirMensaje(line, 100);
        for (const parte of partes) {
          this.bot.chat('/w ' + username + ' ' + parte);
          await this.bot.waitForTicks(5);
        }
      }
      return true;
    }
    return false;
  }

  startJoindateLoop() {
    if (this.joindateInterval) clearInterval(this.joindateInterval);
    this.joindateInterval = setInterval(() => {
      this._queuePendingJoindates();
    }, 2 * 60 * 1000);
  }

  _queuePendingJoindates() {
    if (!this.bot || !this.bot.players) return;
    this.joindateManager.updatePeak(Object.keys(this.bot.players).length);
    const toQuery = this.joindateManager.getPlayersToQuery(this.bot.players);
    for (const p of toQuery) {
      if (!this.joindateQueue.includes(p)) this.joindateQueue.push(p);
    }
    if (!this.joindateQuerying) this.processJoindateQueue();
  }

  async processJoindateQueue() {
    if (this.joindateQuerying || this.joindateQueue.length === 0) return;
    this.joindateQuerying = true;
    while (this.joindateQueue.length > 0) {
      const username = this.joindateQueue.shift();
      if (this.joindateManager.isWhitelisted(username.toLowerCase())) continue;
      try {
        await this.queryJoindate(username);
        await new Promise(r => setTimeout(r, 3000));
      } catch (e) {}
    }
    this.joindateQuerying = false;
  }

  queryJoindate(username) {
    return new Promise((resolve) => {
      if (!this.bot) { resolve(); return; }
      let resolved = false;

      const cleanup = () => {
        try { this.bot._client.removeListener('chat', packetHandler); } catch(e) {}
        try { this.bot.removeListener('message', msgHandler); } catch(e) {}
      };

      const tryParse = (text) => {
        if (!text || resolved) return;
        if (text.includes('first joined on') || text.includes('You first joined')) {
          const match = text.match(/(\d{4}-\d{2}-\d{2})/);
          if (match) {
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            console.log(`[Joindate] ${username} -> ${match[1]}`);
            this.joindateManager.addPlayer(username, match[1]);
            resolve();
          }
        }
      };

      const packetHandler = (packet) => { try { tryParse(JSON.stringify(packet)); } catch(e) {} };
      const msgHandler = (msg) => {
        try { tryParse(msg.toString()); } catch(e) {}
        try { if (msg.json) tryParse(JSON.stringify(msg.json)); } catch(e) {}
      };

      this.bot._client.on('chat', packetHandler);
      this.bot.on('message', msgHandler);
      const timeout = setTimeout(() => { if (!resolved) { cleanup(); resolve(); } }, 6000);
      this.bot.chat(`/joindate ${username}`);
    });
  }

  setupEvents() {
    this.bot.once('spawn', () => {
      this.bot.chatAddPattern(/\[8b8t\]\s+You have successfully logged./, 'logged', 'successfully logged');
      this.bot.chatAddPattern(/^([a-zA-Z0-9_]+)\s+Whispers:\s+(.+)/, 'whispersMsg', 'user whisper');
      console.log('El bot esta dentro del servidor');
      setTimeout(() => {
        this.bot.chat('/login ' + config.minecraft.password);
        setTimeout(() => {
          this.startJoindateLoop();
          this._queuePendingJoindates();
        }, 30000);
      }, 2000);
    });

    this.bot.on('end', (reason) => {
      console.log('El bot se ha desconectado. Razon: ' + reason);
      stopAllDDS();
      stopDupe(this.bot, 'system');
      this._stopEndLoop();
      if (this.joindateInterval) { clearInterval(this.joindateInterval); this.joindateInterval = null; }
      if (this.reconnecting) return;
      console.log('Reconectando en 15 segundos...');
      setTimeout(() => this.start(), 15000);
    });

    this.bot.on('playerJoined', (player) => {
      if (!player || !player.username) return;
      const key = player.username.toLowerCase();
      const players = this.joindateManager.data.players || {};
      if (this.discordBot) this.discordBot.updatePresence();

      if (!Object.prototype.hasOwnProperty.call(players, key)) {
        setTimeout(() => {
          if (!this.joindateQueue.includes(player.username)) {
            this.joindateQueue.unshift(player.username);
          }
          if (!this.joindateQuerying) this.processJoindateQueue();
        }, 2000);
      }
    });

    this.bot.on('playerLeft', (player) => {
      if (!player || !player.username) return;
      if (this.discordBot) this.discordBot.updatePresence();
    });

    this.bot.on('message', async (msg) => {

      const rawText = msg.toString();
      const isTeleporting =
        rawText.toLowerCase().includes('teletransportando') ||
        rawText.toLowerCase().includes('teleporting') ||
        rawText.toLowerCase().includes('teleportando');

      if ((this.waitingRefillTpa || this.waitingKitTpa) && isTeleporting) {
        this.waitingRefillTpa = false;
        this.waitingKitTpa = false;
        setTimeout(() => {
          if (this.bot && this.bot.player) {
            this.bot.chat('/kill');
          }
        }, 2000);
        return;
      }

      let username = helpers.getRealUsername(this.bot, helpers.extraerUsername(msg.toString()));
      let message = helpers.extraerMensaje(msg.toString());

      if (username == null || username == '') return;

      if (username !== '8b8tCore' && username !== '8b8t' &&
          this.bot.players && !this.bot.players[username]) {
        return;
      }

      if (message && (
        message.includes('first joined on') ||
        message.includes('You first joined') ||
        message.includes('last seen') ||
        message.includes('Last seen') ||
        message.includes('currently playing')
      )) return;

      this.checkOnError(msg);

      const now = Date.now();
      if (!this.lastChatTime[username]) this.lastChatTime[username] = 0;
      if (!this.chatCount[username]) this.chatCount[username] = 0;

      if (now - this.lastChatTime[username] < 3000) {
        this.chatCount[username]++;
        if (this.chatCount[username] > 5) return;
      } else {
        this.chatCount[username] = 0;
      }
      this.lastChatTime[username] = now;

      const ddsActive = getDDSActive();
      const isDDSTarget = Object.keys(ddsActive).includes(username);
      if (!isDDSTarget) this.sendToDiscord(message, username);

      if (message) {
        const msgLower = message.toLowerCase().trim();

        const kitHandled = await handleKit(msgLower, this.bot, username, (val) => {
          this.waitingKitTpa = val;
          this.waitingRefillTpa = val;
        });
        if (kitHandled) return;

        const voyagerHandled = await this.handleVoyager(username, msgLower);
        if (voyagerHandled) return;
        const dupeHandled = await handleDupeCommand(msgLower, this.bot, username, message);
        if (dupeHandled) return;
        if (message.startsWith('!')) {
          const respuesta = await handleCommand(message, this.bot, username, this.banManager, false);
          if (respuesta && respuesta.multiline) {
            for (const line of respuesta.lines) {
              this.bot.chat('/w ' + username + ' ' + line);
              await this.bot.waitForTicks(6);
            }
          } else if (respuesta) {
            this.bot.chat('/w ' + username + ' ' + respuesta);
          }
        }
      }
    });

    this.bot.on('whispersMsg', async (username, message) => {
      let mensajeMinusculas = message.toLowerCase().trim();

      const now = Date.now();
      if (!this.lastWhisperTime[username]) this.lastWhisperTime[username] = 0;
      if (!this.whisperCount[username]) this.whisperCount[username] = 0;

      if (now - this.lastWhisperTime[username] < 2000) {
        this.whisperCount[username]++;
        if (this.whisperCount[username] > 5) return;
      } else {
        this.whisperCount[username] = 0;
      }
      this.lastWhisperTime[username] = now;

      const ddsActive = getDDSActive();
      const isDDSTarget = Object.keys(ddsActive).includes(username);
      if (this.discordChannel && !isDDSTarget) {
        this.sendToDiscord('(Susurro) ' + message, username);
      }

      const voyagerHandled = await this.handleVoyager(username, mensajeMinusculas);
      if (voyagerHandled) return;
      const dupeHandled = await handleDupeCommand(mensajeMinusculas, this.bot, username, message);
      if (dupeHandled) return;

      let respuesta = await handleCommand(mensajeMinusculas, this.bot, username, this.banManager, false);
      if (respuesta && respuesta.multiline) {
        for (const line of respuesta.lines) {
          this.bot.chat('/w ' + username + ' ' + line);
          await this.bot.waitForTicks(6);
        }
      } else if (respuesta != '' && respuesta != null) {
        let partes = helpers.dividirMensaje(respuesta, 100);
        for (let parte of partes) {
          this.bot.chat('/w ' + username + ' ' + parte);
          await this.bot.waitForTicks(5);
        }
      }
    });

    this.bot.on('kicked', (reason) => {
      console.log('Kicked: ' + reason);
      this.sendToDiscord('<:error:1275575262154588222> Kicked: ' + reason, '8b8tCore');
      stopAllDDS();
      stopDupe(this.bot, 'system');
      let reasonString = JSON.stringify(reason).toLowerCase();
      if (reasonString.includes('already online') || reasonString.includes('already connected')) {
        console.log("Detectado 'Already Online'. Esperando 60 segundos...");
        this.reconnecting = true;
        this.bot.quit();
        setTimeout(() => { this.reconnecting = false; this.start(); }, 60000);
      }
    });

    this.bot._client.on('playerlist_header', async (packet) => {
      try {
        const header = JSON.parse(packet.header).text;
        if (header.includes('b§l6B§3§l6T')) this.bot.chat('/8b8t');
      } catch (e) {}
    });

    this.bot.on('spawn', () => { this._startEndLoop(); });

    this.bot._client.on('respawn', (packet) => {
      if (packet.dimension === 1) setTimeout(() => this._startEndLoop(), 1500);
    });

    this.bot.on('error', (err) => {
      console.log('Error de Minecraft:', err);
      stopAllDDS();
      stopDupe(this.bot, 'system');
    });
  }

  _startEndLoop() {
    if (!this.bot || !this.bot.entity) return;
    const pos = this.bot.entity.position;
    const dim = this.bot.game && this.bot.game.dimension;
    const distancia = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    if (dim !== 1 || distancia > 200) return;

    console.log(`[Bot] En el End cerca de 0,0 (dist: ${Math.round(distancia)}). Iniciando bucle /8b8t...`);
    if (this._endLoopInterval) return;

    const confirmHandler = (msg) => {
      const text = msg.toString();
      if (text.includes('Connecting') || text.includes('connecting') ||
          text.includes('already') || text.includes('joining') ||
          text.includes('queue') || text.includes('Queue')) {
        console.log('[Bot] Servidor confirmó entrada desde el End. Deteniendo bucle /8b8t.');
        this._stopEndLoop();
        this.bot.removeListener('message', confirmHandler);
      }
    };

    this.bot.on('message', confirmHandler);
    try { this.bot.chat('/8b8t'); } catch (e) {}

    this._endLoopInterval = setInterval(() => {
      if (!this.bot) { this._stopEndLoop(); return; }
      try { this.bot.chat('/8b8t'); console.log('[Bot] Enviando /8b8t (bucle End)...'); }
      catch (e) { this._stopEndLoop(); }
    }, 3000);

    this._endLoopTimeout = setTimeout(() => {
      if (this._endLoopInterval) {
        console.log('[Bot] Bucle /8b8t detenido por timeout (60s).');
        this._stopEndLoop();
        this.bot && this.bot.removeListener('message', confirmHandler);
      }
    }, 60000);
  }

  _stopEndLoop() {
    if (this._endLoopInterval) { clearInterval(this._endLoopInterval); this._endLoopInterval = null; }
    if (this._endLoopTimeout) { clearTimeout(this._endLoopTimeout); this._endLoopTimeout = null; }
  }

  checkOnError(msg) {
    if (msg.json && msg.json.color === 'red') {
      if (this.discordChannel) {
        this.sendToDiscord('<:error:1275575262154588222> Error del servidor', '8b8tCore');
      }
    }
  }

  sendToDiscord(texto, user) {
    if (!this.discordChannel) { console.log('ERROR: discordChannel es null'); return; }
    try {
      let emojiPerfil = '<:steve:1463370200912236586>';
      if (user == '14mate') emojiPerfil = '<:14mate:1469897567096799395> ';
      else if (user == 'kutuzovs') emojiPerfil = '<:kutuzovs:1477699695769026630>';
      else if (user == 'htp1p0') emojiPerfil = '<:htp1p0:1463370235162918957>';
      else if (user == 'Kurtz' || user == 'KurtzMC' || user == 'KurtzWasTaken') emojiPerfil = '<:KurtzM:1470114268186808410>';
      else if (user == '888o') emojiPerfil = '<:888o:1473445972200652960>';
      else if (user == '_aksn') emojiPerfil = '<:aksn:1475225080949641368>';
      else if (user == '8b8t' || user == '8b8tCore') emojiPerfil = '<:8b8t:1463370248144158894>';
      texto = texto.replace(/@here/g, '[at]here').replace(/@everyone/g, '[at]everyone').replace(/<@/g, '<[at]').replace(/discord.gg/g, '`discordLink`').replace(/https/g, 'link omitido');
      let mensaje = '**' + emojiPerfil + ' ' + user + ' >>** ' + helpers.replaceLinks(texto);
      this.discordChannel.send(mensaje);
    } catch (error) {
      console.error('Error al enviar mensaje a Discord:', error);
    }
  }

  getBot() { return this.bot; }
  getJoindateManager() { return this.joindateManager; }
}

module.exports = MinecraftBot;