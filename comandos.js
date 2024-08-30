const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');


// Función para crear stickers
async function stickerCommand(sock, message) {
    try {
        const quotedMessage = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMessage) {
            const mediaType = Object.keys(quotedMessage)[0];
            if (mediaType === 'imageMessage' || mediaType === 'videoMessage') {
                const stream = await downloadContentFromMessage(quotedMessage[mediaType], mediaType.split('M')[0]);
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                let stickerBuffer;

                if (mediaType === 'imageMessage') {
                    stickerBuffer = await sharp(buffer)
                        .resize(512, 512, { fit: 'inside' })
                        .webp({ lossless: true })
                        .toBuffer();
                } else if (mediaType === 'videoMessage') {
                    const tempFilePath = path.join(tmpdir(), `${message.key.id}.mp4`);
                    fs.writeFileSync(tempFilePath, buffer);

                    const outputWebp = path.join(tmpdir(), `${message.key.id}.webp`);

                    await new Promise((resolve, reject) => {
                        ffmpeg(tempFilePath)
                            .outputOptions([
                                '-vcodec', 'libwebp',
                                '-vf', 'scale=512:512:force_original_aspect_ratio=increase,fps=10,format=rgba,pad=512:512:-1:-1:color=00000000',
                                '-loop', '0',
                                '-ss', '00:00:00.0',
                                '-t', '00:00:05.0',
                                '-preset', 'default',
                                '-an', '-vsync', '0'
                            ])
                            .on('error', reject)
                            .on('end', resolve)
                            .save(outputWebp);
                    });

                    stickerBuffer = fs.readFileSync(outputWebp);

                    fs.unlinkSync(tempFilePath);
                    fs.unlinkSync(outputWebp);
                }

                await sock.sendMessage(message.key.remoteJid, {
                    sticker: stickerBuffer,
                    mimetype: 'image/webp',
                    caption: 'CREADO POR AZURABOT.DM',
                });
                await sock.sendMessage(message.key.remoteJid, { text: '¡Sticker creado con éxito!' });
            } else {
                await sock.sendMessage(message.key.remoteJid, { text: 'Por favor, responde a una imagen, video o GIF para convertirlo en un sticker.' });
            }
        } else {
            await sock.sendMessage(message.key.remoteJid, { text: 'Por favor, responde a una imagen, video o GIF con .s para convertirlo en un sticker.' });
        }
    } catch (error) {
        console.error('Error creando el sticker:', error);
        await sock.sendMessage(message.key.remoteJid, { text: 'Hubo un error al crear el sticker.' });
    }
}

// Funciones para cerrar y abrir el grupo
async function cerrarGrupoCommand(sock, message) {
    const chatId = message.key.remoteJid;
    try {
        await sock.groupSettingUpdate(chatId, 'announcement');
        await sock.sendMessage(chatId, { text: '🔒 El grupo ha sido cerrado. Solo los administradores pueden enviar mensajes.' });
    } catch (error) {
        console.error('Error cerrando el grupo:', error);
        await sock.sendMessage(chatId, { text: '❌ No se pudo cerrar el grupo.' });
    }
}

async function abrirGrupoCommand(sock, message) {
    const chatId = message.key.remoteJid;
    try {
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        await sock.sendMessage(chatId, { text: '🔓 El grupo ha sido abierto. Todos los miembros pueden enviar mensajes.' });
    } catch (error) {
        console.error('Error abriendo el grupo:', error);
        await sock.sendMessage(chatId, { text: '❌ No se pudo abrir el grupo.' });
    }
}

