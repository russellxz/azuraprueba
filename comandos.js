const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const webp = require('node-webpmux');
const ffmpeg = require('fluent-ffmpeg');
const func = new (require('./waFunc')); // Asegúrate de que este archivo existe y tiene la función makeid.
const stickerCommandsPath = path.join(__dirname, 'stickerCommands.json');

ffmpeg.setFfmpegPath('C:\\Users\\perez\\Desktop\\AZURA2.0\\ffmpeg\\bin\\ffmpeg.exe');

// Otras importaciones y configuraciones aquí

function saveMediaDatabase(data) {
    const mediaDatabasePath = path.join(__dirname, 'mediaDatabase.json');
    fs.writeFileSync(mediaDatabasePath, JSON.stringify(data, null, 2));
}

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
    const quotedMessage = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quotedMessage && quotedMessage.stickerMessage) {
        const stickerId = quotedMessage.stickerMessage.fileSha256.toString('base64');

        const stickerCommands = loadStickerCommands();
        stickerCommands[stickerId] = commandText;

        saveStickerCommands(stickerCommands);

        console.log(`Comando ${commandText} agregado para el sticker con ID ${stickerId}`);
        await client.sendMessage(message.key.remoteJid, { text: 'Su comando fue agregado con éxito al sticker.' });
    } else {
        await client.sendMessage(message.key.remoteJid, { text: 'Por favor, responda a un sticker con el comando que desea agregar.' });
    }
}

async function handleStickerCommand(client, message) {
    const stickerId = message.message.stickerMessage.fileSha256.toString('base64');
    const stickerCommands = loadStickerCommands();

    console.log(`Buscando comando para el sticker con ID ${stickerId}`);

    if (stickerCommands[stickerId]) {
        const commandText = stickerCommands[stickerId];
        console.log(`Ejecutando comando ${commandText} para el sticker con ID ${stickerId}`);

        if (commandText.toLowerCase() === '.abrir grupo') {
            await abrirGrupoCommand(client, message);
        } else if (commandText.toLowerCase() === '.cerrar grupo') {
            await cerrarGrupoCommand(client, message);
        }
    }
}

async function imageToWebp(media) {
    const tmpFileOut = path.join(tmpdir(), `${func.makeid(10)}.webp`);
    const tmpFileIn = path.join(tmpdir(), `${func.makeid(10)}.jpg`);
    fs.writeFileSync(tmpFileIn, media);

    await new Promise((resolve, reject) => {
        ffmpeg(tmpFileIn)
            .on('start', function(commandLine) {
                console.log('Spawned Ffmpeg with command: ' + commandLine);
            })
            .on("error", function(err, stdout, stderr) {
                console.error('Error during processing:', err.message);
                console.error('ffmpeg stderr:', stderr);
                reject(new Error('Failed to create WebP image'));
            })
            .on("end", function(stdout, stderr) {
                console.log('Ffmpeg succeeded, stdout:', stdout);
                resolve(true);
            })
            .addOutputOptions([
                "-vcodec", "libwebp",
                "-vf", "scale=320:320:force_original_aspect_ratio=decrease"
            ])
            .toFormat("webp")
            .save(tmpFileOut);
    });

    if (!fs.existsSync(tmpFileOut) || fs.statSync(tmpFileOut).size === 0) {
        throw new Error('Failed to create WebP image');
    }

    const buff = fs.readFileSync(tmpFileOut);
    fs.unlinkSync(tmpFileOut);
    fs.unlinkSync(tmpFileIn);
    return buff;
}

async function videoToWebp(media) {
    const tmpFileOut = path.join(tmpdir(), `${func.makeid(10)}.webp`);
    const tmpFileIn = path.join(tmpdir(), `${func.makeid(10)}.mp4`);
    fs.writeFileSync(tmpFileIn, media);

    await new Promise((resolve, reject) => {
        ffmpeg(tmpFileIn)
            .on('start', function(commandLine) {
                console.log('Spawned Ffmpeg with command: ' + commandLine);
            })
            .on("error", reject)
            .on("end", () => resolve(true))
            .addOutputOptions([
                "-vcodec", "libwebp",
                "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white,split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
                "-loop", "0", "-ss", "00:00:00", "-t", "00:00:05",
                "-preset", "default", "-an", "-vsync", "0"
            ])
            .toFormat("webp")
            .save(tmpFileOut);
    });

    if (!fs.existsSync(tmpFileOut) || fs.statSync(tmpFileOut).size === 0) {
        throw new Error('Failed to create WebP video');
    }

    const buff = fs.readFileSync(tmpFileOut);
    fs.unlinkSync(tmpFileOut);
    fs.unlinkSync(tmpFileIn);
    return buff;
}

