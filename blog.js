import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { mountReactions } from './reactions.js';

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
const blogPostsContainer = document.getElementById('posts-container');

function formatTimestamp(timestamp) {
    if (!timestamp?.toDate) return 'Data Indisponível';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(timestamp.toDate());
}

function buildPostElement(post, id) {
    const el = document.createElement('article');
    el.classList.add('blog-post');
    el.innerHTML = `
        <h2>${post.title}</h2>
        <p class="post-meta">Publicado em ${formatTimestamp(post.timestamp)}</p>
        ${post.imageUrl ? `<img src="${post.imageUrl}" alt="${post.title}">` : ''}
        <div class="post-content">${post.content}</div>
        <hr class="post-divider">
    `;

    const reactBox = document.createElement('div');
    reactBox.className = 'blog-reactions-box';
    reactBox.style.cssText = 'margin-top: 14px; margin-bottom: 8px;';
    el.insertBefore(reactBox, el.querySelector('.post-divider'));

    const targetId = 'blog_' + String(post.title || id).toLowerCase().replace(/[^a-z0-9]/g, '_');
    mountReactions(reactBox, { targetId });

    return el;
}

async function loadBlogPosts() {
    if (!blogPostsContainer) {
        console.error("Elemento 'posts-container' não encontrado no HTML.");
        return;
    }
    blogPostsContainer.innerHTML = '<h2>Carregando posts...</h2>';

    try {
        const q = query(collection(db, 'blog_posts'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            blogPostsContainer.innerHTML = '<p>nenhum post de blog encontrado ainda.</p>';
            return;
        }

        blogPostsContainer.innerHTML = '';
        snapshot.forEach(docSnap => {
            blogPostsContainer.appendChild(buildPostElement(docSnap.data(), docSnap.id));
        });
    } catch (e) {
        console.error('error: ', e);
        blogPostsContainer.innerHTML = '<p>error.</p>';
    }
}

document.addEventListener('DOMContentLoaded', loadBlogPosts);
