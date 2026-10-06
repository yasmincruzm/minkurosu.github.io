
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
const auth = getAuth(app);
const db = getFirestore(app);


const firebaseConfig = {
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
    measurementId: "G-M7PWC6DDRH"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const passwordForm = document.getElementById('password-form');
const passwordInput = document.getElementById('password-input');
const passwordMessage = document.getElementById('password-message');
const privateEntriesDisplay = document.getElementById('private-entries-display');
const CORRECT_PASSWORD = "hopelessnightmare";

function formatTimestampForTitle(timestamp) {
    if (!timestamp || !timestamp.toDate) return '';
    const date = timestamp.toDate();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function showPasswordMessage(message, type) {
    passwordMessage.textContent = message;
    passwordMessage.style.color = type === 'error' ? 'red' : 'green';
}

async function loadPrivateEntries() {
    if (!privateEntriesDisplay) {
        console.error("Elemento 'private-entries-display' não encontrado.");
        return;
    }

    try {
        privateEntriesDisplay.innerHTML = '<h2></h2>';

        const entriesQuery = query(collection(db, 'private_entries'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(entriesQuery);

        privateEntriesDisplay.innerHTML = '';

        if (querySnapshot.empty) {
            privateEntriesDisplay.innerHTML = '<h2></h2>';
            return;
        }

        let entryNumber = querySnapshot.size;

        querySnapshot.forEach(doc => {
            const entry = doc.data();
            const entryElement = document.createElement('div');
            entryElement.classList.add('blog-post');

            const formattedDate = formatTimestampForTitle(entry.timestamp);
            const title = `Entrada Privada n° ${String(entryNumber).padStart(3, '0')} - ${formattedDate}`;

            entryElement.innerHTML = `
               <h1>${title}</h1>
               <p>${entry.content.replace(/\n/g, '<br>')}</p>
               <hr class="post-divider">
            `;
            privateEntriesDisplay.appendChild(entryElement);
            entryNumber--;
        });
    } catch (error) {
        console.error("Erro ao carregar entradas privadas:", error);
        privateEntriesDisplay.innerHTML = '<p style="color: red;">.</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (passwordForm && privateEntriesDisplay) {

        privateEntriesDisplay.style.display = 'none';

        passwordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const enteredPassword = passwordInput.value.trim();

            if (enteredPassword === CORRECT_PASSWORD) {
                showPasswordMessage(passwordMessage, 'loading', 'success');
                passwordForm.style.display = 'none';
                privateEntriesDisplay.style.display = 'block';
                loadPrivateEntries();
            } else {
                showPasswordMessage(passwordMessage, 'wrong pass', 'error');
                passwordInput.value = '';
            }
        });
    } else {
        console.error("");

    }
});