// app.js

import React, { useState, useEffect, useRef } from 'react';

import { auth, db, storage } from './firebase-init.js';

import { signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const OWNER_USER_ID = "SKRZj0yyBuZfmQKwlWYKup0K93q2"; 




const App = () => {
    
    const [userId, setUserId] = useState(null); 
    const [blogPosts, setBlogPosts] = useState([]); 
    const [currentView, setCurrentView] = useState('list'); 
    const [message, setMessage] = useState(''); 

    useEffect(() => {
       
        if (!auth) {
            setMessage("error.");
            console.error("Auth instance is null or undefined.");
            return;
        }

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                console.log('error):', user.uid);
            } else {
                try {
                    await signInAnonymously(auth);
                    console.log('logged');
                } catch (error) {
                    console.error("error:", error);
                    setMessage("error.");
                }
            }
        });

       
        return () => unsubscribeAuth();
    }, []); 

    useEffect(() => {
       
        if (!db) {
            setMessage("error");
            console.error("error");
            return;
        }

        if (userId) { 
            const FIREBASE_CONFIG_LOCAL = { appId: "1:290821725607:web:5e39e561da53ac7c8a2a82" }; 
            const blogPostsCollectionRef = collection(db, `artifacts/${FIREBASE_CONFIG_LOCAL.appId}/public/data/blogPosts`);

           
            const q = query(blogPostsCollectionRef, orderBy('timestamp', 'desc'));

           
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const posts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                   
                    timestamp: doc.data().timestamp instanceof Timestamp ? doc.data().timestamp.toDate() : doc.data().timestamp
                }));
                setBlogPosts(posts); 
            }, (error) => {
                console.error("Erro ao buscar posts:", error);
                setMessage("Erro ao carregar posts. Por favor, tente novamente.");
            });

          
            return () => unsubscribe();
        }
    }, [db, userId]); 

    return (
        <div>
            <h1>meu blog</h1>
            {message && <p style={{ color: 'red' }}>{message}</p>}

            {currentView === 'list' && (
                <div>
                    <h2>lista de posts</h2>
                    {blogPosts.length > 0 ? (
                        <ul>
                            {blogPosts.map(post => (
                                <li key={post.id}>
                                    <h3>{post.title}</h3>
                                    <p>{post.content}</p>
                                    {}
                                    <small>publicado em: {post.timestamp ? new Date(post.timestamp).toLocaleString() : 'Data desconhecida'}</small>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>nenhum post encontrado.</p>
                    )}
                    <button onClick={() => setCurrentView('newPost')}>Criar Novo Post</button>
                </div>
            )}

            {currentView === 'newPost' && (
                <NewPostForm
                    db={db}
                    userId={userId}
                    ownerUserId={OWNER_USER_ID}
                    appId={("1:290821725607:web:5e39e561da53ac7c8a2a82")} 
                    onPostAdded={() => {
                        setMessage("Post adicionado com sucesso!");
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
            onError("error");
            return;
        }

        if (userId !== ownerUserId) {
            onError("error");
            return;
        }

        try {
            await addDoc(collection(db, `artifacts/${appId}/public/data/blogPosts`), {
                title,
                content,
                timestamp: Timestamp.now(), 
                authorId: userId
            });
            onPostAdded();
            setTitle('');
            setContent('');
        } catch (error) {
            console.error("error:", error);
            onError("error");
        }
    };

    return (
        <div>
            <h2>Novo Post</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>titulo:</label>
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
                <button type="submit">post</button>
                <button type="button" onClick={onCancel}>cancel</button>
            </form>
        </div>
    );
};

export default App;