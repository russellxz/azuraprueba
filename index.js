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
const pairingCode = !!config.pairing.number || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

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
            mobile: useMobile,
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

    if (config["pairing"].state && pairingCode && !sock.authState.creds.registered) {
        if (useMobile) throw new Error('No se puede usar el código de emparejamiento con la API móvil.');
        let phoneNumber;
        if (!!config.pairing.number) {
           phoneNumber = config.pairing.number.toString();
           if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
              console.log(chalk.bgBlack(chalk.redBright("Ingrese un número válido en el archivo 'config.json' en la sección: [pairing > number], para vincular su cuenta usando un código de emparejamiento. Ejemplo: 5076xxxxxxx.")));
              process.exit(0);
           }
        }
        setTimeout(async () => {
           let code = await sock.requestPairingCode(config.pairing.number);
           code = code?.match(/.{1,4}/g)?.join("-") || code;
           console.log(chalk.black(chalk.bgGreen(`Tu código de emparejamiento : `)), chalk.black(chalk.white(code)));
        }, 3000);
    }
    
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
    })
}

// Iniciar el bot
startBot();