// Funciones para manejar la base de datos de multimedia
function loadMediaDatabase() {
    const mediaDatabasePath = path.join(__dirname, 'mediaDatabase.json');
    if (!fs.existsSync(mediaDatabasePath)) {
        fs.writeFileSync(mediaDatabasePath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(mediaDatabasePath));
}

function saveMediaDatabase(data) {
    const mediaDatabasePath = path.join(__dirname, 'mediaDatabase.json');
    fs.writeFileSync(mediaDatabasePath, JSON.stringify(data, null, 2));
}

// Función para convertir notas de voz a MP3
function convertirAudioMP3(buffer, outputPath) {
    return new Promise((resolve, reject) => {
        const inputPath = path.join(tmpdir(), `temp.ogg`);
        fs.writeFileSync(inputPath, buffer);

        ffmpeg(inputPath)
            .toFormat('mp3')
            .on('end', () => {
                fs.unlinkSync(inputPath); // Elimina el archivo temporal
                resolve(outputPath);
            })
            .on('error', (err) => {
                fs.unlinkSync(inputPath); // Elimina el archivo temporal
                reject(err);
            })
            .save(outputPath);
    });
}

// Comando para guardar multimedia
async function guardarMediaCommand(sock, message, keyword) {
    try {
        const quotedMessage = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMessage) {
            const mediaType = Object.keys(quotedMessage)[0];
            const stream = await downloadContentFromMessage(quotedMessage[mediaType], mediaType.split('M')[0]);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            let filePath;
            if (mediaType.includes('audio')) {
                filePath = path.join(tmpdir(), `${keyword}.mp3`);
                await convertirAudioMP3(buffer, filePath); // Convertir a MP3
            } else {
                const fileExtension = mediaType.includes('image') ? 'jpg' : mediaType.includes('video') ? 'mp4' : 'webp';
                filePath = path.join(tmpdir(), `${keyword}.${fileExtension}`);
                fs.writeFileSync(filePath, buffer);
            }

            const mediaDatabase = loadMediaDatabase();
            mediaDatabase[keyword] = filePath;
            saveMediaDatabase(mediaDatabase);

            await sock.sendMessage(message.key.remoteJid, { text: `¡Multimedia guardado con la palabra clave "${keyword}"!` });
        } else {
            await sock.sendMessage(message.key.remoteJid, { text: 'Por favor, responde a un archivo multimedia para guardarlo con una palabra clave.' });
        }
    } catch (error) {
        console.error('Error guardando multimedia:', error);
        await sock.sendMessage(message.key.remoteJid, { text: 'Hubo un error al guardar el multimedia.' });
    }
}

// Comando para enviar multimedia
async function enviarMediaCommand(sock, message) {
    try {
        const text = message.message.conversation || message.message.extendedTextMessage?.text;
        const mediaDatabase = loadMediaDatabase();

        if (mediaDatabase[text]) {
            const filePath = mediaDatabase[text];
            const buffer = fs.readFileSync(filePath);
            const fileExtension = path.extname(filePath).substring(1);

            let messageOptions = {};
            if (fileExtension === 'jpg') {
                messageOptions.image = buffer;
            } else if (fileExtension === 'mp4') {
                messageOptions.video = buffer;
            } else if (fileExtension === 'webp') {
                messageOptions.sticker = buffer;
            } else if (fileExtension === 'mp3') {
                messageOptions.audio = buffer;
                messageOptions.mimetype = 'audio/mp3';
            }

            await sock.sendMessage(message.key.remoteJid, messageOptions);
        } else {
            await sock.sendMessage(message.key.remoteJid, { text: 'No se encontró ningún multimedia guardado con esa palabra clave.' });
        }
    } catch (error) {
        console.error('Error enviando multimedia:', error);
        await sock.sendMessage(message.key.remoteJid, { text: 'Hubo un error al enviar el multimedia.' });
    }
}

// Comando para eliminar multimedia guardado
async function eliminarMediaCommand(sock, message, keyword) {
    try {
        const mediaDatabase = loadMediaDatabase();

        if (mediaDatabase[keyword]) {
            fs.unlinkSync(mediaDatabase[keyword]); // Elimina el archivo guardado
            delete mediaDatabase[keyword]; // Elimina la entrada de la base de datos
            saveMediaDatabase(mediaDatabase);
            await sock.sendMessage(message.key.remoteJid, { text: `¡Multimedia asociado con la palabra clave "${keyword}" ha sido eliminado!` });
        } else {
            await sock.sendMessage(message.key.remoteJid, { text: 'No se encontró ningún multimedia guardado con esa palabra clave.' });
        }
    } catch (error) {
        console.error('Error eliminando multimedia:', error);
        await sock.sendMessage(message.key.remoteJid, { text: 'Hubo un error al eliminar el multimedia.' });
    }
}


module.exports = {
    stickerCommand,
    cerrarGrupoCommand,
    abrirGrupoCommand,
    guardarMediaCommand,
    enviarMediaCommand,
    eliminarMediaCommand, // Asegúrate de exportar este comando
    loadMediaDatabase,
    saveMediaDatabase
};
