import { initializeApp, getApps }      from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


import {
  LIMITS, graphemeLength, buildText, validateLengths,
  loadSettings, saveSettings, loadPrefs, savePrefs, isConfigured,
  refreshMastodonLimit, crosspostAll, openXWindow, fillXWindow
} from './crosspost.js';
import { isEmbeddable, buildEmbedHtml, buildEmbeds, linkify } from './embed.js';


const firebaseConfig = {
  apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
  authDomain: "minkurosu.firebaseapp.com",
  projectId: "minkurosu",
  storageBucket: "minkurosu.firebasestorage.app",
  messagingSenderId: "290821725607",
  appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
  measurementId: "G-M7PWC6DDRH"
};

const ADMIN_EMAIL = "mincruzm@gmail.com";

const app     = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

let isAdmin = false;

onAuthStateChanged(auth, user => {
  isAdmin = !!(user && user.email === ADMIN_EMAIL);
  
  const composeBox = document.getElementById("compose-post");
  if (composeBox) composeBox.style.display = isAdmin ? "block" : "none";
  rerenderAll();
});


const style = document.createElement("style");
style.textContent = `
  #thoughts-root {
    background: #1A1A1A;
    font-family: "Helvetica Neue", "Helvetica", Arial, sans-serif;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    padding-bottom: 100px;
    overflow-x: hidden;
    max-width: 100%;
  }
  #thoughts-root *, #thoughts-root *::before, #thoughts-root *::after {
    box-sizing: border-box;
  }
  #thoughts-root .container {
    display: flex;
    width: 100%;
    max-width: 1200px;
    padding: 0 30px;
    justify-content: space-between;
    background-color: #1A1A1A;
    box-sizing: border-box;
  }
  #thoughts-root div.banner {
    width: 100%;
    height: 380px;
    color: #FFF;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #3BB9E3;
  }
  #thoughts-root div.banner img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  #thoughts-root .bar {
    height: 60px;
    display: flex;
    justify-content: center;
    background-color: #1A1A1A;
    box-shadow: 0 1px 1px #000000B0;
  }
  #thoughts-root .bar .container { align-items: center; padding-left: 285px; }
  #thoughts-root .bar .container ul { display: flex; height: 100%; list-style: none; }
  #thoughts-root .bar .container ul li {
    display: flex; align-items: center; justify-content: center;
    flex-direction: column; padding: 0 15px; margin: 0 15px; position: relative;
  }
  #thoughts-root .bar .container ul li.active::after {
    content: ''; left: 0; width: 100%; height: 3px;
    bottom: 0; position: absolute; background: #3BB9E3;
  }
  #thoughts-root .bar .container ul li span { color: #B3B3B3; font-size: 12px; font-weight: bold; }
  #thoughts-root .bar .container ul li strong { color: #E1E8ED; font-size: 18px; margin-top: 2px; font-weight: bold; }
  #thoughts-root .bar .container ul li.active strong { color: #3BB9E3; }
  #thoughts-root .bar .container .actions button {
    width: 90px; height: 34px; display: flex; align-items: center; justify-content: center;
    margin-right: 20px; border: 0px; color: #E1E8ED; font-size: 14px; font-weight: bold;
    border-radius: 16px; border: 1px solid #E1E8ED; background-color: #1A1A1A;
  }
  #thoughts-root .bar .container .actions { display: flex; }
  #thoughts-root .wrapper-content { display: flex; justify-content: center; }
  #thoughts-root .wrapper-content aside.profile { width: 260px; }
  #thoughts-root .wrapper-content aside.profile img.avatar {
    width: 200px; height: 200px; border-radius: 50%;
    margin-top: -130px; border: 5px solid #1A1A1A;
  }
  #thoughts-root .wrapper-content aside.profile h1 { font-size: 21px; margin-top: 10px; color: #E1E8ED; }
  #thoughts-root .wrapper-content aside.profile span { font-size: 14px; color: #B3B3B3; }
  #thoughts-root .wrapper-content aside.profile p { font-size: 14px; color: #E1E8ED; margin-top: 15px; }
  #thoughts-root .wrapper-content aside.profile ul { margin-top: 20px; list-style: none; }
  #thoughts-root .wrapper-content aside.profile ul.list li {
    font-size: 14px; color: #B3B3B3; display: flex; margin-top: 5px; align-items: center;
  }
  #thoughts-root .wrapper-content aside.profile li:first-child { margin: 0; }
  #thoughts-root .wrapper-content aside.profile ul.list img { margin-right: 10px; filter: invert(100%); }
  #thoughts-root .wrapper-content aside.profile .widget { margin-top: 20px; }
  #thoughts-root .wrapper-content aside.profile .widget strong {
    font-weight: normal; color: #3BB9E3; font-size: 14px; display: flex; align-items: center;
  }
  #thoughts-root .wrapper-content aside.profile .widget strong img { margin-right: 5px; filter: invert(100%); }
  #thoughts-root .wrapper-content aside.profile .followers ul {
    display: flex; flex-wrap: wrap; align-items: flex-start; align-content: flex-start; list-style: none;
  }
  #thoughts-root .wrapper-content aside.profile .followers ul li {
    height: 45px; width: 45px; flex: 1 0 auto; border-radius: 50%; background: #252525; margin: 0 5px 10px 0px;
  }
  #thoughts-root .wrapper-content aside.profile .images ul {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; list-style: none;
  }
  #thoughts-root .wrapper-content aside.profile .images li {
    width: 100%; aspect-ratio: 1 / 1; border-radius: 8px; background: #252525;
  }
  #thoughts-root .wrapper-content aside.profile .images li img {
    width: 100%; height: 100%; object-fit: cover; border-radius: 8px;
  }
  #thoughts-root .wrapper-content .timeline {
    flex: 1; background: #1A1A1A; margin: 10px 20px 0px; min-width: 0;
  }
  #thoughts-root .wrapper-content .timeline .timeline-divider {
    border-bottom: 1px solid #3A3A3A; margin-bottom: 0;
  }
  #thoughts-root #tweets-container { list-style: none; padding: 0; margin: 0; }
  #thoughts-root #tweets-container li {
    border-bottom: 1px solid #3A3A3A; padding: 10px 15px; display: flex;
    position: relative; cursor: pointer; transition: background-color 0.15s ease;
  }
  #thoughts-root #tweets-container li:hover { background-color: #202020; }
  #thoughts-root #tweets-container li > img { width: 48px; height: 48px; border-radius: 50%; }
  #thoughts-root #tweets-container li .info {
    margin-left: 10px; display: flex; flex-direction: column; width: 100%; min-width: 0;
  }
  #thoughts-root #tweets-container li .info strong {
    font-size: 14px; color: #E1E8ED; display: flex; align-items: center; flex-wrap: wrap; gap: 0.25em;
  }
  #thoughts-root #tweets-container li .info strong span { font-size: 13px; color: #B3B3B3; font-weight: normal; }
  #thoughts-root #tweets-container li .info p {
    font-size: 14px; color: #E1E8ED; margin-top: 5px; word-wrap: break-word;
  }

  #thoughts-root .twt-menu-btn {
    position: absolute; top: 10px; right: 12px;
    background: transparent; border: none; color: #555;
    cursor: pointer; font-size: 20px; line-height: 1;
    padding: 2px 8px; border-radius: 6px;
    transition: background 0.15s, color 0.15s; z-index: 10;
  }
  #thoughts-root .twt-menu-btn:hover { background: #2a2a2a; color: #E1E8ED; }
  #thoughts-root .twt-dropdown {
    display: none; position: absolute; top: 34px; right: 12px;
    background: #252525; border: 1px solid #3A3A3A; border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.6); z-index: 20;
    min-width: 140px; overflow: hidden; animation: ddIn 0.15s ease;
  }
  @keyframes ddIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  #thoughts-root .twt-dropdown.open { display: block; }
  #thoughts-root .twt-dropdown-btn {
    width: 100%; padding: 10px 14px; background: transparent; border: none;
    color: #bf6a6a; font-size: 13px; font-family: "Helvetica Neue", Arial, sans-serif;
    text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px;
    transition: background 0.15s;
  }
  #thoughts-root .twt-dropdown-btn:hover { background: #2a2020; }
  #thoughts-root .twt-dropdown-btn svg {
    width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; flex-shrink: 0;
  }

  #thoughts-root .edit-form { margin-top: 5px; }
  #thoughts-root .edit-form textarea {
    width: 100%; background: #252525; border: 1px solid #3A3A3A;
    border-radius: 8px; padding: 10px; color: #E1E8ED; font-size: 14px;
    resize: vertical; min-height: 60px; margin-bottom: 8px; box-sizing: border-box;
  }
  #thoughts-root .edit-form .edit-actions { display: flex; justify-content: flex-end; gap: 10px; }
  #thoughts-root .edit-form .edit-save {
    background: #3BB9E3; color: #FFF; border: none; border-radius: 16px;
    padding: 6px 14px; font-weight: bold; cursor: pointer; font-size: 13px;
  }
  #thoughts-root .edit-form .edit-cancel {
    background: transparent; color: #B3B3B3; border: 1px solid #3A3A3A;
    border-radius: 16px; padding: 6px 14px; cursor: pointer; font-size: 13px;
  }

  #thoughts-root #compose-post {
    display: none; background: #1A1A1A; border-bottom: 1px solid #3A3A3A; padding: 15px;
  }
  #thoughts-root #compose-post .compose-body { display: flex; gap: 10px; }
  #thoughts-root #compose-post .compose-body img { width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0; }
  #thoughts-root #compose-post .compose-fields { display: flex; flex-direction: column; width: 100%; }
  #thoughts-root #compose-post textarea {
    width: 100%; background: transparent; border: none; resize: vertical; min-height: 60px;
    color: #E1E8ED; font-size: 15px; font-family: "Helvetica Neue", Arial, sans-serif; outline: none;
  }
  #thoughts-root #compose-post input[type="text"] {
    background: #252525; border: 1px solid #3A3A3A; border-radius: 8px;
    padding: 8px 10px; color: #E1E8ED; font-size: 13px; margin-top: 8px; outline: none;
    width: 100%; box-sizing: border-box;
  }
  #thoughts-root #compose-post .compose-image-row { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
  #thoughts-root #compose-post .compose-image-row input[type="text"] { margin-top: 0; flex: 1; }
  #thoughts-root #compose-post .compose-upload-btn {
    flex-shrink: 0; background: #252525; border: 1px solid #3A3A3A; border-radius: 8px;
    padding: 8px 12px; color: #B3B3B3; font-size: 13px; cursor: pointer; white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }
  #thoughts-root #compose-post .compose-upload-btn:hover { background: #2a2a2a; color: #E1E8ED; }
  #thoughts-root #compose-post .compose-image-preview { display: none; position: relative; margin-top: 10px; width: fit-content; }
  #thoughts-root #compose-post .compose-image-preview.active { display: block; }
  #thoughts-root #compose-post .compose-image-preview img { max-width: 160px; max-height: 160px; border-radius: 8px; display: block; }
  #thoughts-root #compose-post .compose-image-remove {
    position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; border-radius: 50%;
    background: #1A1A1A; border: 1px solid #3A3A3A; color: #E1E8ED; font-size: 13px; line-height: 1;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  #thoughts-root #compose-post .compose-image-remove:hover { background: #bf6a6a; }
  #thoughts-root #compose-post .compose-upload-hint { font-size: 11px; color: #667580; margin-top: 4px; }
  #thoughts-root #compose-post .compose-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
  #thoughts-root #compose-post button {
    background: #3BB9E3; color: #FFF; border: none; border-radius: 16px;
    padding: 8px 18px; font-weight: bold; cursor: pointer;
  }
  #thoughts-root #compose-post button:hover { background: #2da0c7; }
  #thoughts-root #compose-post button:disabled { background: #2a4a56; cursor: default; }

  #thoughts-root .post-actions { 
    display: flex; 
    gap: 10px;
    margin: 12px 0 0 0;
    padding-top: 6px; 
    align-items: center; 
    flex-wrap: wrap;
    width: 100%;
  }
  #thoughts-root .action-button {
    display: flex; align-items: center; gap: 6px;
    color: #E1E8ED; cursor: pointer; font-size: 13px; font-weight: 500;
  }
  #thoughts-root .action-button:hover { color: #ffffff; }
  #thoughts-root .action-button svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.5; }
  #thoughts-root .action-button.liked,
  #thoughts-root .action-button.liked:hover { color: #E0245E; }
  #thoughts-root .action-button.liked svg { fill: currentColor; stroke: currentColor; }

  /* ============================================================
     REACTIONS — chip e add-btn
     ============================================================ */
  #thoughts-root .twt-reactions-box {
    display: inline-flex !important;
    align-items: center !important;
    margin: 0 !important;
    padding: 0 !important;
    flex: 0 0 auto !important;
    vertical-align: middle !important;
  }
  #thoughts-root .twt-reactions-box .reactions-wrapper {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 5px !important;
    position: relative !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  #thoughts-root .twt-reactions-box .reactions-list {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    align-content: center !important;
    gap: 4px !important;
    list-style: none !important;
    margin: 0 !important;
    padding: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
  #thoughts-root .twt-reactions-box .reactions-list li {
    display: flex !important;
    flex-shrink: 0 !important;
  }

  #thoughts-root .twt-reactions-box .reaction-chip {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 5px !important;
    min-width: 34px !important;
    width: auto !important;
    height: 26px !important;
    padding: 0 8px !important;
    background: #252525 !important;
    border: none !important;
    border-radius: 13px !important;
    color: #E1E8ED !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    line-height: 1 !important;
    position: relative !important;
    flex-shrink: 0 !important;
    outline: none !important;
    box-sizing: border-box !important;
    transition: background 0.12s !important;
  }
  #thoughts-root .twt-reactions-box .reaction-chip:hover {
    background: #303030 !important;
  }
  #thoughts-root .twt-reactions-box .reaction-chip.reacted {
    background: #303030 !important;
    box-shadow: inset 0 0 0 2px #3f4262 !important;
  }

  #thoughts-root .twt-reactions-box .reaction-icon {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 18px !important;
    height: 18px !important;
    min-width: 18px !important;
    min-height: 18px !important;
    max-width: 18px !important;
    max-height: 18px !important;
    font-size: 15px !important;
    line-height: 1 !important;
    flex-shrink: 0 !important;
    overflow: hidden !important;
    vertical-align: middle !important;
  }
  #thoughts-root .twt-reactions-box .reaction-icon img {
    width: 18px !important;
    height: 18px !important;
    max-width: 18px !important;
    max-height: 18px !important;
    object-fit: contain !important;
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  #thoughts-root .twt-reactions-box .reaction-count {
    font-size: 11px !important;
    font-weight: 700 !important;
    color: inherit !important;
    line-height: 1 !important;
  }

  #thoughts-root .twt-reactions-box .reaction-add-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 26px !important;
    height: 26px !important;
    min-width: 26px !important;
    min-height: 26px !important;
    max-width: 26px !important;
    max-height: 26px !important;
    padding: 0 !important;
    background: #252525 !important;
    border: none !important;
    border-radius: 50% !important;
    cursor: pointer !important;
    overflow: hidden !important;
    flex-shrink: 0 !important;
    outline: none !important;
    box-sizing: border-box !important;
    transition: background 0.12s !important;
  }
  #thoughts-root .twt-reactions-box .reaction-add-btn:hover {
    background: #303030 !important;
  }
  #thoughts-root .twt-reactions-box .reaction-add-btn img,
  #thoughts-root .twt-reactions-box .reaction-add-btn svg {
    width: 14px !important;
    height: 14px !important;
    max-width: 14px !important;
    max-height: 14px !important;
    object-fit: contain !important;
    display: block !important;
    filter: brightness(1.2) saturate(0.3) !important;
  }

  .reaction-picker {
    position: fixed !important;
    z-index: 2147483647 !important;
    width: 400px !important;
    max-width: calc(100vw - 24px) !important;
    background: #1a1a1a !important;
    border: none !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 28px rgba(0,0,0,0.8) !important;
    display: none !important;
    flex-direction: column !important;
    overflow: hidden !important;
    font-family: "MinFont", monospace !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .reaction-picker.open { display: flex !important; }

  .reaction-picker .picker-header {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 10px 12px !important;
    background: #1a1a1a !important;
    border-bottom: 1px solid #242424 !important;
    flex-shrink: 0 !important;
    margin: 0 !important;
  }
  .reaction-picker .picker-search {
    flex: 1 !important;
    background: #111 !important;
    border: none !important;
    border-radius: 6px !important;
    padding: 8px 12px !important;
    color: #e6e6e6 !important;
    font-size: 13px !important;
    font-family: inherit !important;
    outline: none !important;
    min-width: 0 !important;
    margin: 0 !important;
    box-sizing: border-box !important;
  }
  .reaction-picker .picker-search::placeholder { color: #5a5a5a !important; }

  .reaction-picker .picker-tabs {
    display: grid !important;
    grid-template-columns: repeat(8, 1fr) !important;
    align-items: center !important;
    justify-items: center !important;
    gap: 4px !important;
    padding: 8px 10px !important;
    background: #1a1a1a !important;
    border-bottom: 1px solid #242424 !important;
    flex-shrink: 0 !important;
    margin: 0 !important;
  }
  .reaction-picker .picker-tab-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    height: 32px !important;
    background: transparent !important;
    border: none !important;
    border-radius: 6px !important;
    font-size: 18px !important;
    cursor: pointer !important;
    padding: 0 !important;
    margin: 0 !important;
    line-height: 1 !important;
    box-sizing: border-box !important;
  }
  .reaction-picker .picker-tab-btn:hover { background: #242424 !important; }
  .reaction-picker .picker-tab-btn.active { background: #242424 !important; }

  .reaction-picker .picker-body {
    display: block !important;
    width: 100% !important;
    height: 320px !important;
    min-height: 320px !important;
    max-height: 320px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    padding: 12px 14px !important;
    background: #1a1a1a !important;
    flex-shrink: 0 !important;
    box-sizing: border-box !important;
    margin: 0 !important;
  }

  .reaction-picker .picker-grid {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, 44px) !important;
    grid-auto-rows: 44px !important;
    gap: 6px !important;
    width: 100% !important;
    justify-content: flex-start !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .reaction-picker .picker-item-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    min-height: 44px !important;
    max-width: 44px !important;
    max-height: 44px !important;
    padding: 0 !important;
    margin: 0 !important;
    background: transparent !important;
    border: 1px solid transparent !important;
    border-radius: 7px !important;
    cursor: pointer !important;
    font-size: 28px !important;
    line-height: 1 !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    vertical-align: middle !important;
    transition: background 0.1s !important;
  }
  .reaction-picker .picker-item-btn:hover {
    background: #242424 !important;
  }
  .reaction-picker .picker-item-btn img {
    width: 40px !important;
    height: 40px !important;
    max-width: 40px !important;
    max-height: 40px !important;
    object-fit: contain !important;
    object-position: center !important;
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .reaction-picker .picker-empty {
    grid-column: 1 / -1 !important;
    padding: 18px 10px !important;
    text-align: center !important;
    color: #7a7d84 !important;
    font-size: 12px !important;
  }
  .reaction-picker .picker-footer {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 4px !important;
    padding: 10px 12px 11px !important;
    font-size: 11.5px !important;
    color: #8a8d94 !important;
    background: #141414 !important;
    border-top: 1px solid #242424 !important;
    text-align: center !important;
    flex-shrink: 0 !important;
    margin: 0 !important;
  }
  .reaction-picker .picker-footer b { color: #c5c8ce !important; font-weight: 700 !important; }
  .reaction-picker .picker-footer .star-icon { width: 11px !important; height: 11px !important; fill: #c5c8ce !important; }
`;
document.head.appendChild(style);

