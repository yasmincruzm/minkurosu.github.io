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

import { mountReactions, setReactionsAdmin } from './reactions.js';


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
  setReactionsAdmin(isAdmin);
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
    overflow: hidden;
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
  #thoughts-root #tweets-container li:hover { background-color: #202020;