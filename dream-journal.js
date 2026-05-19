
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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

function formatTimestampForTitle(timestamp) {
    if (!timestamp) return 'Date Unavailable';
    const date = timestamp.toDate();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}/${month}/${year}`;
}

async function loadDreams() {
    const dreamsContainer = document.getElementById('dreams-container');
    if (!dreamsContainer) {
        console.error("O container de sonhos ('dreams-container') não foi encontrado no momento da execução.");
        return;
    }

    try {
        const dreamsQuery = query(collection(db, 'dreams'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(dreamsQuery);

        dreamsContainer.innerHTML = ''; 

        if (querySnapshot.empty) {
            dreamsContainer.innerHTML = '<h2>Nenhum sonho registrado ainda.</h2>';
            return;
        }

        let dreamNumber = querySnapshot.size; 

        querySnapshot.forEach(doc => {
            const dream = doc.data();
            const dreamElement = document.createElement('div');
            dreamElement.classList.add('blog-post');

            const formattedDate = formatTimestampForTitle(dream.timestamp);
            const title = `Sonho n° ${String(dreamNumber).padStart(3, '0')} - ${formattedDate}`;

            dreamElement.innerHTML = `
               <h1>${title}</h1>
               <p>${dream.content.replace(/\\n/g, '<br>')}</p>
               <hr class="post-divider">
            `;
            dreamsContainer.appendChild(dreamElement);
            dreamNumber--; 
        });
    } catch (error) {
        console.error("Erro ao carregar os sonhos:", error);
        if (dreamsContainer) {
            dreamsContainer.innerHTML = '<p style="color: red;">Ocorreu um erro ao carregar os sonhos.</p>';
        }
    }
}

function initializeDreamLoader() {
    const container = document.getElementById('dreams-container');
    if (container) {
        loadDreams();
    } else {
        setTimeout(initializeDreamLoader, 100);
    }
}

initializeDreamLoader();
