class MessagingHandler {
  constructor(userManager) {
    this.userManager = userManager;
  }

  async sendMessageFromDiscord(bot, discordClient, senderId, target, message) {
    if (!this.userManager.isLinked(senderId)) {
      return { success: false, message: 'No estas registrado. Usa !addid <usuario_minecraft> para registrarte.' };
    }

    const senderMc = this.userManager.getMinecraftUsername(senderId);

    if (target.toLowerCase() === 'all') {
      const users = this.userManager.getAllUsers();
      let sentMc = 0;

      for (let discordId in users) {
        const mcUsername = users[discordId].minecraft;
        
        if (bot && bot.players && bot.players[mcUsername]) {
          bot.chat(`/w ${mcUsername} [${senderMc}] ${message}`);
          sentMc++;
        }
      }

      return { success: true, message: `Mensaje enviado a ${sentMc} usuarios en Minecraft.` };
    }

    let targetMcUsername = null;

    if (!target.match(/^\d+$/)) {
      const userInfo = this.userManager.getUserByMinecraft(target);
      if (userInfo) {
        targetMcUsername = userInfo.minecraft;
      } else {
        return { success: false, message: `El usuario ${target} no esta registrado.` };
      }
    } else {
      targetMcUsername = this.userManager.getMinecraftUsername(target);
      if (!targetMcUsername) {
        return { success: false, message: `El ID ${target} no esta registrado.` };
      }
    }

    if (bot && bot.players && bot.players[targetMcUsername]) {
      bot.chat(`/w ${targetMcUsername} [${senderMc}] ${message}`);
      return { success: true, message: `Mensaje enviado a ${targetMcUsername} en Minecraft.` };
    } else {
      return { success: false, message: `El usuario ${targetMcUsername} no esta conectado en Minecraft.` };
    }
  }

  async sendMessageFromMinecraft(bot, discordClient, senderMc, target, message) {
    const senderDiscordId = this.userManager.getDiscordId(senderMc);
    
    if (!senderDiscordId) {
      return 'No estas registrado. Contacta a un admin para registrarte.';
    }

    if (target.toLowerCase() === 'all') {
      const users = this.userManager.getAllUsers();
      let sentDiscord = 0;

      for (let discordId in users) {
        try {
          const user = await discordClient.users.fetch(discordId);
          await user.send(`**${senderMc} >>** ${message}`);
          sentDiscord++;
        } catch (e) {
          console.log(`No se pudo enviar DM a ${discordId}`);
        }
      }

      return `Mensaje enviado a ${sentDiscord} usuarios en Discord.`;
    }

    let targetDiscordId = target;

    if (!target.match(/^\d+$/)) {
      const userInfo = this.userManager.getUserByMinecraft(target);
      if (userInfo) {
        targetDiscordId = userInfo.discordId;
      } else {
        return `El usuario ${target} no esta registrado.`;
      }
    } else {
      if (!this.userManager.isLinked(target)) {
        return `El ID ${target} no esta registrado.`;
      }
    }

    try {
      const user = await discordClient.users.fetch(targetDiscordId);
      await user.send(`**${senderMc} >>** ${message}`);
      return `Mensaje enviado por Discord.`;
    } catch (e) {
      return `No se pudo enviar el mensaje privado por Discord.`;
    }
  }
}

module.exports = MessagingHandler;