const style2 = document.createElement("style");
style2.textContent = `
  #thoughts-root #post-tabs li { cursor: pointer; }
  #thoughts-root #post-tabs li:hover span { color: #E1E8ED; }
  @media (max-width: 760px) {
    #thoughts-root .bar .container { padding-left: 16px; }
  }

  #thoughts-root .repost-label {
    font-size: 12px; color: #667580; margin-bottom: 4px;
    display: flex; align-items: center; gap: 6px;
  }
  #thoughts-root .repost-card {
    display: block; margin-top: 8px; padding: 10px 12px;
    border: 1px solid #3A3A3A; border-radius: 10px;
    color: #3BB9E3; font-size: 13px; text-decoration: none; word-break: break-all;
  }
  #thoughts-root .repost-card:hover { background: #202020; }
  #thoughts-root #tweets-container li .info p:empty { display: none; }
  #thoughts-root .xp-badges { display: inline-flex; gap: 6px; }
  #thoughts-root .xp-badges a { text-decoration: none; font-size: 12px; }

  #thoughts-root #tweets-container li.post-highlight { animation: postHi 2.4s ease; }
  @keyframes postHi { from { background: #26343b; } to { background: transparent; } }

  #thoughts-root #compose-post .compose-kind { display: flex; gap: 14px; margin-bottom: 6px; }
  #thoughts-root #compose-post .compose-kind label {
    display: flex; align-items: center; gap: 5px; color: #B3B3B3; font-size: 13px; cursor: pointer;
  }
  #thoughts-root #compose-post #compose-repost-url { display: none; }
  #thoughts-root #compose-post #compose-repost-url.show { display: block; margin-bottom: 6px; }

  #thoughts-root #compose-post .xp-row {
    display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 12px;
    color: #B3B3B3; font-size: 13px;
  }
  #thoughts-root #compose-post .xp-row label { display: flex; align-items: center; gap: 5px; cursor: pointer; }
  #thoughts-root #compose-post .xp-counter { margin-top: 6px; font-size: 12px; color: #667580; }
  #thoughts-root #compose-post .xp-counter .over { color: #E0245E; font-weight: bold; }

  #thoughts-root #compose-post button.xp-link-btn {
    background: transparent; color: #B3B3B3; border: 1px solid #3A3A3A;
    padding: 4px 10px; font-size: 12px; font-weight: normal; border-radius: 12px;
  }
  #thoughts-root #compose-post button.xp-link-btn:hover { background: #252525; color: #E1E8ED; }

  #thoughts-root #compose-post .xp-settings {
    display: none; flex-direction: column; gap: 6px; margin-top: 10px; padding: 12px;
    background: #202020; border: 1px solid #3A3A3A; border-radius: 10px;
  }
  #thoughts-root #compose-post .xp-settings.open { display: flex; }
  #thoughts-root #compose-post .xp-settings h4 { margin: 6px 0 0; font-size: 13px; color: #E1E8ED; }
  #thoughts-root #compose-post .xp-settings small { color: #667580; font-size: 11px; line-height: 1.4; }
  #thoughts-root #compose-post .xp-settings input[type="text"],
  #thoughts-root #compose-post .xp-settings input[type="password"],
  #thoughts-root #compose-post .xp-settings select {
    background: #252525; border: 1px solid #3A3A3A; border-radius: 8px;
    padding: 8px 10px; color: #E1E8ED; font-size: 13px; outline: none;
    width: 100%; box-sizing: border-box; margin-top: 0;
  }
  #thoughts-root #compose-post .xp-settings .xp-btns { display: flex; gap: 8px; margin-top: 6px; }

  #thoughts-root #compose-post .xp-status { margin-top: 8px; font-size: 12px; line-height: 1.6; }
  #thoughts-root #compose-post .xp-status.ok   { color: #6abf6a; }
  #thoughts-root #compose-post .xp-status.err  { color: #bf6a6a; }
  #thoughts-root #compose-post .xp-status.info { color: #7a9abf; }
  #thoughts-root #compose-post .xp-status a { color: #3BB9E3; }
  #thoughts-root #compose-post .xp-status button { margin-top: 6px; }
`;
document.head.appendChild(style2);



