require('dotenv').config();
const { get } = require('axios');
const { env } = process;
const { last, sortBy, differenceBy, flow, map, partition, isEqual } = require('lodash/fp');

const socket = require('socket.io')(createServer().listen(env.PORT));

const URL = `http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${env.LM_USER}&api_key=${env.LM_KEY}&format=json`;
let recentTracks = [];
let nowPlaying;

fetchTracks();
setInterval(fetchTracks, 10000);

socket.on('connection', onConnect);

function createServer() {
    if (env.CERT && env.CERT_KEY) {
        const httpsOpts = {
            key: env.CERT_KEY && fs.readFileSync(env.CERT_KEY),
            cert: env.CERT && fs.readFileSync(env.CERT)
        };
        return require('https').createServer(httpsOpts);
    } else {
        return require('http').createServer();
    }

}

function fetchTracks() {
    get(URL)
        .then(getTracksFromResponse)
        .then(convertTracks)
        .then(saveAndEmit)
        .catch(error => console.error(error));
}

function getTracksFromResponse({ data }) {
    return data.recenttracks.track;
}

function convertTracks(tracks) {
    const [ currentTracks, [ currentPlaying ] ] = flow(
        map(convertTrack),
        sortBy('date'),
        partition('date')
    )(tracks);

    return { currentTracks, currentPlaying };
}

function convertTrack(track) {
    return {
        artist: track.artist['#text'],
        title: track.name,
        album: track.album['#text'],
        cover: last(track.image)['#text'],
        date: track.date && parseInt(track.date.uts) * 1000
    };
}

function saveAndEmit({ currentTracks, currentPlaying }) {
    const newTracks = differenceBy(track => track.date)(currentTracks, recentTracks);

    if (newTracks.length) {
        socket.emit('tracks', newTracks);
    }

    if (!isEqual(currentPlaying, nowPlaying)) {
        socket.emit('now', currentPlaying);
    }

    recentTracks = currentTracks;
    nowPlaying = currentPlaying;
}

function onConnect(clientSocket) {
    clientSocket.emit('tracks', recentTracks);
    clientSocket.emit('now', nowPlaying);
}
