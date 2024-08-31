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

async function deleteStickerCommand(sock, message) {
    const quotedMessage = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quotedMessage && quotedMessage.stickerMessage) {
        const stickerId = quotedMessage.stickerMessage.fileSha256.toString('base64');

        const stickerCommands = loadStickerCommands();

        if (stickerCommands[stickerId]) {
            delete stickerCommands[stickerId];
            saveStickerCommands(stickerCommands);
            await sock.sendMessage(message.key.remoteJid, { text: 'Su comando ha sido eliminado con éxito del sticker.' });
        } else {
            await sock.sendMessage(message.key.remoteJid, { text: 'No hay comando asociado a este sticker.' });
        }
    } else {
        await sock.sendMessage(message.key.remoteJid, { text: 'Por favor, responda a un sticker con el comando que desea eliminar.' });
    }
}

module.exports = {
    deleteStickerCommand
};