function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

    trail = lastChar + trail;
    core = core.slice(0, -1);
  }
  return { core, trail };
}

function isEmbeddable(url) {
  if (/\.(gif|png|jpe?g|webp)(\?\S*)?$/i.test(url)) return true;
  if (/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,})/.test(url)) return true;
  if (/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/.test(url)) return true;
  return false;
}

function linkify(text) {
  return escHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, raw => {
      const { core, trail } = stripTrailingPunctuation(raw);
      if (isEmbeddable(core)) return trail;
      return `<a href="${core}" target="_blank" rel="noopener" style="color:#3BB9E3;">${core}</a>${trail}`;
    })
    .replace(/#(\w+)/g, '<span style="color:#3BB9E3;">#$1</span>');
}

function buildEmbedHtml(url) {
  if (/\.(gif|png|jpe?g|webp)(\?\S*)?$/i.test(url)) {
    return `<img src="${escHtml(url)}" alt="" loading="lazy"
      style="max-width:100%;border-radius:10px;margin-top:10px;display:block;">`;
  }
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,})/);
  if (m) {
    return `<div style="margin-top:10px;border-radius:10px;overflow:hidden;position:relative;padding-top:56.25%;">
      <iframe src="https://www.youtube.com/embed/${m[1]}" title="youtube video"
        style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen loading="lazy"></iframe>
    </div>`;
  }
  m = url.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/);
  if (m) {
    const height = m[1] === "track" || m[1] === "episode" ? 152 : 352;
    return `<div style="margin-top:10px;border-radius:12px;overflow:hidden;">
      <iframe src="https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0"
        width="100%" height="${height}" frameborder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
    </div>`;
  }
  return "";
}



