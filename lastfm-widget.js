(function() {
    'use strict';
    
    const LASTFM_USERNAME = 'minkurosu';
    const LASTFM_API_KEY = 'a2ef624a3dff8ec934580b0577d18cb5';

    async function fetchLastFmTrack() {
        console.log("[last.fm] searching for most recent track...");
        const lastfmSongCell = document.getElementById('lastfm-song-cell');

        if (!lastfmSongCell) {
            console.error("[last.fm] error");
            return;
        }
        console.log("[last.fm] element 'lastfm-song-cell' found successfully.");

        const apiUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USERNAME}&api_key=${LASTFM_API_KEY}&format=json&limit=1`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`http error! status: ${response.status}`);
            }
            const data = await response.json();

            if (data.recenttracks && data.recenttracks.track && data.recenttracks.track.length > 0) {
                const track = data.recenttracks.track[0];
                const songName = track.name;
                const artistName = track.artist['#text'];
                const trackUrl = track.url;

                const newContent = `<a href="${trackUrl}" target="_blank">${songName.toLowerCase()} - ${artistName.toLowerCase()}</a>`;
                lastfmSongCell.innerHTML = newContent;
                console.log(`[last.fm] success!: ${songName} - ${artistName}`);

            } else {
                lastfmSongCell.textContent = 'no recent tracks.';
                console.log("[last.fm] no recent tracks found.");
            }
        } catch (error) {
            console.error("[last.fm] failed to fetch api data:", error);
            lastfmSongCell.textContent = 'error.';
        }
    }

    window.inicializarLastFmWidget = function() {
        console.log("[last.fm] initializing widget...");
        setTimeout(() => {
            fetchLastFmTrack();
        }, 100);
    };

    console.log("[last.fm] widget script loaded!");

})();