const {
    default: makeWASocket,
    Browsers,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    PHONENUMBER_MCC,
    DisconnectReason,
    proto
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const NodeCache = require('node-cache');
const readline = require("readline");
const figlet = require("figlet");
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const {
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
} = require('./comandos');
const { deleteStickerCommand } = require('./2.0');
const config = require('./config.json');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));
let client;
let antieliminarEnabled = false;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./sessions');
    const { version } = await fetchLatestBaileysVersion();
    const msgRetryCounterCache = new NodeCache();
    let opcion;

    if (!fs.existsSync(`./sessions/creds.json`)) {
        let lineM = '┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅';
        opcion = await question(`┏${lineM}
┋ ${chalk.blueBright('┏┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅')}
┋ ${chalk.blueBright('┋')} ${chalk.blue.bgBlue.bold.cyan('MÉTODO DE VINCULACIÓN')}
┋ ${chalk.blueBright('┗┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅')}
┋ ${chalk.blueBright('┏┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅')}
┋ ${chalk.green.bgMagenta.bold.yellow('¿CÓMO DESEA CONECTARSE?')}
┋ ${chalk.bold.redBright('⇢  Opción 1:')} ${chalk.greenBright('Código QR.')}
┋ ${chalk.bold.redBright('⇢  Opción 2:')} ${chalk.greenBright('Código de 8 dígitos.')}
┋ ${chalk.blueBright('┗┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅')}
┋ ${chalk.italic.magenta('Escriba sólo el número de')}
┋ ${chalk.italic.magenta('la opción para conectarse.')}
┗${lineM}\n${chalk.bold.magentaBright('---> ')}`);

        if (opcion === '2') {
            let phoneNumber = await question(`${chalk.bold.magentaBright('Por favor, ingrese su número de teléfono (con el código de país): ')}`);
            phoneNumber = phoneNumber.trim();

            if (!/^\d+$/.test(phoneNumber)) {
                console.log(chalk.bgBlack(chalk.redBright("Número de teléfono no válido. Asegúrese de ingresar solo números.")));
                process.exit(0);
            }

            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log(chalk.bgBlack(chalk.redBright("Ingrese un número válido con el código de país. Ejemplo: 5076xxxxxxx.")));
                process.exit(0);
            }

            config.pairing.number = phoneNumber;
            fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

            client = makeWASocket({
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                auth: state,
                browser: Browsers.ubuntu("Chrome"),
                version: version,
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                msgRetryCounterCache,
                defaultQueryTimeoutMs: undefined
            });

            client.ev.on('creds.update', saveCreds);

            setTimeout(async () => {
                let code = await client.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(chalk.black(chalk.bgGreen(`Tu código de emparejamiento : `)), chalk.black(chalk.white(code)));
            }, 3000);

        } else if (opcion === '1') {
            client = makeWASocket({
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                printQRInTerminal: true,
                auth: state,
                browser: Browsers.ubuntu("Chrome"),
                version: version,
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                msgRetryCounterCache,
                defaultQueryTimeoutMs: undefined
            });

            client.ev.on('creds.update', saveCreds);
        } else {
            console.log(chalk.bold.redBright(`Opción no válida. Debe ingresar '1' o '2'.`));
            process.exit(0);
        }
    } else {
        client = makeWASocket({
            logger: pino({ level: "fatal" }).child({ level: "fatal" }),
            printQRInTerminal: true,
            auth: state,
            browser: Browsers.ubuntu("Chrome"),
            version: version,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            msgRetryCounterCache,
            defaultQueryTimeoutMs: undefined
        });

        client.ev.on('creds.update', saveCreds);
    }

    client.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada', lastDisconnect.error);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log(chalk.green('Conectado exitosamente'));

            console.log(
                chalk.blue(
                    figlet.textSync('AZURABOT', { horizontalLayout: 'fitted' })
                )
            );
            console.log(
                chalk.red(
                    figlet.textSync('CONECTADA', { horizontalLayout: 'fitted' })
                )
            );
            console.log(
                chalk.green(
                    figlet.textSync('CON ÉXITO', { horizontalLayout: 'fitted' })
                )
            );
        }
    });

    client.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.message) return;
        const text = message.message.conversation || message.message.extendedTextMessage?.text;
        if (!text) return;
    
        if (text.toLowerCase() === '.cojer1 on') {
            antieliminarEnabled = true;
            await client.sendMessage(message.key.remoteJid, { text: 'Antieliminar activado.' });
            return;
        }
    
        if (text.toLowerCase() === '.cojer2 off') {
            antieliminarEnabled = false;
            await client.sendMessage(message.key.remoteJid, { text: 'Antieliminar desactivado.' });
            return;
        }
    
        if (message.message && message.message.protocolMessage && message.message.protocolMessage.type == 0 && !message.key.fromMe) {
            return client.ev.emit('message.delete', message.message.protocolMessage.key);
        }
    });
    
    client.ev.on('message.delete', async (m) => {
        if (!antieliminarEnabled) return;
    
        if (!m || !m.remoteJid) return;
        const group = global.mongo.groups.find(_ => _.jid == m.remoteJid.split('@')[0]);
        if (group !== undefined && group !== null && !group.nodelete) {
            return;
        }
        var copy = await global.store.loadMessage(m.remoteJid, m.id, client);
        var mention = copy?.mention ? copy.mention : null;
        var getMsg = proto.WebMessageInfo.fromObject({
            key: copy.key,
            message: {
                [copy.type]: copy.msg
            }
        });
        return client.sendMessage(copy.key.remoteJid, { text: 'Reenviando mensaje eliminado. 📡' }).then(async () => {
            await client.sendMessage(copy.key.remoteJid, { forward: getMsg, contextInfo: { mentionedJid: mention, isForwarded: true } });
        });
    });

    // Otros comandos aquí...
    client.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
    
        if (text && text.toLowerCase().startsWith('.guar ')) {
            const keyword = text.split(' ')[1];
            if (keyword) {
                await guardarMediaCommand(client, message, keyword);
            } else {
                await client.sendMessage(message.key.remoteJid, { text: 'Por favor, proporciona una palabra clave después de "guar".' });
            }
            return;
        }
    
        if (text && loadMediaDatabase()[text]) {
            await enviarMediaCommand(client, message);
            return;
        }
    
        if (text && text.toLowerCase().startsWith('.eli ')) {
            const keyword = text.split(' ')[1];
            if (keyword) {
                await eliminarMediaCommand(client, message, keyword);
            } else {
                await client.sendMessage(message.key.remoteJid, { text: 'Por favor, proporciona una palabra clave después de ".eli".' });
            }
            return;
        }
    
        if (text && text.toLowerCase() === '.cerrar grupo') {
            await cerrarGrupoCommand(client, message);
            return;
        }
    
        if (text && text.toLowerCase() === '.abrir grupo') {
            await abrirGrupoCommand(client, message);
            return;
        }
    
        if (text && text.toLowerCase() === '.s') {
            await crearStickerCommand(client, message);
            return;
        }
    
        if (message.message.stickerMessage) {
            await handleStickerCommand(client, message);
            return;
        }
    
        if (text && text.toLowerCase().startsWith('.add ')) {
            const commandText = text.split(' ').slice(1).join(' ');
            if (commandText) {
                await addStickerCommand(client, message, commandText);
            } else {
                await client.sendMessage(message.key.remoteJid, { text: 'Por favor, proporciona un comando después de ".add".' });
            }
            return;
        }
    
        if (text && text.toLowerCase() === '.z') {
            await deleteStickerCommand(client, message);
            return;
        }
    });
}

startBot();