function safeUrl(u) {
  try {
    const x = new URL(u);
    return (x.protocol === "http:" || x.protocol === "https:") ? x.href : "";
  } catch { return ""; }
}

function shortLink(u) {
  try {
    const x = new URL(u);
    const s = x.hostname.replace(/^www\./, "") + (x.pathname !== "/" ? x.pathname : "");
    return s.length > 48 ? s.slice(0, 47) + "…" : s;
  } catch { return u; }
}

function isRepost(d) {
  return d.type === "repost" || /^RT @/i.test((d.content || "").trim());
}

const XP_NETS = ["bluesky", "mastodon", "x"];
let lastRetry = null; // { ref, text, file, imageUrl, failed: [...] }

function currentKind() {
  return document.querySelector('#compose-post input[name="compose-kind"]:checked')?.value || "original";
}

function resetSubmitLabel() {
  const b = document.getElementById("compose-submit");
  if (b) b.textContent = currentKind() === "repost" ? "repost" : "post";
}

function setComposeStatus(lines, kind = "", withRetry = false) {
  const el = document.getElementById("compose-status");
  if (!el) return;
  el.className = "xp-status " + kind;
  el.innerHTML = lines.map(l => `<div>${l}</div>`).join("")
    + (withRetry ? `<button type="button" class="xp-link-btn" id="xp-retry">tentar de novo (só as que falharam)</button>` : "");
}

