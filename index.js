require('dotenv').config();
const { get } = require('axios');
const { last, sortBy, differenceBy, flow, map, partition, isEqual } = require('lodash/fp');
const socket = require('socket.io')(process.env.PORT);

const URL = `http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${process.env.LM_USER}&api_key=${process.env.LM_KEY}&format=json`;
let recentTracks = [];
let nowPlaying;

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
    const [ currentTracks, currentPlaying ] = flow(
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
