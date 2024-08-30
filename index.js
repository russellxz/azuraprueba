const { 
    default: makeWASocket, 
    Browsers, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    proto, 
    DisconnectReason 
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const NodeCache = require('node-cache');
const chalk = require('chalk');
const readline = require("readline");
const fs = require('fs');
const path = require('path');
const { 
    stickerCommand, 
    cerrarGrupoCommand, 
    abrirGrupoCommand, 
    guardarMediaCommand, 
    enviarMediaCommand,
    loadMediaDatabase
} = require('./comandos');

const config = require('./config.json');
const pairingCode = !!config.pairing.number;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./sessions');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (text) => new Promise((resolve) => rl.question(text, resolve));

    const { version } = await fetchLatestBaileysVersion();
    const msgRetryCounterCache = new NodeCache();

    global.sock = makeWASocket({
      ...(config["pairing"].state
         ? {
            logger: pino({ level: "fatal" }).child({ level: "fatal" }),
            printQRInTerminal: !pairingCode,
            mobile: '--mobile',
            auth: state,
            browser: Browsers.ubuntu("Chrome"),
            version: version,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            msgRetryCounterCache,
            defaultQueryTimeoutMs: undefined
         } : {
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            markOnlineOnConnect: true,
            defaultQueryTimeoutMs: undefined,
            msgRetryCounterMap,
            browser: Browsers.ubuntu("Chrome"),
            auth: state,
            version: version
         }),
    });

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada', lastDisconnect.error);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Conectado exitosamente');
        }
    });

    // Escucha los mensajes y aplica los comandos
    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.message || message.key.fromMe) return;

        const text = message.message.conversation || message.message.extendedTextMessage?.text;

        // Priorizar la creación de stickers
        if (text && text.toLowerCase() === '.s') {
            await stickerCommand(sock, message);  // Llama al comando de creación de sticker
            return;  // Salir para evitar que otros comandos intenten procesar el mismo mensaje
        }

        // Comando para guardar multimedia
        if (text && text.toLowerCase().startsWith('guar ')) {
            const keyword = text.split(' ')[1];
            if (keyword) {
                await guardarMediaCommand(sock, message, keyword);  // Guarda el multimedia con la palabra clave
            } else {
                await sock.sendMessage(message.key.remoteJid, { text: 'Por favor, proporciona una palabra clave después de "guar".' });
            }
            return;  // Salir para evitar conflictos con el envío de multimedia
        }

        // Comando para enviar multimedia basado en una palabra clave
        if (text && loadMediaDatabase()[text]) {
            await enviarMediaCommand(sock, message);  // Envía el multimedia basado en la palabra clave
        }

        // Comandos de abrir y cerrar grupos
        if (text && text.toLowerCase() === 'cerrar grupo') {
            await cerrarGrupoCommand(sock, message);  // Llama al comando para cerrar el grupo
        }

        if (text && text.toLowerCase() === 'abrir grupo') {
            await abrirGrupoCommand(sock, message);  // Llama al comando para abrir el grupo
        }
    });

    if (opcion === '2' && !sock.authState.creds.registered) {
        let phoneNumber = await question(chalk.green("Ingresa el número de teléfono: "));
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        const codeBot = await sock.requestPairingCode(phoneNumber);
        console.log(chalk.bold.white(`Código de vinculación: ${codeBot}`));
    }

    rl.close();
}

// Iniciar el bot
startBot();