function resultLines(results) {
  return Object.entries(results).map(([n, r]) => {
    if (r.ok) {
      const link = r.url ? safeUrl(r.url) : "";
      return link
        ? `✓ ${n}: <a href="${escHtml(link)}" target="_blank" rel="noopener">ver post</a>`
        : `✓ ${n}: ok`;
    }
    return `✗ ${n}: ${escHtml(r.error || "erro")}`;
  });
}

function xResult(win, text, imageUrl) {
  return fillXWindow(win, { text, imageUrl })
    ? { ok: true }
    : { ok: false, error: "popup bloqueado — permita popups para este site" };
}

function updateXpCounter() {
  const el = document.getElementById("xp-counter");
  if (!el) return;
  const nets = XP_NETS.filter(n => document.getElementById(`xp-${n}`)?.checked);
  if (!nets.length) { el.textContent = ""; return; }
  const repostUrl = currentKind() === "repost"
    ? safeUrl(document.getElementById("compose-repost-url")?.value.trim() || "") : "";
  const text = buildText({ content: document.getElementById("compose-text")?.value || "", repostUrl });
  const len = graphemeLength(text);
  const s = loadSettings();
  el.innerHTML = nets.map(n => {
    const max = n === "mastodon" ? (s.mastoMax || LIMITS.mastodon) : LIMITS[n];
    return `<span class="${len > max ? "over" : ""}">${n} ${len}/${max}</span>`;
  }).join(" · ");
}

async function finishCrosspost(ref, results, payload) {
  const upd = {};
  const failed = [];
  for (const [n, r] of Object.entries(results)) {
    if (r.ok) { if (r.url) upd[`crossposted.${n}`] = { url: r.url }; }
    else failed.push(n);
  }
  if (Object.keys(upd).length) {
    try { await updateDoc(ref, upd); }
    catch (e) { console.warn("não salvou os links do crosspost:", e); }
  }
  lastRetry = failed.length ? { ref, ...payload, failed } : null;
  setComposeStatus(resultLines(results), failed.length ? "err" : "ok", failed.length > 0);
}

async function retryFailed() {
  if (!isAdmin || !lastRetry) return;
  const { ref, text, file, imageUrl, failed } = lastRetry;
  const xWin = failed.includes("x") ? openXWindow() : null; // dentro do clique
  setComposeStatus(["tentando de novo..."], "info");
  const results = {};
  const apiNets = failed.filter(n => n !== "x");
  if (apiNets.length) Object.assign(results, await crosspostAll({ networks: apiNets, text, file, imageUrl }));
  if (failed.includes("x")) results.x = xResult(xWin, text, imageUrl);
  await finishCrosspost(ref, results, { text, file, imageUrl });
}

