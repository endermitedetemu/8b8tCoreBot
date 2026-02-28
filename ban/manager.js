const { spawn } = require('child_process');
const path = require('path');
const Storage = require('../utils/storage');

class BanManager {
  constructor(discordChannel, alertChannel) {
    this.bannedBots = {};
    this.storage = new Storage('banned_users.json');
    this.discordChannel = discordChannel;
    this.alertChannel = alertChannel;
  }

  load() {
    const usuarios = this.storage.load();
    return usuarios;
  }

  save() {
    const usuarios = Object.keys(this.bannedBots);
    this.storage.save(usuarios);
  }

  create(targetUsername, esRecarga = false) {
    if (this.bannedBots[targetUsername] && this.bannedBots[targetUsername].active) {
      console.log(`Ya existe un proceso activo para: ${targetUsername}`);
      return false;
    }

    console.log(`Iniciando proceso de baneo para: ${targetUsername}`);

    try {
      const childProcess = spawn('node', [path.join(__dirname, 'ban_bot.js'), targetUsername], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      this.bannedBots[targetUsername] = {
        process: childProcess,
        active: true,
        online: false,
        alertaSent: false,
        pid: childProcess.pid
      };

      this.save();

      childProcess.stdout.on('data', (data) => {
        console.log(`[${targetUsername}] ${data.toString().trim()}`);
      });

      childProcess.stderr.on('data', (data) => {
        console.error(`[${targetUsername} ERROR] ${data.toString().trim()}`);
      });

      childProcess.on('close', (code) => {
        console.log(`Proceso para ${targetUsername} cerrado con código ${code}`);
        if (this.bannedBots[targetUsername] && this.bannedBots[targetUsername].active) {
          console.log(`Reiniciando proceso para ${targetUsername} en 2 segundos...`);
          setTimeout(() => {
            if (this.bannedBots[targetUsername] && this.bannedBots[targetUsername].active) {
              delete this.bannedBots[targetUsername];
              this.create(targetUsername, true);
            }
          }, 2000);
        }
      });

      childProcess.on('error', (err) => {
        console.error(`Error en proceso de ${targetUsername}:`, err);
      });

      if (!esRecarga && this.discordChannel) {
        this.sendMessage(`Usuario ${targetUsername} ha sido añadido a la lista de baneos`, "Sistema");
      }

      return true;
    } catch (error) {
      console.error(`Error al crear proceso para ${targetUsername}:`, error);
      return false;
    }
  }

  remove(targetUsername) {
    if (!this.bannedBots[targetUsername]) {
      return false;
    }

    try {
      this.bannedBots[targetUsername].active = false;

      if (this.bannedBots[targetUsername].process) {
        try {
          this.bannedBots[targetUsername].process.kill('SIGTERM');
          setTimeout(() => {
            if (this.bannedBots[targetUsername] && this.bannedBots[targetUsername].process) {
              try {
                this.bannedBots[targetUsername].process.kill('SIGKILL');
              } catch (e) {}
            }
          }, 2000);
        } catch (e) {
          console.error(`Error al matar proceso de ${targetUsername}:`, e.message);
        }
      }

      delete this.bannedBots[targetUsername];
      console.log(`Proceso para ${targetUsername} detenido`);
      this.save();

      if (this.discordChannel) {
        this.sendMessage(`Usuario ${targetUsername} ha sido removido de la lista de baneos`, "Sistema");
      }

      return true;
    } catch (e) {
      console.error(`Error al detener proceso de ${targetUsername}:`, e);
      delete this.bannedBots[targetUsername];
      this.save();
      return false;
    }
  }

  removeAll() {
    let contador = 0;
    const usuarios = Object.keys(this.bannedBots);

    for (let username of usuarios) {
      try {
        this.bannedBots[username].active = false;
        if (this.bannedBots[username].process) {
          try {
            this.bannedBots[username].process.kill('SIGTERM');
          } catch (e) {}
        }
        contador++;
      } catch (e) {
        console.error(`Error al detener proceso de ${username}:`, e);
      }
    }

    this.bannedBots = {};
    console.log(`Todos los procesos detenidos (${contador})`);
    this.save();

    if (this.discordChannel) {
      this.sendMessage(`Todos los usuarios han sido removidos de la lista de baneos (${contador} usuarios)`, "Sistema");
    }

    return contador;
  }

  getStatus() {
    let activos = 0;
    let inactivos = 0;

    for (let username in this.bannedBots) {
      if (this.bannedBots[username].active) {
        try {
          if (this.bannedBots[username].process && !this.bannedBots[username].process.killed) {
            activos++;
          } else {
            inactivos++;
          }
        } catch (e) {
          inactivos++;
        }
      }
    }

    return { total: Object.keys(this.bannedBots).length, activos, inactivos };
  }

  checkOnline(mcBot) {
    for (let username in this.bannedBots) {
      if (mcBot && mcBot.players && mcBot.players[username]) {
        if (!this.bannedBots[username].online) {
          this.bannedBots[username].online = true;
          if (!this.bannedBots[username].alertaSent) {
            this.bannedBots[username].alertaSent = true;
            if (this.alertChannel) {
              this.alertChannel.send(`El usuario **${username}** esta dentro del servidor, esperare a que salga para banearlo. Si no lo baneo enviale un DM a <@1329976232774733825>`);
            }
            console.log(`ALERTA: Usuario baneado ${username} detectado online`);
          }
        }
      } else {
        if (this.bannedBots[username] && this.bannedBots[username].online) {
          this.bannedBots[username].online = false;
          this.bannedBots[username].alertaSent = false;
          console.log(`Usuario baneado ${username} ha salido del servidor`);
        }
      }
    }
  }

  sendMessage(texto, user) {
    if (!this.discordChannel) return;
    try {
      let emojiPerfil = "<:8b8t:1463370248144158894>";
      texto = texto.replace(/@here/g, "[at]here").replace(/@everyone/g, "[at]everyone").replace(/<@/g, "<[at]");
      let mensaje = `**${emojiPerfil} ${user} >>** ${texto}`;
      this.discordChannel.send(mensaje);
    } catch (error) {
      console.error(error);
    }
  }

  getList() {
    return Object.keys(this.bannedBots);
  }
}

module.exports = BanManager;