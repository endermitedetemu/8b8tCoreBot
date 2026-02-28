const { EmbedBuilder } = require('discord.js');
const config = require('../config');

async function handleHelp(interaction) {
  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle('Centro de Comandos')
    .setDescription('Lista completa de comandos disponibles del bot')
    .addFields(
      {
        name: 'Comandos de Minecraft',
        value: '```yaml\n' +
               '/ping [usuario]  : Muestra la latencia del jugador\n' +
               '/players         : Lista de jugadores conectados\n' +
               '/info [usuario]  : Informacion detallada del jugador\n' +
               '/tpa             : Solicitud de teletransporte\n' +
               '/tpahere         : Teletransportar jugador hacia ti\n' +
               '/say <mensaje>   : Enviar mensaje al chat (Admin)\n' +
               '```',
        inline: false
      },
      {
        name: 'Sistema de Mensajeria',
        value: '```yaml\n' +
               '/addid <usuario> : Vincular Discord con Minecraft\n' +
               '/idlist          : Ver usuarios registrados\n' +
               '/w <usuario/all> <msg> : Enviar mensaje privado\n' +
               '```',
        inline: false
      },
      {
        name: 'Exploits by htp1p0',
        value: '```yaml\n' +
               '/dds <player> <msg> : Spam de mensajes a un jugador\n' +
               '/ddsoff <player>    : Detener spam\n' +
               '/ddsstatus          : Ver estado del DDS activo\n' +
               '/ban <usuario>      : Añadir usuario a lista de baneos\n' +
               '/unban <usuario>    : Remover usuario de la lista\n' +
               '/banlist            : Mostrar usuarios baneados\n' +
               '/unbanall           : Limpiar lista de baneos\n' +
               '/banstatus          : Estado de los bots activos\n' +
               '```',
        inline: false
      },
      {
        name: 'Sistema de Logs',
        value: '```yaml\n' +
               '/loglist            : Ver lista de usuarios en logs\n' +
               '/logsview <usuario> : Ver coordenadas de un usuario\n' +
               '```',
        inline: false
      },
      {
        name: 'Estadisticas del Servidor',
        value: '```yaml\n' +
               '/8b8tlogs           : PDFs con join dates y metricas\n' +
               '/8b8tplayer         : Total jugadores registrados en BD\n' +
               '/blacklist <user>   : Añadir usuario a blacklist (rojo en PDF)\n' +
               '```',
        inline: false
      },
      {
        name: 'Administracion',
        value: '```yaml\n' +
               '/restart         : Reiniciar bot completo (nocomcow)\n' +
               '/dupetoggle      : Activar/desactivar frame dupe (nocomcow)\n' +
               '/help            : Mostrar este mensaje\n' +
               '```',
        inline: false
      }
    )
    .setFooter({ text: 'Bot 8b8t | Desarrollado para la comunidad' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], flags: 64 });
}

async function handleBanStatus(interaction, banManager) {
  const estado = banManager.getStatus();

  if (estado.total === 0) {
    return interaction.reply({ content: 'No hay usuarios baneados actualmente.', flags: 64 });
  }

  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('Estado del Sistema de Baneos')
    .addFields(
      { name: 'Total de usuarios', value: `${estado.total}`, inline: true },
      { name: 'Bots activos', value: `${estado.activos}`, inline: true },
      { name: 'Bots reiniciando', value: `${estado.inactivos}`, inline: true }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed], flags: 64 });
}

async function handleBanList(interaction, banManager) {
  const baneados = banManager.getList();

  if (baneados.length === 0) {
    return interaction.reply({ content: 'No hay usuarios baneados actualmente.', flags: 64 });
  }

  const embed = new EmbedBuilder()
    .setColor('#ff0000')
    .setTitle('Lista de Usuarios Baneados')
    .setDescription(`Total: ${baneados.length} usuario(s)`)
    .addFields({
      name: 'Usuarios',
      value: baneados.map(u => `- ${u}`).join('\n'),
      inline: false
    })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], flags: 64 });
}

module.exports = {
  handleHelp,
  handleBanStatus,
  handleBanList
};