async function createPost() {
  if (!isAdmin) return;
  const box = document.getElementById("compose-post");
  const textEl = document.getElementById("compose-text");
  const urlEl = document.getElementById("compose-image");
  const fileEl = document.getElementById("compose-image-file");
  const repostEl = document.getElementById("compose-repost-url");
  const submitBtn = document.getElementById("compose-submit");

  const kind = currentKind();
  const content = textEl.value.trim();
  const pastedUrl = urlEl.value.trim();
  const file = fileEl.files[0] || null;
  const repostUrl = kind === "repost" ? safeUrl(repostEl.value.trim()) : "";

  if (kind === "repost") {
    if (!repostUrl) {
      setComposeStatus(["cole o link do post original (começando com https://)"], "err");
      return;
    }
  } else if (!content && !pastedUrl && !file) {
    return;
  }

  const networks = XP_NETS.filter(n => document.getElementById(`xp-${n}`)?.checked);
  const text = buildText({ content, repostUrl });

  const problems = validateLengths(text, networks);
  if (problems.length) {
    setComposeStatus([`texto grande demais — ${escHtml(problems.join(" · "))}. encurte ou desmarque a rede.`], "err");
    return;
  }
  const missing = networks.filter(n => !isConfigured(n));
  if (missing.length) {
    setComposeStatus([`configure as contas de ${missing.join(", ")} em “⚙ contas”.`], "err");
    document.getElementById("xp-settings")?.classList.add("open");
    return;
  }

  savePrefs(Object.fromEntries(XP_NETS.map(n => [n, networks.includes(n)])));

  const xWin = networks.includes("x") ? openXWindow() : null;

  submitBtn.disabled = true;
  setComposeStatus([], "");
  lastRetry = null;

  try {
    let imageUrl = pastedUrl || "";
    if (file) {
      submitBtn.textContent = "uploading image...";
      const path = `posts/${Date.now()}_${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      imageUrl = await getDownloadURL(fileRef);
    }

    submitBtn.textContent = "posting...";
    const docData = { content, imageUrl, type: kind, timestamp: serverTimestamp() };
    if (repostUrl) docData.repostUrl = repostUrl;
    const ref = await addDoc(collection(db, "posts"), docData);

    textEl.value = "";
    repostEl.value = "";
    if (box && box._clearImageSelection) box._clearImageSelection();
    updateXpCounter();

    if (!networks.length) {
      setComposeStatus(["✓ publicado no site"], "ok");
      return;
    }

    submitBtn.textContent = "crossposting...";
    const results = {};
    const apiNets = networks.filter(n => n !== "x");
    if (apiNets.length) {
      Object.assign(results, await crosspostAll({ networks: apiNets, text, file, imageUrl }));
    }
    if (networks.includes("x")) results.x = xResult(xWin, text, imageUrl);
    await finishCrosspost(ref, results, { text, file, imageUrl });
  } catch (err) {
    console.error("error:", err);
    if (xWin && !xWin.closed) xWin.close();
    setComposeStatus([`erro: ${escHtml(err.message || String(err))}`], "err");
  } finally {
    submitBtn.disabled = false;
    resetSubmitLabel();
  }
}

function injectComposeBox() {
  if (document.getElementById("compose-post")) return;
  const container = document.getElementById("tweets-container");
  if (!container || !container.parentNode) return;

  const box = document.createElement("div");
  box.id = "compose-post";
  box.innerHTML = `
    <div class="compose-body">
      <img src="imgs/site_imgs/twitteravatar.jpg" alt="avatar">
      <div class="compose-fields">
        <div class="compose-kind">
          <label><input type="radio" name="compose-kind" value="original" checked> original</label>
          <label><input type="radio" name="compose-kind" value="repost"> repost</label>
        </div>
        <input type="text" id="compose-repost-url" placeholder="link do post original (https://...)">
        <textarea id="compose-text" placeholder="what's on your mind?"></textarea>
        <div class="compose-image-row">
          <input type="text" id="compose-image" placeholder="image url (optional)">
          <label class="compose-upload-btn" for="compose-image-file">upload image</label>
          <input type="file" id="compose-image-file" accept="image/*" hidden>
        </div>
        <div id="compose-image-preview" class="compose-image-preview">
          <img id="compose-image-preview-img" src="" alt="preview">
          <button type="button" class="compose-image-remove" id="compose-image-remove" title="remove image">×</button>
        </div>

        <div class="xp-row">
          <span>crosspost:</span>
          <label><input type="checkbox" id="xp-bluesky"> bluesky</label>
          <label><input type="checkbox" id="xp-mastodon"> mastodon</label>
          <label><input type="checkbox" id="xp-x"> x</label>
          <button type="button" class="xp-link-btn" id="xp-settings-toggle">⚙ contas</button>
        </div>
        <div class="xp-counter" id="xp-counter"></div>

        <div class="xp-settings" id="xp-settings">
          <h4>bluesky</h4>
          <input type="text" id="xp-bsky-handle" value="minkurosu.bsky.social" readonly title="só @minkurosu">
          <input type="password" id="xp-bsky-pass" placeholder="app password (xxxx-xxxx-xxxx-xxxx)" autocomplete="off">
          <small>gere em bsky.app → settings → privacy and security → app passwords. não use a senha da conta.</small>

          <h4>mastodon</h4>
          <input type="text" id="xp-masto-instance" placeholder="sua instância (ex: mastodon.social)">
          <input type="password" id="xp-masto-token" placeholder="access token" autocomplete="off">
          <select id="xp-masto-vis">
            <option value="public">público</option>
            <option value="unlisted">não listado</option>
          </select>
          <small>no mastodon: preferências → desenvolvimento → nova aplicação, com as permissões write:statuses e write:media. e também read:accounts (serve pra conferir que a conta é @minkurosu). copie “seu token de acesso”. o crosspost só funciona se o token for do usuário @minkurosu.</small>

          <h4>x</h4>
          <small>o x não deixa postar direto do navegador (a API é paga). ao marcar “x”, abre uma janela do x com o texto pronto e você só clica em postar. o x posta na conta que estiver logada nele, então confira se é a @minkurosu antes de clicar. imagens vão como link.</small>

          <small>as senhas ficam só neste navegador (localStorage). configure de novo em cada aparelho.</small>
          <div class="xp-btns">
            <button type="button" class="xp-link-btn" id="xp-save">salvar</button>
            <button type="button" class="xp-link-btn" id="xp-clear">apagar credenciais</button>
          </div>
        </div>

        <div class="xp-status" id="compose-status"></div>
      </div>
    </div>
    <div class="compose-actions">
      <button id="compose-submit">post</button>
    </div>
  `;
  container.parentNode.insertBefore(box, container);

  const urlInput = box.querySelector("#compose-image");
  const fileInput = box.querySelector("#compose-image-file");
  const preview = box.querySelector("#compose-image-preview");
  const previewImg = box.querySelector("#compose-image-preview-img");
  const removeBtn = box.querySelector("#compose-image-remove");

  function showPreview(src) {
    previewImg.src = src;
    preview.classList.add("active");
  }
  function clearImageSelection() {
    fileInput.value = "";
    urlInput.value = "";
    urlInput.disabled = false;
    preview.classList.remove("active");
    previewImg.src = "";
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    urlInput.value = "";
    urlInput.disabled = true;
    const reader = new FileReader();
    reader.onload = e => showPreview(e.target.result);
    reader.readAsDataURL(file);
  });

  urlInput.addEventListener("input", () => {
    const val = urlInput.value.trim();
    if (!val) {
      if (!fileInput.files[0]) preview.classList.remove("active");
      return;
    }
    fileInput.value = "";
    showPreview(val);
  });

  removeBtn.addEventListener("click", () => clearImageSelection());
  box._clearImageSelection = clearImageSelection;

  const repostInput = box.querySelector("#compose-repost-url");
  const textEl = box.querySelector("#compose-text");
  box.querySelectorAll('input[name="compose-kind"]').forEach(r => {
    r.addEventListener("change", () => {
      const isRe = currentKind() === "repost";
      repostInput.classList.toggle("show", isRe);
      textEl.placeholder = isRe ? "comentário (opcional)" : "what's on your mind?";
      resetSubmitLabel();
      updateXpCounter();
    });
  });
  textEl.addEventListener("input", updateXpCounter);
  repostInput.addEventListener("input", updateXpCounter);

  const prefs = loadPrefs();
  XP_NETS.forEach(n => {
    const cb = box.querySelector(`#xp-${n}`);
    cb.checked = !!prefs[n];
    cb.addEventListener("change", updateXpCounter);
  });

  const settingsEl = box.querySelector("#xp-settings");
  const s = loadSettings();
  box.querySelector("#xp-bsky-handle").value = s.bskyHandle || "minkurosu.bsky.social";
  box.querySelector("#xp-bsky-pass").value = s.bskyPassword || "";
  box.querySelector("#xp-masto-instance").value = s.mastoInstance || "";
  box.querySelector("#xp-masto-token").value = s.mastoToken || "";
  box.querySelector("#xp-masto-vis").value = s.mastoVisibility || "public";

  box.querySelector("#xp-settings-toggle").addEventListener("click", () => {
    settingsEl.classList.toggle("open");
  });

  box.querySelector("#xp-save").addEventListener("click", () => {
    try { saveSettings({
      ...loadSettings(),
      bskyHandle: box.querySelector("#xp-bsky-handle").value.trim(),
      bskyPassword: box.querySelector("#xp-bsky-pass").value.trim(),
      mastoInstance: box.querySelector("#xp-masto-instance").value.trim(),
      mastoToken: box.querySelector("#xp-masto-token").value.trim(),
      mastoVisibility: box.querySelector("#xp-masto-vis").value,
    }); } catch (e) { setComposeStatus([`✗ ${escHtml(e.message)}`], "err"); return; }
    setComposeStatus(["✓ credenciais salvas neste navegador. a conta é conferida na hora de postar."], "ok");
    refreshMastodonLimit().then(updateXpCounter);
  });

  box.querySelector("#xp-clear").addEventListener("click", () => {
    if (!confirm("apagar as credenciais salvas neste navegador?")) return;
    saveSettings({});
    ["#xp-bsky-pass", "#xp-masto-instance", "#xp-masto-token"].forEach(sel => { box.querySelector(sel).value = ""; });
    setComposeStatus(["credenciais apagadas"], "info");
  });

  box.addEventListener("click", e => {
    if (e.target.id === "xp-retry") retryFailed();
  });

  document.getElementById("compose-submit").addEventListener("click", createPost);
  box.style.display = isAdmin ? "block" : "none";
  updateXpCounter();
}


