import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { renderContent } from './embed.js';

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
const db  = getFirestore(app);
const blogPostsContainer = document.getElementById('posts-container');

function formatTimestamp(ts) {
  if (!ts?.toDate) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(ts.toDate());
}

function buildPostElement(post, id) {
  const el = document.createElement('article');
  el.classList.add('blog-post');
  el.innerHTML = `
    <h2>${post.title || ''}</h2>
    <p class="post-meta">published on ${formatTimestamp(post.timestamp)}</p>
    <div class="post-content">${renderContent(post.content || '')}</div>
    <hr class="post-divider">
  `;
  return el;
}

async function loadBlogPosts() {
  if (!blogPostsContainer) return;
  blogPostsContainer.innerHTML = '<p>loading...</p>';
  try {
    const q = query(collection(db, 'blog_posts'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    if (snapshot.empty) { blogPostsContainer.innerHTML = '<p>no posts yet.</p>'; return; }
    blogPostsContainer.innerHTML = '';
    snapshot.forEach(d => blogPostsContainer.appendChild(buildPostElement(d.data(), d.id)));
  } catch (e) {
    console.error(e);
    blogPostsContainer.innerHTML = '<p>error loading posts.</p>';
  }
}

document.addEventListener('DOMContentLoaded', loadBlogPosts);
