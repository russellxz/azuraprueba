const { 
    default: makeWASocket, 
    Browsers, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    proto, 
    PHONENUMBER_MCC,
    DisconnectReason,
    msgRetryCounterMap
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const NodeCache = require('node-cache');
const chalk = require('chalk');
const readline = require("readline");
const figlet = require("figlet"); // Para el texto grande
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath('C:\\ffmpegbin\\ffmpeg.exe');
const { 
    stickerCommand, 
    cerrarGrupoCommand, 
    abrirGrupoCommand, 
    guardarMediaCommand, 
    enviarMediaCommand, 
    eliminarMediaCommand,
    loadMediaDatabase 
} = require('./comandos');

const config = require('./config.json');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const useMobile = process.argv.includes("--mobile");

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
┋ ${chalk.blueBright('┋')} ${chalk.green.bgMagenta.bold.yellow('¿CÓMO DESEA CONECTARSE?')}
┋ ${chalk.blueBright('┋')} ${chalk.bold.redBright('⇢  Opción 1:')} ${chalk.greenBright('Código QR.')}
┋ ${chalk.blueBright('┋')} ${chalk.bold.redBright('⇢  Opción 2:')} ${chalk.greenBright('Código de 8 dígitos.')}
┋ ${chalk.blueBright('┗┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅')}
┋ ${chalk.blueBright('┏┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅')}     
┋ ${chalk.blueBright('┋')} ${chalk.italic.magenta('Escriba sólo el número de')}
┋ ${chalk.blueBright('┋')} ${chalk.italic.magenta('la opción para conectarse.')}
┋ ${chalk.blueBright('┗┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅')}
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

            global.sock = makeWASocket({
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
            global.sock = makeWASocket({
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
        global.sock = makeWASocket({
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
                    figlet.textSync('AZURABOT', { horizontalLayout: 'full' })
                )
            );
            console.log(
                chalk.red(
                    figlet.textSync('CONECTADA', { horizontalLayout: 'full' })
                )
            );
            console.log(
                chalk.green(
                    figlet.textSync('CON ÉXITO', { horizontalLayout: 'full' })
                )
            );
        }
    });

    // Escucha los mensajes y aplica los comandos
    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.message || message.key.fromMe) return;
    
        const text = message.message.conversation || message.message.extendedTextMessage?.text;

        // Comando para guardar multimedia
        if (text && text.toLowerCase().startsWith('.guar ')) {  // Corregir aquí
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
            return;  
            
            // Salir para evitar que otros comandos procesen el mismo mensaje
        }
    
        // Comando para eliminar multimedia guardado
        if (text && text.toLowerCase().startsWith('.eli ')) {
            const keyword = text.split(' ')[1];
            if (keyword) {
                await eliminarMediaCommand(sock, message, keyword);  // Elimina el multimedia con la palabra clave
            } else {
                await sock.sendMessage(message.key.remoteJid, { text: 'Por favor, proporciona una palabra clave después de ".eli".' });
            }
            return;  // Salir para evitar conflictos con otros comandos
        }

        // Comandos de abrir y cerrar grupos
        if (text && text.toLowerCase() === '.cerrar grupo') {
            await cerrarGrupoCommand(sock, message);  // Llama al comando para cerrar el grupo
            return; 
        }

        if (text && text.toLowerCase() === '.abrir grupo') {
            await abrirGrupoCommand(sock, message);  // Llama al comando para abrir el grupo
            return;
        }

        // Comando para crear stickers
        if (text && text.toLowerCase() === '.s') {
            await stickerCommand(sock, message);  // Llama al comando de creación de sticker
            return;
        }
    });
}

// Iniciar el bot
startBot();