async function syncReposts() {
  if (!isAdmin) return;
  const syncBtn = document.getElementById("xp-sync-reposts");
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = "syncing...";
  }

  let importedCount = 0;
  try {
    const s = loadSettings();
    const handle = s.bskyHandle || "minkurosu.bsky.social";
    const bskyRes = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=40`);
    if (bskyRes.ok) {
      const data = await bskyRes.json();
      const existingUrls = new Set(cachedDocs.map(d => d.data.repostUrl).filter(Boolean));
      
      for (const item of (data.feed || [])) {
        if (!item.reason || item.reason.$type !== 'app.bsky.feed.defs#reasonRepost') continue;
        const post = item.post;
        if (!post) continue;

        const rkey = post.uri.split('/').pop();
        const postUrl = `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;
        if (existingUrls.has(postUrl)) continue;

        let imageUrl = '';
        if (post.embed?.images && post.embed.images[0]) {
          imageUrl = post.embed.images[0].fullsize || post.embed.images[0].thumb || '';
        } else if (post.embed?.media?.images && post.embed.media.images[0]) {
          imageUrl = post.embed.media.images[0].fullsize || post.embed.media.images[0].thumb || '';
        }

        await addDoc(collection(db, "posts"), {
          content: post.record?.text || '',
          imageUrl,
          repostUrl: postUrl,
          repostAuthor: post.author.handle,
          type: "repost",
          source: "bluesky",
          timestamp: serverTimestamp()
        });
        existingUrls.add(postUrl);
        importedCount++;
      }
    }

    if (s.mastoInstance && s.mastoToken) {
      try {
        let base = s.mastoInstance.trim().replace(/\/+$/, '');
        if (!/^https?:\/\//.test(base)) base = `https://${base}`;
        const meRes = await fetch(`${base}/api/v1/accounts/verify_credentials`, {
          headers: { Authorization: `Bearer ${s.mastoToken.trim()}` }
        });
        if (meRes.ok) {
          const me = await meRes.json();
          const statRes = await fetch(`${base}/api/v1/accounts/${me.id}/statuses?exclude_replies=true&limit=40`, {
            headers: { Authorization: `Bearer ${s.mastoToken.trim()}` }
          });
          if (statRes.ok) {
            const statuses = await statRes.json();
            const existingUrls = new Set(cachedDocs.map(d => d.data.repostUrl).filter(Boolean));
            for (const st of statuses) {
              if (!st.reblog) continue;
              const orig = st.reblog;
              const postUrl = orig.url;
              if (!postUrl || existingUrls.has(postUrl)) continue;

              const cleanText = (orig.content || '').replace(/<[^>]+>/g, '').trim();
              const imageUrl = orig.media_attachments?.[0]?.url || '';

              await addDoc(collection(db, "posts"), {
                content: cleanText,
                imageUrl,
                repostUrl: postUrl,
                repostAuthor: orig.account?.acct || '',
                type: "repost",
                source: "mastodon",
                timestamp: serverTimestamp()
              });
              existingUrls.add(postUrl);
              importedCount++;
            }
          }
        }
      } catch (errMasto) {
        console.warn("mastodon sync error:", errMasto);
      }
    }

    if (importedCount > 0) {
      alert(`✓ ${importedCount} new repost(s) synced!`);
    } else {
      alert("no new reposts found to sync.");
    }
  } catch (err) {
    console.error("sync error:", err);
    alert(`sync error: ${err.message || err}`);
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = "🔄 sync reposts";
    }
  }
}

function injectTabs() {
  if (document.getElementById("post-tabs")) return;

  let bar = document.querySelector("#thoughts-root .bar");
  if (!bar) {
    const timeline = document.querySelector("#thoughts-root .timeline");
    if (!timeline) return;
    bar = document.createElement("div");
    bar.className = "bar";
    timeline.insertBefore(bar, timeline.firstChild);
  }

  bar.innerHTML = `
    <div class="container">
      <ul id="post-tabs">
        <li class="active" data-tab="original"><span>posts</span><strong id="count-original">0</strong></li>
        <li data-tab="reposts"><span>reposts</span><strong id="count-reposts">0</strong></li>
      </ul>
    </div>
  `;

  bar.querySelectorAll("#post-tabs li").forEach(li => {
    li.addEventListener("click", () => setActiveTab(li.dataset.tab));
  });
}

function setActiveTab(tab) {
  activeTab = tab;
  document.querySelectorAll("#post-tabs li").forEach(li => {
    li.classList.toggle("active", li.dataset.tab === tab);
  });
  renderList();
}

async function deletePost(id, liEl) {
  if (!confirm("delete this post?")) return;
  try {
    await deleteDoc(doc(db, "posts", id));
    liEl.style.transition = "opacity 0.3s";
    liEl.style.opacity = "0";
    setTimeout(() => liEl.remove(), 310);
  } catch (err) {
    console.error("error:", err);
    alert("error");
  }
}

async function saveEdit(id, newContent) {
  try {
    await updateDoc(doc(db, "posts", id), { content: newContent });
  } catch (err) {
    console.error("error:", err);
    alert("error");
  }
}

function enterEditMode(id, liEl, currentContent) {
  const infoDiv = liEl.querySelector(".info");
  const pEl = infoDiv.querySelector("p");
  if (!pEl) return;
  pEl.style.display = "none";

  const form = document.createElement("div");
  form.className = "edit-form";
  form.innerHTML = `
    <textarea class="edit-textarea"></textarea>
    <div class="edit-actions">
      <button class="edit-cancel">cancel</button>
      <button class="edit-save">save</button>
    </div>
  `;
  const textarea = form.querySelector(".edit-textarea");
  textarea.value = currentContent;

  form.querySelector(".edit-cancel").addEventListener("click", e => {
    e.stopPropagation();
    form.remove();
    pEl.style.display = "";
  });

  form.querySelector(".edit-save").addEventListener("click", async e => {
    e.stopPropagation();
    const newContent = textarea.value.trim();
    if (!newContent) return;
    await saveEdit(id, newContent);
    pEl.innerHTML = linkify(newContent);
    const embedsEl = infoDiv.querySelector(".post-embeds");
    if (embedsEl) embedsEl.innerHTML = buildEmbeds(newContent + (liEl.dataset.repostUrl ? "\n" + liEl.dataset.repostUrl : ""));
    form.remove();
    pEl.style.display = "";
  });

  infoDiv.appendChild(form);
}


