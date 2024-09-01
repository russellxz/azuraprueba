const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fg = require('api-dylux');
const { youtubedl, youtubedlv2 } = require('@bochilteam/scraper');

async function playAudio(message, text, conn) {
    if (!text) {
        return conn.sendMessage(message.key.remoteJid, { text: 'Proporcione un término de búsqueda para descargar audio.' }, { quoted: message });
    }
    const result = await yts(text);
    if (!result || result.videos.length === 0) {
        return conn.sendMessage(message.key.remoteJid, { text: 'No se encontraron resultados para esa búsqueda.' }, { quoted: message });
    }

    const video = result.videos[0];
    const yt = await youtubedl(video.url).catch(async () => await youtubedlv2(video.url));
    const dl_url = await yt.audio['128kbps'].download();
    
    await conn.sendMessage(message.key.remoteJid, { audio: { url: dl_url }, mimetype: 'audio/mpeg' }, { quoted: message });
}

async function playVideo(message, text, conn) {
    if (!text) {
        return conn.sendMessage(message.key.remoteJid, { text: 'Proporcione un término de búsqueda para descargar video.' }, { quoted: message });
    }
    const result = await yts(text);
    if (!result || result.videos.length === 0) {
        return conn.sendMessage(message.key.remoteJid, { text: 'No se encontraron resultados para esa búsqueda.' }, { quoted: message });
    }

    const video = result.videos[0];
    const yt = await youtubedl(video.url).catch(async () => await youtubedlv2(video.url));
    const dl_url = await yt.video['360p'].download();

    await conn.sendMessage(message.key.remoteJid, { video: { url: dl_url }, mimetype: 'video/mp4' }, { quoted: message });
}

module.exports = {
    playAudio,
    playVideo
};




