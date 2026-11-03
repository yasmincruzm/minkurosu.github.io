function stripTrailingPunctuation(url) {
  const trailChars = /[).,;:!?'"\\]}]$/;
  let core = url, trail = '';
  while (trailChars.test(core)) {
    const last = core.slice(-1);
    if (last === ')') {
      const opens  = (core.match(/\(/g) || []).length;
      const closes = (core.match(/\)/g) || []).length;
      if (closes <= opens) break;
    }
    trail = last + trail;
    core  = core.slice(0, -1);
  }
  return { core, trail };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const RE = {
  image:   /\.(gif|png|jpe?g|webp|avif|svg)(\?\S*)?$/i,
  video:   /\.(mp4|webm|ogg|mov)(\?\S*)?$/i,
  youtube: /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,})/,
  spotify: /open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/,
  twitch:  /twitch\.tv\/([a-zA-Z0-9_]+)/,
};

export function isEmbeddable(url) {
  return RE.image.test(url)
    || RE.video.test(url)
    || RE.youtube.test(url)
    || RE.spotify.test(url);
}

export function buildEmbedHtml(url) {
  const u = escHtml(url);

  if (RE.image.test(url)) {
    return `<img src="${u}" alt="" loading="lazy"
      style="max-width:100%;border-radius:10px;margin-top:10px;display:block;">`;
  }

  if (RE.video.test(url)) {
    return `<video src="${u}" controls loading="lazy"
      style="max-width:100%;border-radius:10px;margin-top:10px;display:block;"></video>`;
  }

  let m = url.match(RE.youtube);
  if (m) {
    return `<div style="margin-top:10px;border-radius:10px;overflow:hidden;position:relative;padding-top:56.25%;">
      <iframe src="https://www.youtube.com/embed/${m[1]}" title="youtube video"
        style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen loading="lazy"></iframe>
    </div>`;
  }

  m = url.match(RE.spotify);
  if (m) {
    const height = (m[1] === 'track' || m[1] === 'episode') ? 152 : 352;
    return `<div style="margin-top:10px;border-radius:12px;overflow:hidden;">
      <iframe src="https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0"
        width="100%" height="${height}" frameborder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
    </div>`;
  }

  return '';
}

export function buildEmbeds(text) {
  const seen = new Set();
  let html = '';
  for (const m of text.matchAll(/(https?:\/\/[^\s<]+)/g)) {
    const { core } = stripTrailingPunctuation(m[1]);
    if (seen.has(core)) continue;
    seen.add(core);
    html += buildEmbedHtml(core);
  }
  return html;
}

export function linkify(text) {
  return escHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, raw => {
      const { core, trail } = stripTrailingPunctuation(raw);
      if (isEmbeddable(core)) return trail;
      return `<a href="${core}" target="_blank" rel="noopener" style="color:#3BB9E3;">${core}</a>${trail}`;
    })
    .replace(/#(\w+)/g, '<span style="color:#3BB9E3;">#$1</span>');
}

export function renderContent(text) {
  if (!text) return '';
  return `<p style="white-space:pre-wrap;word-wrap:break-word;">${linkify(text)}</p>${buildEmbeds(text)}`;
}