function buildPostEl(id, data) {
  const li = document.createElement("li");
  li.id = "post-" + id;

  const repost = isRepost(data);
  const repostLink = safeUrl(data.repostUrl || "");
  if (repostLink) li.dataset.repostUrl = repostLink;
  const xpBadges = ["bluesky", "mastodon"].map(n => {
    const u = safeUrl(data.crossposted?.[n]?.url || "");
    return u
      ? `<a href="${escHtml(u)}" target="_blank" rel="noopener" title="also on ${n}">${n === "bluesky" ? "🦋" : "🐘"}</a>`
      : "";
  }).join("");

  const imgHtml = data.imageUrl
    ? `<img src="${escHtml(data.imageUrl)}" alt=""
         style="max-width:100%;border-radius:10px;margin-top:10px;">`
    : "";

  const isImported = data.source === "twitter";
  const importedBadge = isImported
    ? ` · <span title="imported from x" style="color:#3BB9E3;">𝕏</span>`
    : "";

  li.innerHTML = `
    <img src="imgs/site_imgs/twitteravatar.jpg" alt="avatar">
    <div class="info">
      ${repost ? `<div class="repost-label">🔁 min* reposted</div>` : ""}
      <strong>min* <span>@minkurosu · ${formatDate(data.timestamp)}${importedBadge}${xpBadges ? ` · <span class="xp-badges">${xpBadges}</span>` : ""}</span></strong>
      <p>${linkify(data.content || "")}</p>
      ${repostLink ? `<a class="repost-card" href="${escHtml(repostLink)}" target="_blank" rel="noopener">🔗 ${escHtml(shortLink(repostLink))}</a>` : ""}
      ${imgHtml}
      <div class="post-embeds">${buildEmbeds((data.content || "") + (repostLink ? "\n" + repostLink : ""))}</div>
    </div>
  `;

  if (isAdmin) {
    const menuBtn = document.createElement("button");
    menuBtn.className = "twt-menu-btn";
    menuBtn.title = "options";
    menuBtn.setAttribute("aria-label", "post options");
    menuBtn.textContent = "⋯";

    const dropdown = document.createElement("div");
    dropdown.className = "twt-dropdown";

    if (!isImported) {
      const editBtn = document.createElement("button");
      editBtn.className = "twt-dropdown-btn";
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
        </svg>
        edit post
      `;
      editBtn.style.color = "#B3B3B3";
      editBtn.addEventListener("click", e => {
        e.stopPropagation();
        dropdown.classList.remove("open");
        enterEditMode(id, li, data.content || "");
      });
      dropdown.appendChild(editBtn);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "twt-dropdown-btn";
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14H6L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>
      delete post
    `;
    deleteBtn.addEventListener("click", e => {
      e.stopPropagation();
      dropdown.classList.remove("open");
      deletePost(id, li);
    });
    dropdown.appendChild(deleteBtn);
    menuBtn.appendChild(dropdown);

    menuBtn.addEventListener("click", e => {
      e.stopPropagation();
      document.querySelectorAll(".twt-dropdown.open").forEach(d => {
        if (d !== dropdown) d.classList.remove("open");
      });
      dropdown.classList.toggle("open");
    });
    document.addEventListener("click", () => dropdown.classList.remove("open"));
    li.appendChild(menuBtn);
  }

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "post-actions";

  const likeBtn = document.createElement("span");
  likeBtn.className = "action-button";
  likeBtn.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06
               a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84
               a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  `;
  const storageKey = `liked_${id}`;
  if (localStorage.getItem(storageKey)) likeBtn.classList.add("liked");

  likeBtn.addEventListener("click", async () => {
    const alreadyLiked = likeBtn.classList.contains("liked");
    likeBtn.classList.toggle("liked");
    const delta = alreadyLiked ? -1 : 1;
    alreadyLiked
      ? localStorage.removeItem(storageKey)
      : localStorage.setItem(storageKey, "1");
    try {
      await updateDoc(doc(db, "posts", id), { likes: increment(delta) });
    } catch {
      likeBtn.classList.toggle("liked");
    }
  });
  actionsDiv.appendChild(likeBtn);

  const reactionsBox = document.createElement("div");
  reactionsBox.className = "twt-reactions-box";
  actionsDiv.appendChild(reactionsBox);

  li.querySelector(".info").appendChild(actionsDiv);

  

  li.addEventListener("click", e => {
    if (e.target.closest(
      "a, button, .twt-menu-btn, .twt-dropdown, .edit-form, input, textarea, .action-button, .twt-reactions-box, .reactions-wrapper, .reaction-picker"
    )) return;
    li.classList.toggle("expanded");
  });

  return li;
}


injectComposeBox();
injectTabs();

const container = document.getElementById("tweets-container");
let cachedDocs = [];
let activeTab = "original";
let hashHandled = false;

function visibleDocs() {
  return cachedDocs.filter(({ data }) => (activeTab === "reposts") === isRepost(data));
}

function updateTabCounts() {
  const reposts = cachedDocs.filter(({ data }) => isRepost(data)).length;
  const a = document.getElementById("count-original");
  const b = document.getElementById("count-reposts");
  if (a) a.textContent = cachedDocs.length - reposts;
  if (b) b.textContent = reposts;
}

function renderList() {
  if (!container) return;
  container.innerHTML = "";
  updateTabCounts();
  const list = visibleDocs();
  if (list.length === 0) {
    container.innerHTML = `
      <li style="justify-content:center;padding:20px;color:#667580;">
        ${activeTab === "reposts" ? "no reposts yet." : "no posts yet."}
      </li>`;
    return;
  }
  list.forEach(({ id, data }) => container.appendChild(buildPostEl(id, data)));
}

function rerenderAll() {
  if (!container || cachedDocs.length === 0) return;
  renderList();
}

// link direto para um post: ...#post-<id>
function goToHash() {
  const m = location.hash.match(/^#post-([\w-]+)$/);
  if (!m) return;
  const found = cachedDocs.find(d => d.id === m[1]);
  if (!found) return;
  const wanted = isRepost(found.data) ? "reposts" : "original";
  if (wanted !== activeTab) setActiveTab(wanted);
  const el = document.getElementById("post-" + m[1]);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("post-highlight");
  }
}
window.addEventListener("hashchange", goToHash);

if (!container) {
  console.warn("posts.js: #tweets-container not found");
} else {
  const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));

  onSnapshot(q, snapshot => {
    cachedDocs = [];
    snapshot.forEach(docSnap => {
      cachedDocs.push({ id: docSnap.id, data: docSnap.data() });
    });
    renderList();

    if (!hashHandled && cachedDocs.length) {
      hashHandled = true;
      goToHash();
    }
  }, err => {
    console.error("posts.js snapshot error:", err);
    container.innerHTML = `
      <li style="justify-content:center;padding:20px;color:#bf6a6a;">
        error loading posts.
      </li>`;
  });
}