// firebase-init.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// ** SEU OBJETO DE CONFIGURAÇÃO DO FIREBASE **
const FIREBASE_CONFIG = { // <<-- A CONSTANTE É DEFINIDA COMO FIREBASE_CONFIG
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
    measurementId: "G-M7PWC6DDRH"
};

// Inicializa o Firebase
const app = initializeApp(FIREBASE_CONFIG);

// Obtém as instâncias dos serviços
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Exporta as instâncias e o config para serem usados em outros arquivos
export { auth, db, storage, FIREBASE_CONFIG };