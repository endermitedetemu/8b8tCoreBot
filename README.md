# 8b8tCoreBot

Este proyecto es un bot integral para el servidor de Minecraft 8b8t, desarrollado en **Node.js**. Su objetivo es gestionar la interacción entre el servidor de juego y Discord, además de automatizar tareas de administración y recolección de datos.

## Estructura del Proyecto (Explicación de Carpetas)

Para mantener el código limpio, el bot se divide en módulos especializados:

* **`index.js`**: El punto de entrada principal. Es el archivo que arranca todos los procesos del bot.
* **`minecraft/`**: Contiene la lógica de `mineflayer`. Aquí se gestiona cómo el bot se mueve, chatea y responde a comandos dentro de Minecraft.
* **`discord/`**: Gestiona la conexión con la API de Discord. Permite que lo que pase en el juego se vea en un canal y viceversa.
* **`ban/`**: Módulo dedicado al control de acceso. Administra quién tiene permitido interactuar con el bot.
* **`data/`**: Almacena archivos JSON persistentes (logs de coordenadas, usuarios vinculados, etc.). Son las "bases de datos" locales del bot.
* **`joindate/`**: Un módulo avanzado que utiliza scripts de Python para generar reportes y gráficas en PDF sobre la actividad de los jugadores.
* **`dupe/`**: Contiene funciones específicas para automatizar mecánicas de duplicación permitidas o probadas en el servidor.
* **`utils/`**: Funciones de ayuda (helpers) que se usan en todo el proyecto, como formateo de texto o manejo de guardado de archivos.

## Requisitos del Sistema

Para correr este bot en tu servidor Linux, necesitas:
1. **Node.js** (Versión 16 o superior).
2. **Python 3** (Para los módulos de métricas y PDFs).
3. **NPM** (Gestor de paquetes de Node).

## Instalación Paso a Paso

### 1. Clonar el repositorio
```bash
git clone [https://github.com/endermitedetemu/8b8tCoreBot.git](https://github.com/endermitedetemu/8b8tCoreBot.git)
cd 8b8tCoreBot
2. Instalar dependencias de Node.js
Este comando instalará librerías como mineflayer, discord.js y otras necesarias:

Bash

npm install
3. Configuración de Credenciales (CRÍTICO)
Por seguridad, el archivo config.js no está en este repositorio. Debes crearlo manualmente en la raíz del proyecto con el siguiente formato:

JavaScript

module.exports = {
    minecraft: {
        host: '8b8t.me',
        username: 'TuEmail@ejemplo.com',
        password: 'TuContraseña',
        version: '1.12.2'
    },
    discord: {
        token: 'TOKEN_DE_TU_BOT_AQUI',
        channelId: 'ID_DEL_CANAL'
    }
}
4. Preparar el entorno de Python
Si planeas usar las funciones de gráficas (joindate), ejecuta el script de preparación:

Bash

chmod +x setup_venv.sh
./setup_venv.sh
Ejecución del Bot
Para iniciar el bot y mantenerlo activo en tu terminal:

Bash

node index.js
Seguridad y Privacidad
Archivo .gitignore: Este proyecto incluye un archivo .gitignore configurado para evitar que el archivo config.js y las carpetas node_modules/ o venv/ se suban a GitHub. Esto protege tus contraseñas y tokens de ser públicos.

Tokens: Nunca compartas el contenido de tu config.js. Si sospechas que tu token de Discord se filtró, renuévalo inmediatamente en el Developer Portal de Discord.

Desarrollado por endermitedetemu para la comunidad de 8b8t.


---

### ¿Cómo subir este nuevo archivo a GitHub?
Una vez que hayas creado y guardado el archivo `README.md` en tu servidor Linux, corre estos comandos para que aparezca en tu página de GitHub:

1.  `git add README.md`
2.  `git commit -m "Añadido README detallado"`
3.  `git push`

**¿Te gustaría que te ayude a crear también el archivo `config.example.js` para que la gente sepa exac