async function writeExifImg(media, metadata) {
    let wMedia = await imageToWebp(media);
    const tmpFileIn = path.join(tmpdir(), `${func.makeid(10)}.webp`);
    const tmpFileOut = path.join(tmpdir(), `${func.makeid(10)}.webp`);
    fs.writeFileSync(tmpFileIn, wMedia);

    if (metadata.packname || metadata.author) {
        const img = new webp.Image();
        const json = { "sticker-pack-id": '© node-bot', "sticker-pack-name": metadata.packname, "sticker-pack-publisher": metadata.author, "emojis": metadata.categories ? metadata.categories : [""] };
        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
        const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
        const exif = Buffer.concat([exifAttr, jsonBuff]);
        exif.writeUIntLE(jsonBuff.length, 14, 4);
        await img.load(tmpFileIn);
        fs.unlinkSync(tmpFileIn);
        img.exif = exif;
        await img.save(tmpFileOut);
        return tmpFileOut;
    }
}

async function writeExifVid(media, metadata) {
    let wMedia = await videoToWebp(media);
    const tmpFileIn = path.join(tmpdir(), `${func.makeid(10)}.webp`);
    const tmpFileOut = path.join(tmpdir(), `${func.makeid(10)}.webp`);
    fs.writeFileSync(tmpFileIn, wMedia);

    if (metadata.packname || metadata.author) {
        const img = new webp.Image();
        const json = { "sticker-pack-id": '© node-bot', "sticker-pack-name": metadata.packname, "sticker-pack-publisher": metadata.author, "emojis": metadata.categories ? metadata.categories : [""] };
        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
        const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
        const exif = Buffer.concat([exifAttr, jsonBuff]);
        exif.writeUIntLE(jsonBuff.length, 14, 4);
        await img.load(tmpFileIn);
        fs.unlinkSync(tmpFileIn);
        img.exif = exif;
        await img.save(tmpFileOut);
        return tmpFileOut;
    }
}

async function cerrarGrupoCommand(client, message) {
    const chatId = message.key.remoteJid;
    try {
        await client.groupSettingUpdate(chatId, 'announcement');
        await client.sendMessage(chatId, { text: '🔒 El grupo ha sido cerrado. Solo los administradores pueden enviar mensajes.' });
    } catch (error) {
        console.error('Error cerrando el grupo:', error);
        await client.sendMessage(chatId, { text: '❌ No se pudo cerrar el grupo.' });
    }
}

async function abrirGrupoCommand(client, message) {
    const chatId = message.key.remoteJid;
    try {
        await client.groupSettingUpdate(chatId, 'not_announcement');
        await client.sendMessage(chatId, { text: '🔓 El grupo ha sido abierto. Todos los miembros pueden enviar mensajes.' });
    } catch (error) {
        console.error('Error abriendo el grupo:', error);
        await client.sendMessage(chatId, { text: '❌ No se pudo abrir el grupo.' });
    }
}

function loadMediaDatabase() {
    const mediaDatabasePath = path.join(__dirname, 'mediaDatabase.json');
    if (!fs.existsSync(mediaDatabasePath)) {
        fs.writeFileSync(mediaDatabasePath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(mediaDatabasePath));
}

async function guardarMediaCommand(client, message, keyword) {
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
                filePath = path.join(tmpdir(), `${keyword}.opus`);
                fs.writeFileSync(filePath, buffer);
            } else {
                const fileExtension = mediaType.includes('image') ? 'jpg' : mediaType.includes('video') ? 'mp4' : 'webp';
                filePath = path.join(tmpdir(), `${keyword}.${fileExtension}`);
                fs.writeFileSync(filePath, buffer);
            }

            const mediaDatabase = loadMediaDatabase();
            mediaDatabase[keyword] = filePath;
            saveMediaDatabase(mediaDatabase);

            await client.sendMessage(message.key.remoteJid, { text: `¡Multimedia guardado con la palabra clave "${keyword}"!` });
        } else {
            await client.sendMessage(message.key.remoteJid, { text: 'Por favor, responde a un archivo multimedia para guardarlo con una palabra clave.' });
        }
    } catch (error) {
        console.error('Error guardando multimedia:', error);
        await client.sendMessage(message.key.remoteJid, { text: 'Hubo un error al guardar el multimedia.' });
    }
}

