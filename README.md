# 8b8tCoreBot

Este repositorio contiene el núcleo de un bot avanzado para el servidor de Minecraft **8b8t**, desarrollado en **Node.js**. El sistema integra funciones de juego, administración y una conexión robusta con Discord.

---

## 📂 Estructura del Proyecto

A continuación se detalla la función de cada directorio y archivo principal para facilitar su mantenimiento:

### Carpetas Principales
* **`minecraft/`**: Contiene el motor principal basado en `mineflayer`. Gestiona el movimiento, el desove (spawn), la lectura del chat del juego y la ejecución de comandos *in-game*.
* **`discord/`**: Alberga la configuración de `discord.js`. Se encarga de enviar mensajes del servidor de Minecraft a Discord y de permitir que los administradores controlen el bot desde canales específicos.
* **`ban/`**: Sistema de gestión de seguridad. Controla la lista negra de usuarios y los permisos de acceso a las funciones del bot.
* **`data/`**: Carpeta de almacenamiento persistente. Aquí se guardan los archivos JSON que contienen registros de coordenadas, usuarios vinculados y bases de datos locales.
* **`joindate/`**: Módulo de análisis de datos. Utiliza scripts de Python para procesar fechas de ingreso y generar reportes detallados en formato PDF.
* **`dupe/`**: Contiene módulos específicos para la automatización de mecánicas de duplicación y tareas técnicas dentro del servidor.
* **`logs/`**: Gestiona el historial de eventos del bot para facilitar la depuración de errores.
* **`messaging/`**: Controlador central de mensajes que clasifica y dirige el flujo de texto entre el juego y la interfaz del bot.
* **`utils/`**: Funciones auxiliares para el manejo de almacenamiento, formateo de texto y tareas repetitivas de programación.

### Archivos de Raíz
* **`index.js`**: El archivo maestro. Inicia y coordina todos los módulos mencionados anteriormente.
* **`setup_venv.sh`**: Script de bash para configurar el entorno virtual de Python necesario para las gráficas y métricas.
* **`.gitignore`**: Archivo de configuración que impide que tus claves privadas (`config.js`) se suban a GitHub.

---

## 🚀 Instalación en Linux

Sigue estos pasos en tu terminal para desplegar el bot:

### 1. Clonar el repositorio
```bash
git clone [https://github.com/endermitedetemu/8b8tCoreBot.git](https://github.com/endermitedetemu/8b8tCoreBot.git)
cd 8b8tCoreBot
2. Instalar dependencias
Instala los paquetes de Node.js necesarios (Mineflayer, Discord.js, etc.):

Bash

npm install
3. Configuración de Credenciales
IMPORTANTE: El archivo config.js no existe en GitHub por seguridad. Debes crearlo en la carpeta raíz:

Bash

nano config.js
Pega el siguiente contenido y rellena con tus datos:

JavaScript

module.exports = {
    minecraft: {
        host: '8b8t.me',
        username: 'tu_correo@ejemplo.com',
        password: 'tu_password',
        version: '1.12.2'
    },
    discord: {
        token: 'TOKEN_DE_TU_BOT',
        channelId: 'ID_DEL_CANAL'
    }
};
4. Entorno de Python (Opcional)
Si usarás las funciones de gráficas de la carpeta joindate:

Bash

chmod +x setup_venv.sh
./setup_venv.sh
🛠️ Uso y Actualización
Para iniciar el bot: node index.js

Para subir cambios a GitHub:

git add .

git commit -m "Descripción del cambio"

git push

Desarrollado por endermitedetemu.
