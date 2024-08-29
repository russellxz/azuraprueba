import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';

async function connectToWhatsApp () {
    const sock = makeWASocket({
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if(shouldReconnect) {
                connectToWhatsApp();
            }
        } else if(connection === 'open') {
            console.log('opened connection');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        console.log(JSON.stringify(m, undefined, 2));

        console.log('replying to', m.messages[0].key.remoteJid);
        await sock.sendMessage(m.messages[0].key.remoteJid!, { text: 'Hello there!' });
    });
}

// Iniciar la conexión
connectToWhatsApp();