async function enviarMediaCommand(client, message) {
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
            } else if (fileExtension === 'opus') {
                messageOptions.audio = buffer;
                messageOptions.mimetype = 'audio/ogg; codecs=opus';
                messageOptions.ptt = true;
            }

            await client.sendMessage(message.key.remoteJid, messageOptions);
        } else {
            await client.sendMessage(message.key.remoteJid, { text: 'No se encontró ningún multimedia guardado con esa palabra clave.' });
        }
    } catch (error) {
        console.error('Error enviando multimedia:', error);
        await client.sendMessage(message.key.remoteJid, { text: 'Hubo un error al enviar el multimedia.' });
    }
}

async function eliminarMediaCommand(client, message, keyword) {
    try {
        const mediaDatabase = loadMediaDatabase();

        if (mediaDatabase[keyword]) {
            fs.unlinkSync(mediaDatabase[keyword]);
            delete mediaDatabase[keyword];
            saveMediaDatabase(mediaDatabase);
            await client.sendMessage(message.key.remoteJid, { text: `¡Multimedia asociado con la palabra clave "${keyword}" ha sido eliminado!` });
        } else {
            await client.sendMessage(message.key.remoteJid, { text: 'No se encontró ningún multimedia guardado con esa palabra clave.' });
        }
    } catch (error) {
        console.error('Error eliminando multimedia:', error);
        await client.sendMessage(message.key.remoteJid, { text: 'Hubo un error al eliminar el multimedia.' });
    }
}

async function crearStickerCommand(client, message) {
    const quotedMessage = message.message.extendedTextMessage?.contextInfo?.quotedMessage;

    if (quotedMessage) {
        const mediaType = Object.keys(quotedMessage)[0];
    
        if (mediaType.includes('image') || mediaType.includes('video')) {
            await client.sendMessage(message.key.remoteJid, { text: 'Por favor, espere. No haga spam mientras se procesa su solicitud.' }, { quoted: message });
        
            const stream = await downloadContentFromMessage(quotedMessage[mediaType], mediaType.split('M')[0]);
        
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            let stickerBuffer;
            if (mediaType.includes('image')) {
                stickerBuffer = await writeExifImg(buffer, { packname: 'Mi Paquete', author: 'Bot' });
            } else if (mediaType.includes('video')) {
                stickerBuffer = await writeExifVid(buffer, { packname: 'Mi Paquete', author: 'Bot' });
            }

            if (stickerBuffer) {
                await client.sendMessage(message.key.remoteJid, { sticker: { url: stickerBuffer } }, { quoted: message });
            } else {
                await client.sendMessage(message.key.remoteJid, { text: 'El archivo seleccionado no es válido para crear un sticker.' });
            }
        } else {
            await client.sendMessage(message.key.remoteJid, { text: 'Para crear un sticker, por favor responde a una imagen, video o GIF con el comando ".s".' });
        }
    } else {
        await client.sendMessage(message.key.remoteJid, { text: 'Para crear un sticker, por favor responde a una imagen, video o GIF con el comando ".s".' });
    }
}

module.exports = {
    cerrarGrupoCommand,
    abrirGrupoCommand,
    guardarMediaCommand,
    enviarMediaCommand,
    eliminarMediaCommand,
    loadMediaDatabase,
    saveMediaDatabase, 
    imageToWebp,
    videoToWebp,
    writeExifImg,
    writeExifVid,
    crearStickerCommand,
    addStickerCommand,
    handleStickerCommand,
    loadStickerCommands,
    saveStickerCommands,
};
