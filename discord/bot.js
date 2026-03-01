const {
    Client,
    GatewayIntentBits,
    ActivityType,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
} = require("discord.js");
const config = require("../config");
const { handleHelp, handleBanStatus, handleBanList } = require("./commands");
const { handleCommand, getDDSActive } = require("../minecraft/commands");
const { setDupeEnabled, getDupeEnabled } = require("../dupe/bot");

class DiscordBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });
        this.channels = {};
        this.mcBot = null;
        this.joindateManager = null;
        this.banManager = null;
    }

    async start() {
        return new Promise((resolve) => {
            this.client.once("ready", async () => {
                console.log(`Bot de Discord conectado como ${this.client.user.tag}`);
                try {
                    this.channels.main = await this.client.channels.fetch(config.discord.channels.main);
                    this.channels.cmd = await this.client.channels.fetch(config.discord.channels.cmd);
                    this.channels.alert = await this.client.channels.fetch(config.discord.channels.alert);
                    console.log(`Canal principal cargado: ${this.channels.main.name}`);
                    console.log(`Canal comandos cargado: ${this.channels.cmd.name}`);
                    console.log(`Canal alertas cargado: ${this.channels.alert.name}`);
                } catch (error) {
                    console.error("Error al cargar canales:", error);
                }
                await this.registerSlashCommands();
                this.updatePresence();
                setInterval(() => this.updatePresence(), 10000);
                resolve();
            });
            this.client.login(config.discord.token);
        });
    }

    async registerSlashCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName("help")
                .setDescription("Muestra la lista de comandos"),
            new SlashCommandBuilder()
                .setName("restart")
                .setDescription("Reinicia el bot completo"),
            new SlashCommandBuilder()
                .setName("banstatus")
                .setDescription("Estado de los bots activos"),
            new SlashCommandBuilder()
                .setName("banlist")
                .setDescription("Muestra usuarios baneados"),
            new SlashCommandBuilder()
                .setName("unbanall")
                .setDescription("Remueve todos los usuarios baneados"),
            new SlashCommandBuilder()
                .setName("players")
                .setDescription("Lista de jugadores conectados"),
            new SlashCommandBuilder()
                .setName("tpa")
                .setDescription("Solicitud de teletransporte"),
            new SlashCommandBuilder()
                .setName("tpahere")
                .setDescription("Teletransportar jugador hacia ti"),
            new SlashCommandBuilder()
                .setName("ddsstatus")
                .setDescription("Ver el estado del DDS activo"),
            new SlashCommandBuilder()
                .setName("ban")
                .setDescription("Añadir usuario a la lista de baneos")
                .addStringOption((o) =>
                    o.setName("usuario").setDescription("Usuario de Minecraft").setRequired(true),
                ),
            new SlashCommandBuilder()
                .setName("unban")
                .setDescription("Remover usuario de la lista de baneos")
                .addStringOption((o) =>
                    o.setName("usuario").setDescription("Usuario de Minecraft").setRequired(true),
                ),
            new SlashCommandBuilder()
                .setName("dds")
                .setDescription("Spam continuo contra un jugador")
                .addStringOption((o) =>
                    o.setName("jugador").setDescription("Jugador objetivo").setRequired(true),
                )
                .addStringOption((o) =>
                    o.setName("mensaje").setDescription("Mensaje a spamear").setRequired(true),
                ),
            new SlashCommandBuilder()
                .setName("ddsoff")
                .setDescription("Detener spam contra un jugador")
                .addStringOption((o) =>
                    o.setName("jugador").setDescription("Jugador objetivo").setRequired(true),
                ),
            new SlashCommandBuilder()
                .setName("ping")
                .setDescription("Muestra la latencia de un jugador")
                .addStringOption((o) =>
                    o.setName("usuario").setDescription("Usuario de Minecraft (opcional)"),
                ),
            new SlashCommandBuilder()
                .setName("info")
                .setDescription("Informacion detallada de un jugador")
                .addStringOption((o) =>
                    o.setName("usuario").setDescription("Usuario de Minecraft (opcional)"),
                ),
            new SlashCommandBuilder()
                .setName("say")
                .setDescription("Enviar mensaje al chat de Minecraft (Admin)")
                .addStringOption((o) =>
                    o.setName("mensaje").setDescription("Mensaje a enviar").setRequired(true),
                ),
            new SlashCommandBuilder()
                .setName("8b8tlogs")
                .setDescription("Genera y envía los PDFs de join dates y métricas del servidor"),
            new SlashCommandBuilder()
                .setName("8b8tplayer")
                .setDescription("Estadísticas de jugadores registrados en el servidor"),
            new SlashCommandBuilder()
                .setName("blacklist")
                .setDescription("Añadir usuario a la blacklist (rojo en PDF)")
                .addStringOption((o) =>
                    o.setName("usuario").setDescription("Usuario de Minecraft").setRequired(true),
                ),
            new SlashCommandBuilder()
                .setName("dupetoggle")
                .setDescription("Activar o desactivar el frame dupe (solo owner)")
                .addStringOption((o) =>
                    o
                        .setName("estado")
                        .setDescription("on o off")
                        .setRequired(true)
                        .addChoices(
                            { name: "on", value: "on" },
                            { name: "off", value: "off" },
                        ),
                ),
        ].map((c) => c.toJSON());

        const rest = new REST({ version: "10" }).setToken(config.discord.token);
        try {
            console.log("Registrando comandos slash...");
            await rest.put(Routes.applicationCommands(this.client.user.id), { body: commands });
            console.log(`${commands.length} comandos slash registrados correctamente`);
        } catch (error) {
            console.error("Error al registrar comandos slash:", error);
        }
    }

    setMinecraftBot(mcBot) { this.mcBot = mcBot; }
    setBanManager(banManager) { this.banManager = banManager; }
    setLogsManager(logsManager) { /* mantenido por compatibilidad */ }
    setJoindateManager(jm) { this.joindateManager = jm; }

    async setupEvents() {
        this.client.on("messageCreate", async (message) => {
            if (message.author.bot) return;
            if (message.channel.id !== config.discord.channels.main) return;
            if (message.content.startsWith("/")) return;
            if (this.mcBot && this.mcBot.player) {
                this.mcBot.chat(`[Discord] ${message.author.username}: ${message.content}`);
            }
        });

        this.client.on("interactionCreate", async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            const { commandName } = interaction;

            if (commandName === "help") return handleHelp(interaction);

            if (commandName === "restart") {
                if (interaction.user.id !== config.adminDiscordId) {
                    return interaction.reply({ content: "No tienes permisos para usar este comando.", ephemeral: true });
                }
                await interaction.reply({ content: "Reiniciando el bot completo...", ephemeral: true });
                this.banManager.removeAll();
                this.banManager.save();
                setTimeout(() => process.exit(0), 2000);
                return;
            }

            if (commandName === "banstatus") return handleBanStatus(interaction, this.banManager);
            if (commandName === "banlist") return handleBanList(interaction, this.banManager);

            if (commandName === "ban") {
                const targetUser = interaction.options.getString("usuario");
                const resultado = this.banManager.create(targetUser);
                if (resultado) {
                    return interaction.reply({ content: "Usuario **" + targetUser + "** añadido. Total: " + this.banManager.getList().length, ephemeral: true });
                } else {
                    return interaction.reply({ content: "**" + targetUser + "** ya está en la lista de baneos.", ephemeral: true });
                }
            }

            if (commandName === "unban") {
                const targetUser = interaction.options.getString("usuario");
                const resultado = this.banManager.remove(targetUser);
                if (resultado) {
                    return interaction.reply({ content: "**" + targetUser + "** removido. Restantes: " + this.banManager.getList().length, ephemeral: true });
                } else {
                    return interaction.reply({ content: "**" + targetUser + "** no está en la lista de baneos.", ephemeral: true });
                }
            }

            if (commandName === "unbanall") {
                const cantidad = this.banManager.removeAll();
                if (cantidad === 0) return interaction.reply({ content: "No hay usuarios baneados actualmente.", ephemeral: true });
                return interaction.reply({ content: "Se removieron **" + cantidad + "** usuarios.", ephemeral: true });
            }

            if (commandName === "dds") {
                const targetPlayer = interaction.options.getString("jugador");
                const spamMessage = interaction.options.getString("mensaje");
                const result = await handleCommand(
                    "!dds " + targetPlayer + " " + spamMessage,
                    this.mcBot,
                    interaction.user.username,
                    this.banManager,
                );
                return interaction.reply({ content: result || "DDS activado.", ephemeral: true });
            }

            if (commandName === "ddsoff") {
                const targetPlayer = interaction.options.getString("jugador");
                const result = await handleCommand(
                    "!ddsoff " + targetPlayer,
                    this.mcBot,
                    interaction.user.username,
                    this.banManager,
                );
                return interaction.reply({ content: result || "DDS detenido.", ephemeral: true });
            }

            if (commandName === "ddsstatus") {
                const ddsActive = getDDSActive();
                const targets = Object.keys(ddsActive);

                if (targets.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor("#95a5a6")
                        .setTitle("Estado DDS")
                        .setDescription("No hay ningún DDS activo actualmente.")
                        .setTimestamp();
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                const fields = targets.map((target) => {
                    const info = ddsActive[target];
                    const timeSinceLastSeen = Math.floor((Date.now() - info.lastSeen) / 1000);
                    const estado = info.ignored
                        ? "🔇 Ignorado (sin respuesta +10s)"
                        : this.mcBot && this.mcBot.players && this.mcBot.players[target]
                          ? "🟢 Online - Recibiendo mensajes"
                          : "🔴 Offline";
                    return {
                        name: "🎯 " + target,
                        value: "**Estado:** " + estado + "\n**Mensajes enviados:** " + info.count + "\n**Ultima vez visto:** hace " + timeSinceLastSeen + "s",
                        inline: false,
                    };
                });

                const embed = new EmbedBuilder()
                    .setColor("#e74c3c")
                    .setTitle("Estado del DDS")
                    .setDescription("**" + targets.length + "** objetivo" + (targets.length !== 1 ? "s" : "") + " activo" + (targets.length !== 1 ? "s" : ""))
                    .addFields(fields)
                    .setFooter({ text: "Usa /ddsoff <jugador> para detener" })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (!this.mcBot || !this.mcBot.player) {
                return interaction.reply({ content: "El bot de Minecraft no esta conectado.", ephemeral: true });
            }

            if (commandName === "players") {
                try {
                    await interaction.deferReply({ ephemeral: true });
                    const embed = await handleCommand("!players", this.mcBot, interaction.user.username, this.banManager, true);
                    if (embed && typeof embed === "object" && embed.data) {
                        return interaction.editReply({ embeds: [embed] });
                    } else {
                        return interaction.editReply({ content: "No se pudo obtener la lista de jugadores." });
                    }
                } catch (err) {
                    console.error("Error en /players:", err);
                    try { return interaction.editReply({ content: "Error al obtener jugadores." }); } catch (e) {}
                }
            }

            if (commandName === "ping") {
                const usuario = interaction.options.getString("usuario") || interaction.user.username;
                const result = await handleCommand("!ping " + usuario, this.mcBot, interaction.user.username, this.banManager);
                return interaction.reply({ content: result || "Jugador no encontrado.", ephemeral: true });
            }

            if (commandName === "info") {
                const usuario = interaction.options.getString("usuario") || interaction.user.username;
                const result = await handleCommand("!info " + usuario, this.mcBot, interaction.user.username, this.banManager);
                return interaction.reply({ content: result || "Jugador no encontrado.", ephemeral: true });
            }

            if (commandName === "say") {
                if (interaction.user.id !== config.adminDiscordId) {
                    return interaction.reply({ content: "No tienes permisos para usar este comando.", ephemeral: true });
                }
                const mensaje = interaction.options.getString("mensaje");
                this.mcBot.chat(mensaje);
                return interaction.reply({ content: "Mensaje enviado al chat de Minecraft.", ephemeral: true });
            }

            if (commandName === "tpa") {
                const result = await handleCommand("!tpa", this.mcBot, interaction.user.username, this.banManager);
                return interaction.reply({ content: result || "Comando ejecutado.", ephemeral: true });
            }

            if (commandName === "8b8tlogs") {
                try {
                    await interaction.deferReply({ ephemeral: true });
                    if (!this.joindateManager) {
                        return interaction.editReply({ content: "Sistema de joindate no inicializado." });
                    }
                    const paths = await this.joindateManager.generatePDFs();
                    const stats = this.joindateManager.getStats();
                    const { AttachmentBuilder } = require("discord.js");
                    const files = [];
                    const fs = require("fs");
                    if (fs.existsSync(paths.players)) files.push(new AttachmentBuilder(paths.players, { name: "8b8t_players.pdf" }));
                    if (fs.existsSync(paths.metrics)) files.push(new AttachmentBuilder(paths.metrics, { name: "8b8t_metrics.pdf" }));
                    if (paths.graphs && fs.existsSync(paths.graphs)) files.push(new AttachmentBuilder(paths.graphs, { name: "8b8t_graphs.pdf" }));
                    if (files.length === 0) return interaction.editReply({ content: "No se pudieron generar los PDFs." });
                    return interaction.editReply({ content: `PDFs generados. Jugadores tracked: ${stats.total} | Pico online: ${stats.peak}`, files });
                } catch (err) {
                    console.error("Error en /8b8tlogs:", err);
                    try { return interaction.editReply({ content: "Error al generar PDFs: " + err.message }); } catch (e) {}
                }
            }

            if (commandName === "8b8tplayer") {
                if (!this.joindateManager) {
                    return interaction.reply({ content: "Sistema de joindate no inicializado.", ephemeral: true });
                }
                const stats = this.joindateManager.getStats();
                const { EmbedBuilder: EB2 } = require("discord.js");
                const embed = new EB2()
                    .setColor("#16213e")
                    .setTitle("Jugadores Registrados — 8b8t.me")
                    .setDescription(`El bot tiene registrados **${stats.total}** jugadores.`)
                    .addFields(
                        { name: "Total registrados", value: String(stats.total), inline: true },
                        { name: "Java", value: String(stats.java || 0), inline: true },
                        { name: "Bedrock", value: String(stats.bedrock || 0), inline: true },
                        { name: "Pico online", value: String(stats.peak), inline: true },
                        { name: "En whitelist", value: String(stats.whitelist), inline: true },
                    )
                    .setTimestamp();
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === "blacklist") {
                if (!this.joindateManager) {
                    return interaction.reply({ content: "Sistema de joindate no inicializado.", ephemeral: true });
                }
                const targetUser = interaction.options.getString("usuario");
                const added = this.joindateManager.addToBlacklist(targetUser);
                this.joindateManager.addPlayerManual(targetUser, null);
                if (added) {
                    return interaction.reply({ content: `**${targetUser}** añadido a la blacklist. Aparecerá en rojo en el PDF.`, ephemeral: true });
                } else {
                    return interaction.reply({ content: `**${targetUser}** ya estaba en la blacklist.`, ephemeral: true });
                }
            }

            if (commandName === "dupetoggle") {
                if (interaction.user.username !== "nocomcow") {
                    return interaction.reply({ content: "No tienes permisos para usar este comando.", ephemeral: true });
                }
                const valor = interaction.options.getString("estado");
                setDupeEnabled(valor === "on");
                return interaction.reply({
                    content: "Frame Dupe " + (valor === "on" ? "ACTIVADO" : "DESACTIVADO") + ". El estado se guardará aunque el bot se reinicie.",
                    ephemeral: true,
                });
            }

            if (commandName === "tpahere") {
                const result = await handleCommand("!tpahere", this.mcBot, interaction.user.username, this.banManager);
                return interaction.reply({ content: result || "Comando ejecutado.", ephemeral: true });
            }
        });
    }

    updatePresence() {
        if (!this.client.user) return;
        let estado = "Conectando...";
        if (this.mcBot && this.mcBot.players) {
            const botUsername = this.mcBot.username;
            const cantidad = Object.keys(this.mcBot.players).filter(name => {
                if (name === botUsername) return false;
                const p = this.mcBot.players[name];
                return p && p.ping !== null && p.ping !== undefined;
            }).length;
            estado = cantidad + " jugador" + (cantidad !== 1 ? "es" : "") + " en 8b8t";
        }
        this.client.user.setPresence({
            activities: [{ name: estado, type: ActivityType.Watching }],
            status: "online",
        });
    }

    getChannels() { return this.channels; }
    getClient() { return this.client; }
}

module.exports = DiscordBot;