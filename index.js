const DiscordBot = require("./discord/bot");
const MinecraftBot = require("./minecraft/bot");
const BanManager = require("./ban/manager");
const UserManager = require("./users/manager");
const MessagingHandler = require("./messaging/handler");

async function main() {
    console.log("Iniciando bot...");

    const discordBot = new DiscordBot();
    await discordBot.start();

    console.log("Discord bot iniciado...");

    const channels = discordBot.getChannels();

    const banManager = new BanManager(channels.main, channels.alert);
    const userManager = new UserManager();
    const messagingHandler = new MessagingHandler(userManager);

    const usuariosBaneados = banManager.load();
    if (usuariosBaneados.length > 0) {
        console.log(
            `Reiniciando baneos para ${usuariosBaneados.length} usuarios...`,
        );
        for (const usuario of usuariosBaneados) {
            setTimeout(
                () => {
                    banManager.create(usuario, true);
                },
                2000 * usuariosBaneados.indexOf(usuario),
            );
        }
    }

    const minecraftBot = new MinecraftBot(
        channels.main,
        banManager,
        messagingHandler,
        discordBot.getClient(),
    );
    minecraftBot.start();

    discordBot.setMinecraftBot(minecraftBot.getBot());
    discordBot.setBanManager(banManager);
    discordBot.setUserManager(userManager);
    discordBot.setMessagingHandler(messagingHandler);
    discordBot.setJoindateManager(minecraftBot.getJoindateManager());

    await discordBot.setupEvents();

    setInterval(() => {
        banManager.checkOnline(minecraftBot.getBot());
    }, 10000);

    setInterval(() => {
        const estado = banManager.getStatus();
        if (estado.total > 0) {
            console.log(
                `Estado bots: ${estado.activos} activos, ${estado.inactivos} reiniciando`,
            );
        }
    }, 60000);

    process.on("SIGINT", () => {
        console.log("Cerrando bot...");
        banManager.removeAll();
        banManager.save();
        setTimeout(() => process.exit(0), 3000);
    });

    process.on("SIGTERM", () => {
        console.log("Cerrando bot...");
        banManager.removeAll();
        banManager.save();
        setTimeout(() => process.exit(0), 3000);
    });

    console.log("Bot completamente inicializado");
}

main().catch((error) => {
    console.error("Error fatal:", error);
    process.exit(1);
});
