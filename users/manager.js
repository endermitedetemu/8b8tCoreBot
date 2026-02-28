const fs = require('fs');
const path = require('path');

class UserManager {
  constructor() {
    this.usersFile = path.join(__dirname, '..', 'data', 'linked_users.json');
    this.dataDir = path.join(__dirname, '..', 'data');
    this.users = {};
    
    this.ensureDataDir();
    this.load();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  load() {
    try {
      if (fs.existsSync(this.usersFile)) {
        const data = fs.readFileSync(this.usersFile, 'utf8');
        this.users = JSON.parse(data);
        console.log(`Usuarios vinculados cargados: ${Object.keys(this.users).length}`);
      } else {
        this.users = {};
        this.save();
      }
    } catch (error) {
      console.error('Error al cargar usuarios vinculados:', error);
      this.users = {};
    }
  }

  save() {
    try {
      fs.writeFileSync(this.usersFile, JSON.stringify(this.users, null, 2));
    } catch (error) {
      console.error('Error al guardar usuarios vinculados:', error);
    }
  }

  addUser(discordId, minecraftUsername) {
    this.users[discordId] = {
      minecraft: minecraftUsername,
      addedAt: new Date().toISOString()
    };
    this.save();
    return true;
  }

  removeUser(discordId) {
    if (this.users[discordId]) {
      delete this.users[discordId];
      this.save();
      return true;
    }
    return false;
  }

  getMinecraftUsername(discordId) {
    return this.users[discordId] ? this.users[discordId].minecraft : null;
  }

  getDiscordId(minecraftUsername) {
    for (let discordId in this.users) {
      if (this.users[discordId].minecraft.toLowerCase() === minecraftUsername.toLowerCase()) {
        return discordId;
      }
    }
    return null;
  }

  isLinked(discordId) {
    return this.users[discordId] !== undefined;
  }

  getAllUsers() {
    return this.users;
  }

  getUserByMinecraft(minecraftUsername) {
    for (let discordId in this.users) {
      if (this.users[discordId].minecraft.toLowerCase() === minecraftUsername.toLowerCase()) {
        return { discordId, ...this.users[discordId] };
      }
    }
    return null;
  }
}

module.exports = UserManager;