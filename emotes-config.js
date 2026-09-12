export const CUSTOM_EMOTES = [
  { id: "emote1", name: "emote1", url: "imgs/emotes/emote1.png" },
  { id: "emote2", name: "emote2", url: "imgs/emotes/emote2.png" },
  { id: "emote3", name: "emote3", url: "imgs/emotes/emote3.png" },
  { id: "emote4", name: "emote4", url: "imgs/emotes/emote4.png" },
  { id: "emote5", name: "emote5", url: "imgs/emotes/emote5.png" },
  { id: "emote6", name: "emote6", url: "imgs/emotes/emote6.png" },
  { id: "emote7", name: "emote7", url: "imgs/emotes/emote7.png" },
  { id: "emote8", name: "emote8", url: "imgs/emotes/emote8.png" },
  { id: "emote9", name: "emote9", url: "imgs/emotes/emote9.png" },
  { id: "emote10", name: "emote10", url: "imgs/emotes/emote10.png" },
  { id: "emote11", name: "emote11", url: "imgs/emotes/emote11.png" },
  { id: "emote12", name: "emote12", url: "imgs/emotes/emote12.png" },
  { id: "emote13", name: "emote13", url: "imgs/emotes/emote13.png" },
  { id: "emote14", name: "emote14", url: "imgs/emotes/emote14.png" },
  { id: "emote15", name: "emote15", url: "imgs/emotes/emote15.png" },
  { id: "emote16", name: "emote16", url: "imgs/emotes/emote16.png" },
  { id: "emote17", name: "emote17", url: "imgs/emotes/emote17.png" },
  { id: "emote18", name: "emote18", url: "imgs/emotes/emote18.png" },
  { id: "emote19", name: "emote19", url: "imgs/emotes/emote19.png" },
  { id: "emote20", name: "emote20", url: "imgs/emotes/emote20.png" },
  { id: "emote21", name: "emote21", url: "imgs/emotes/emote21.png" },
  { id: "emote22", name: "emote22", url: "imgs/emotes/emote22.png" }
];

export const DEFAULT_UNICODE_EMOJIS = [
  "❤️", "🖤", "🦇", "✨", "🔥", "😭", "💀", "⭐", "🐱", "🎀",
  "🕷️", "🩸", "🔪", "👀", "🌙", "☁️", "💔", "🥹", "🥺", "🌸",
  "☠️", "🐈‍⬛", "💫", "🕸️", "🩹", "👾", "🧸", "🕯️", "🎧", "🌹",
  "🧛", "🍙", "🍵", "🖤", "🍓", "✝️", "🎸", "🦇", "💿", "💊"
];

export const REACTION_CONFIG = {
  theme: "pill",
  maxDistinct: 25,
  whitelist: CUSTOM_EMOTES.map(e => e.id),
  blacklist: [],
  showEmptyWhitelist: false
};