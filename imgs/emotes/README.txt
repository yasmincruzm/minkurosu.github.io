PASTA DE EMOTES CUSTOMIZADOS (imgs/emotes/)
=============================================

Como adicionar novos emotes / imagens de reações:
1. Coloque suas imagens ou gifs (.gif, .png, .webp, .jpg) dentro desta pasta (ex: `imgs/emotes/meugato.gif`).
2. Abra o arquivo `emotes-config.js` na raiz do site.
3. Adicione uma linha no array `CUSTOM_EMOTES`:
   { id: "emote_meugato", name: "meugato", url: "imgs/emotes/meugato.gif" },

Pronto! Seu novo emote aparecerá automaticamente no Picker de reações do site todo (Feed, Tweets, Blog)!
