const { 
    default: makeWASocket, 
    Browsers, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    PHONENUMBER_MCC,
    DisconnectReason
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
    toggleAntieliminarCommand, 
    handleDelete, 
    storeMessage
} = require('./comandos');
const { deleteStickerCommand } = require('./2.0');


const config = require('./config.json');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let sock;  // Declarar sock globalmente
const messageStore = new Map();  // Almacenamiento temporal de mensajes

async function startBot() { 
    const { state, saveCreds } = await useMultiFileAuthState('./sessions');
    const { version } = await fetchLatestBaileysVersion();
    const msgRetryCounterCache = new NodeCache();

    let opcion;

    if (!fs.existsSync(`./sessions/creds.json`)) {
        // Configuración y selección de método de vinculación
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

            sock = makeWASocket({
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                auth: state,
                browser: Browsers.ubuntu("Chrome"),
                version: version,
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                msgRetryCounterCache,
                defaultQueryTimeoutMs: undefined
            });

            sock.ev.on('creds.update', saveCreds);

            setTimeout(async () => {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(chalk.black(chalk.bgGreen(`Tu código de emparejamiento : `)), chalk.black(chalk.white(code)));
            }, 3000);

        } else if (opcion === '1') {
            sock = makeWASocket({
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

            sock.ev.on('creds.update', saveCreds);
        } else {
            console.log(chalk.bold.redBright(`Opción no válida. Debe ingresar '1' o '2'.`));
            process.exit(0);
        }
    } else {
        sock = makeWASocket({
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

        sock.ev.on('creds.update', saveCreds);
    }

    // Configurar los eventos después de que sock esté listo
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada', lastDisconnect.error);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log(chalk.green('Conectado exitosamente'));

            // Mostrar el texto "AZURABOT CONECTADA CON ÉXITO" en grande y con colores
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

    // Escucha los mensajes y aplica los comandos
    sock.ev.on('messages.upsert', async (m) => { 
        const message = m.messages[0];
        if (!message.message || message.key.fromMe) return;

        const text = message.message.conversation || message.message.extendedTextMessage?.text;
    
 
        // Comando para activar/desactivar antieliminar
        if (text && text.toLowerCase().startsWith('.cojer ')) {
            const state = text.split(' ')[1];
            await toggleAntieliminarCommand(sock, message, state);
            return;
        } 



        // Comando para guardar multimedia
        if (text && text.toLowerCase().startsWith('.guar ')) {
            const keyword = text.split(' ')[1];
            if (keyword) {
                await guardarMediaCommand(sock, message, keyword);
            } else {
                await sock.sendMessage(message.key.remoteJid, { text: 'Por favor, proporciona una palabra clave después de "guar".' });
            }
            return;
        }

        // Comando para enviar multimedia basado en una palabra clave
        if (text && loadMediaDatabase()[text]) {
            await enviarMediaCommand(sock, message);
            return;
        }

        // Comando para eliminar multimedia guardado
        if (text && text.toLowerCase().startsWith('.eli ')) {
            const keyword = text.split(' ')[1];
            if (keyword) {
                await eliminarMediaCommand(sock, message, keyword);
            } else {
                await sock.sendMessage(message.key.remoteJid, { text: 'Por favor, proporciona una palabra clave después de ".eli".' });
            }
            return;
        }

        // Comandos de abrir y cerrar grupos
        if (text && text.toLowerCase() === '.cerrar grupo') {
            await cerrarGrupoCommand(sock, message);
            return;
        }

        if (text && text.toLowerCase() === '.abrir grupo') {
            await abrirGrupoCommand(sock, message);
            return;
        }

        // Comando para crear y enviar un sticker
        if (text && text.toLowerCase() === '.s') {
            await crearStickerCommand(sock, message);
            return;
        }

        // Manejar comandos asociados a stickers
        if (message.message.stickerMessage) {
            await handleStickerCommand(sock, message);
            return;
        }

        // Comando para agregar un comando a un sticker
        if (text && text.toLowerCase().startsWith('.add ')) {
            const commandText = text.split(' ').slice(1).join(' '); // Obtiene el comando a agregar
            if (commandText) {
                await addStickerCommand(sock, message, commandText);
            } else {
                await sock.sendMessage(message.key.remoteJid, { text: 'Por favor, proporciona un comando después de ".add".' });
            }
            return;
        }


            // Comando para eliminar un comando de sticker
if (text && text.toLowerCase() === '.z') {
    await deleteStickerCommand(sock, message);
    return;
}
        // Guardar el mensaje en el almacenamiento temporal
        await storeMessage(message);
    });


    // Escuchar los mensajes eliminados
    sock.ev.on('messages.revoke', async (m) => {
        const message = m.messages[0];
        await handleDelete(sock, message);
    });
}
   


// Iniciar el bot
startBot();
