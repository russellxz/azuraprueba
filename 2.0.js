const path = require('path');
const fs = require('fs');

const stickerCommandsPath = path.join(__dirname, 'stickerCommands.json');

function loadStickerCommands() {
    if (!fs.existsSync(stickerCommandsPath)) {
        fs.writeFileSync(stickerCommandsPath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(stickerCommandsPath));
}

function saveStickerCommands(data) {
    fs.writeFileSync(stickerCommandsPath, JSON.stringify(data, null, 2));
}

async function addStickerCommand(client, message, commandText) {
    try {
        const quotedMessage = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMessage && quotedMessage.stickerMessage) {
            const stickerId = quotedMessage.stickerMessage.fileSha256?.toString('base64');

            if (!stickerId) {
                console.error('No se pudo obtener el ID del sticker');
                await client.sendMessage(message.key.remoteJid, { text: 'No se pudo obtener el ID del sticker. Intente nuevamente.' });
                return;
            }

            const stickerCommands = loadStickerCommands();
            stickerCommands[stickerId] = commandText;
            saveStickerCommands(stickerCommands);

            await client.sendMessage(message.key.remoteJid, { text: `Comando "${commandText}" ha sido agregado al sticker.` });
        } else {
            await client.sendMessage(message.key.remoteJid, { text: 'Por favor, responda a un sticker con el comando que desea agregar.' });
        }
    } catch (error) {
        console.error('Error en addStickerCommand:', error);
        await client.sendMessage(message.key.remoteJid, { text: 'Ocurrió un error al intentar agregar el comando al sticker.' });
    }
}

async function deleteStickerCommand(client, message) {
    try {
        const quotedMessage = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMessage && quotedMessage.stickerMessage) {
            const stickerId = quotedMessage.stickerMessage.fileSha256?.toString('base64');

            if (!stickerId) {
                console.error('No se pudo obtener el ID del sticker');
                await client.sendMessage(message.key.remoteJid, { text: 'No se pudo obtener el ID del sticker. Intente nuevamente.' });
                return;
            }

            const stickerCommands = loadStickerCommands();

            if (stickerCommands[stickerId]) {
                delete stickerCommands[stickerId];
                saveStickerCommands(stickerCommands);
                await client.sendMessage(message.key.remoteJid, { text: 'Su comando ha sido eliminado con éxito del sticker.' });
            } else {
                await client.sendMessage(message.key.remoteJid, { text: 'No hay comando asociado a este sticker.' });
            }
        } else {
            await client.sendMessage(message.key.remoteJid, { text: 'Por favor, responda a un sticker con el comando que desea eliminar.' });
        }
    } catch (error) {
        console.error('Error en deleteStickerCommand:', error);
        await client.sendMessage(message.key.remoteJid, { text: 'Ocurrió un error al intentar eliminar el comando del sticker.' });
    }
}

async function handleStickerCommand(client, message) {
    try {
        if (message.message?.stickerMessage) {
            const stickerId = message.message.stickerMessage.fileSha256?.toString('base64');

            if (!stickerId) {
                console.error('No se pudo obtener el ID del sticker');
                await client.sendMessage(message.key.remoteJid, { text: 'No se pudo obtener el ID del sticker. Intente nuevamente.' });
                return;
            }

            const stickerCommands = loadStickerCommands();

            if (stickerCommands[stickerId]) {
                const commandText = stickerCommands[stickerId];
                // Aquí puedes ejecutar el comando correspondiente
                switch (commandText.toLowerCase()) {
                    case 'abrir grupo':
                        await abrirGrupoCommand(client, message);
                        break;
                    case 'cerrar grupo':
                        await cerrarGrupoCommand(client, message);
                        break;
                    default:
                        await client.sendMessage(message.key.remoteJid, { text: `Ejecutando comando asociado: "${commandText}".` });
                        break;
                }
            } else {
                await client.sendMessage(message.key.remoteJid, { text: 'No hay comando asociado a este sticker.' });
            }
        }
    } catch (error) {
        console.error('Error en handleStickerCommand:', error);
        await client.sendMessage(message.key.remoteJid, { text: 'Ocurrió un error al intentar ejecutar el comando del sticker.' });
    }
}

module.exports = {
    loadStickerCommands,
    saveStickerCommands,
    addStickerCommand,
    deleteStickerCommand,
    handleStickerCommand,
};






