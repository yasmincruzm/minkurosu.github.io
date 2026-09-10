export const CUSTOM_EMOTES = [

  { id: "emote1", name: "emote1", url: "imgs/emotes/emote1.webp" },
  { id: "emote2", name: "emote2", url: "imgs/emotes/emote2.webp" },
  { id: "emote3", name: "emote3", url: "imgs/emotes/emote3.webp" },
  { id: "emote4", name: "emote4", url: "imgs/emotes/emote4.webp" },
  { id: "emote5", name: "emote5", url: "imgs/emotes/emote5.webp" },
  { id: "emote6", name: "emote6", url: "imgs/emotes/emote6.webp" },
  { id: "emote7", name: "emote7", url: "imgs/emotes/emote7.webp" },
  { id: "emote8", name: "emote8", url: "imgs/emotes/emote8.webp" },
  { id: "emote9", name: "emote9", url: "imgs/emotes/emote9.webp" },
  { id: "emote10", name: "emote10", url: "imgs/emotes/emote10.webp" },
  { id: "emote11", name: "emote11", url: "imgs/emotes/emote11.webp" },
  { id: "emote12", name: "emote12", url: "imgs/emotes/emote12.webp" },
  { id: "emote13", name: "emote13", url: "imgs/emotes/emote13.webp" },
  { id: "emote14", name: "emote14", url: "imgs/emotes/emote14.webp" },
  { id: "emote15", name: "emote15", url: "imgs/emotes/emote15.webp" },
  { id: "emote16", name: "emote16", url: "imgs/emotes/emote16.webp" },
  { id: "emote17", name: "emote17", url: "imgs/emotes/emote17.webp" },
  { id: "emote18", name: "emote18", url: "imgs/emotes/emote18.webp" },
  { id: "emote19", name: "emote19", url: "imgs/emotes/emote19.webp" },
  { id: "emote20", name: "emote20", url: "imgs/emotes/emote20.webp" },
  { id: "emote21", name: "emote21", url: "imgs/emotes/emote21.webp" },
  { id: "emote22", name: "emote22", url: "imgs/emotes/emote22.webp" }
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