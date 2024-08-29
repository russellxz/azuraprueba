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

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./sessions');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (text) => new Promise((resolve) => rl.question(text, resolve));

    const { version } = await fetchLatestBaileysVersion();
    const msgRetryCounterCache = new NodeCache();

    const methodCodeQR = process.argv.includes("qr");
    const methodCode = process.argv.includes("code");
    const useMobile = process.argv.includes("--mobile");

    let opcion = methodCodeQR ? '1' : (methodCode ? '2' : null);

    if (!opcion) {
        opcion = await question(`Selecciona una opción para conectar:\n1. Código QR\n2. Código de 8 dígitos\n`);
        if (!/^[1-2]$/.test(opcion)) {
            console.log(chalk.bold.red("Opción inválida. Selecciona 1 o 2."));
            process.exit(1);
        }
    }

    const socketSettings = {
        logger: pino({ level: 'debug' }),
        printQRInTerminal: opcion === '1',
        auth: { creds: state.creds, keys: state.keys },
        mobile: useMobile,
        browser: Browsers.ubuntu("Chrome"),
        version,
        msgRetryCounterCache,
        getMessage: async (key) => {
            const msg = await store.loadMessage(key.remoteJid, key.id);
            return msg || proto.Message.fromObject({});
        },
    };

    const sock = makeWASocket(socketSettings);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada', lastDisconnect.error);
            if (shouldReconnect) {
                startBot(); // Reintentar la conexión
            }
        } else if (connection === 'open') {
            console.log('Conectado exitosamente');
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
