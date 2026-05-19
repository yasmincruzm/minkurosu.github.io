// ... (outras importações e a constante FIREBASE_CONFIG)

// Importações de React e Firebase
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA8-Ab2dE48sVOhmT-HfxIL5_rzDMRdcCc",
    authDomain: "minkurosu.firebaseapp.com",
    projectId: "minkurosu",
    storageBucket: "minkurosu.firebasestorage.app",
    messagingSenderId: "290821725607",
    appId: "1:290821725607:web:5e39e561da53ac7c8a2a82",
    measurementId: "G-M7PWC6DDRH" 
};

const OWNER_USER_ID = "SKRZj0yyBuZfmQKwlWYKup0K93q2"; 


const App = () => {
   
    const [db, setDb] = useState(null); 
    const [auth, setAuth] = useState(null); 
    const [userId, setUserId] = useState(null); 
    const [blogPosts, setBlogPosts] = useState([]); 
    const [currentView, setCurrentView] = useState('list'); 
    const [message, setMessage] = useState(''); 


    useEffect(() => {
        try {
            
            const app = initializeApp(FIREBASE_CONFIG);
            const firestore = getFirestore(app);
            const authentication = getAuth(app);

          
            setDb(firestore);
            setAuth(authentication);

           
            const unsubscribeAuth = onAuthStateChanged(authentication, async (user) => {
                if (user) {
                    
                    setUserId(user.uid);
                    console.log('usuário logado (do console.log de depuração):', user.uid); 
                } else {
                    
                    try {
                        await signInAnonymously(authentication);
                        console.log('logado anonimamente.');
                    } catch (error) {
                        console.error("erro durante a autenticação:", error);
                        setMessage("falha na autenticação. Por favor, tente novamente.");
                    }
                }
            });

          
            return () => unsubscribeAuth();
        } catch (error) {
            console.error("falha ao inicializar o firebase:", error);
            setMessage("falha ao inicializar o aplicativo. verifique o console");
        }
    }, []); 

   
    useEffect(() => {
       
        if (db && userId) {
           
            const blogPostsCollectionRef = collection(db, `artifacts/${FIREBASE_CONFIG.appId}/public/data/blogPosts`);
           
            const q = query(blogPostsCollectionRef, orderBy('timestamp', 'desc'));

           
            const unsubscribe = onSnapshot(q, (snapshot) => {
                
                const posts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setBlogPosts(posts); 
            }, (error) => {
                console.error("erro ao buscar posts:", error);
                setMessage("erro ao carregar posts. ");
            });

           
            return () => unsubscribe();
        }
    }, [db, userId]); 

 

    return (
        <div>
            <h1>meu blog</h1>
            {message && <p style={{ color: 'red' }}>{message}</p>}
            {}
            {currentView === 'list' && (
                <div>
                    <h2>posts</h2>
                    {blogPosts.length > 0 ? (
                        <ul>
                            {blogPosts.map(post => (
                                <li key={post.id}>
                                    <h3>{post.title}</h3>
                                    <p>{post.content}</p>
                                    <small>{new Date(post.timestamp?.toDate()).toLocaleString()}</small>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>Nenhum post encontrado.</p>
                    )}
                    <button onClick={() => setCurrentView('newPost')}>Criar Novo Post</button>
                </div>
            )}

            {currentView === 'newPost' && (
                <NewPostForm
                    db={db}
                    userId={userId}
                    ownerUserId={OWNER_USER_ID}
                    appId={FIREBASE_CONFIG.appId}
                    onPostAdded={() => {
                        setMessage("post adicionado!");
                        setCurrentView('list');
                    }}
                    onCancel={() => setCurrentView('list')}
                    onError={(msg) => setMessage(msg)}
                />
            )}
        </div>
    );
};


const NewPostForm = ({ db, userId, ownerUserId, appId, onPostAdded, onCancel, onError }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!db || !userId) {
            onError("banco de dados ou ID de usuário não disponíveis.");
            return;
        }

        if (userId !== ownerUserId) {
            onError("você não tem permissão para adicionar posts.");
            return;
        }

        try {
            await addDoc(collection(db, `artifacts/${appId}/public/data/blogPosts`), {
                title,
                content,
                timestamp: new Date(),
                authorId: userId 
            });
            onPostAdded();
            setTitle('');
            setContent('');
        } catch (error) {
            console.error("erro ao adicionar post:", error);
            onError("erro ao adicionar post. ");
        }
    };

    return (
        <div>
            <h2>Novo Post</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>título:</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>conteúdo:</label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        required
                    ></textarea>
                </div>
                <button type="submit">adicionar post</button>
                <button type="button" onClick={onCancel}>cancelar</button>
            </form>
        </div>
    );
};

export default App;