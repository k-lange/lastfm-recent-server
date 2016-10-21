require('dotenv').config();
const { get } = require('axios');
const { last, sortBy, differenceBy, compact, flow, map } = require('lodash/fp');
const socket = require('socket.io')(process.env.PORT);

const URL = `http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${process.env.LM_USER}&api_key=${process.env.LM_KEY}&format=json`;
let recentTracks = [];

fetchTracks();
setInterval(fetchTracks, 10000);

socket.on('connection', onConnect);

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
    return flow(
        map(convertTrack),
        compact,
        sortBy('date')
    )(tracks);
}

function convertTrack(track) {
    if (!track.date) { return; }

    return {
        artist: track.artist['#text'],
        title: track.name,
        album: track.album['#text'],
        cover: last(track.image)['#text'],
        date: parseInt(track.date.uts) * 1000
    };
}

function saveAndEmit(tracks) {
    const newTracks = differenceBy(track => track.date)(tracks, recentTracks);
    if (newTracks.length) {
        socket.emit('tracks', newTracks);
    }
    recentTracks = tracks;
}

function onConnect(clientSocket) {
    clientSocket.emit('tracks', recentTracks);
}
