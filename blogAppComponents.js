
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


const OWNER_USER_ID = "SEU_OWN_FIREBASE_USER_ID_AQUI"; 


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
                    console.log('Usuário logado (do console.log de depuração):', user.uid); 
                } else {
                    
                    try {
                        await signInAnonymously(authentication);
                        console.log('logado anonimamente.');
                    } catch (error) {
                        console.error("erro durante a autenticação:", error);
                        setMessage("falha na autenticação. por favor, tente novamente.");
                    }
                }
            });

     
            return () => unsubscribeAuth();
        } catch (error) {
            console.error("falha ao inicializar o firebase:", error);
            setMessage("falha ao inicializar o aplicativo.");
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
                console.error("erro ao buscar posts do blog:", error);
                setMessage("falha ao carregar os posts do blog.");
            });

           
            return () => unsubscribe();
        }
    }, [db, userId]);

    const BlogList = () => {
        return (
            <div className="p-4 sm:p-6 md:p-8 flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter rounded-lg shadow-lg">
                <h1 className="text-4xl sm:text-5xl font-bold mb-8 text-center">Meus Posts do Blog</h1>
                {}
                {message && (
                    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-md relative mb-4 w-full max-w-2xl" role="alert">
                        <span className="block sm:inline">{message}</span>
                        {}
                        <span className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onClick={() => setMessage('')}>
                            <svg className="fill-current h-6 w-6 text-blue-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Fechar</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.103l-2.651 3.746a1.2 1.2 0 1 1-1.697-1.697l3.746-2.651-3.746-2.651a1.2 1.2 0 0 1 1.697-1.697L10 8.897l2.651-3.746a1.2 1.2 0 0 1 1.697 1.697L11.103 10l3.746 2.651a1.2 1.2 0 0 1 0 1.698z"/></svg>
                        </span>
                    </div>
                )}

                {}
                {userId && (
                    <div className="bg-gray-200 dark:bg-gray-800 p-3 rounded-md shadow-md mb-6 w-full max-w-2xl text-center text-sm">
                        ID de usuário: <span className="font-mono text-blue-600 dark:text-blue-400 break-all">{userId}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 w-full max-w-2xl">
                    {blogPosts.length === 0 ? (
                      
                        <p className="text-center text-lg text-gray-600 dark:text-gray-400">Nenhum post no blog ainda. Comece criando um!</p>
                    ) : (
                      
                        blogPosts.map(post => (
                            <div key={post.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
                                <h2 className="text-2xl font-semibold mb-2 text-blue-700 dark:text-blue-400">{post.title}</h2>
                                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4 whitespace-pre-wrap">{post.content}</p>
                                <div className="text-sm text-gray-500 dark:text-gray-400 flex justify-between items-center">
                                    <span>Por {post.author || 'Anônimo'}</span>
                                    <span>{new Date(post.timestamp?.toDate()).toLocaleString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

   
    const NewPost = ({ userId, db, setMessage, setCurrentView }) => {
        const [title, setTitle] = useState('');
        const [content, setContent] = useState('');
        const [submitting, setSubmitting] = useState(false); 

       
        const handleSubmit = async (e) => {
            e.preventDefault(); /
            if (!db || !userId) {
                setMessage("banco de dados não pronto. por favor, aguarde um momento e tente novamente.");
                return;
            }
            if (!title.trim() || !content.trim()) {
                setMessage("por favor, preencha o título e o conteúdo.");
                return;
            }

            if (userId !== OWNER_USER_ID) {
                setMessage("você não tem permissão para adicionar posts. Apenas o proprietário do blog pode postar.");
                return;
            }

            setSubmitting(true); 
            setMessage(''); 

            try {
              
                const blogPostsCollectionRef = collection(db, `artifacts/${FIREBASE_CONFIG.appId}/public/data/blogPosts`);
                await addDoc(blogPostsCollectionRef, {
                    title: title.trim(),
                    content: content.trim(),
                    author: userId, 
                    timestamp: new Date(), 
                });
                setMessage("post do blog adicionado com sucesso!");
                setTitle(''); 
                setContent(''); 
                setCurrentView('list'); 
            } catch (error) {
                console.error("erro ao adicionar documento: ", error);
                setMessage("falha ao adicionar post do blog: " + error.message);
            } finally {
                setSubmitting(false); 
            }
        };

        return (
            <div className="p-4 sm:p-6 md:p-8 flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter rounded-lg shadow-lg">
                <h1 className="text-4xl sm:text-5xl font-bold mb-8 text-center">Escrever Novo Post do Blog</h1>
                {message && (
                    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-md relative mb-4 w-full max-w-2xl" role="alert">
                        <span className="block sm:inline">{message}</span>
                        <span className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onClick={() => setMessage('')}>
                            <svg className="fill-current h-6 w-6 text-blue-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Fechar</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.103l-2.651 3.746a1.2 1.2 0 1 1-1.697-1.697l3.746-2.651-3.746-2.651a1.2 1.2 0 0 1 1.697-1.697L10 8.897l2.651-3.746a1.2 1.2 0 0 1 1.697 1.697L11.103 10l3.746 2.651a1.2 1.2 0 0 1 0 1.698z"/></svg>
                        </span>
                    </div>
                )}

                {}
                <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <div className="mb-4">
                        <label htmlFor="title" className="block text-gray-700 dark:text-gray-300 text-lg font-medium mb-2">Título</label>
                        <input
                            type="text"
                            id="title"
                            className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-md w-full py-3 px-4 text-gray-700 dark:text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            disabled={submitting}
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="content" className="block text-gray-700 dark:text-gray-300 text-lg font-medium mb-2">Conteúdo</label>
                        <textarea
                            id="content"
                            rows="10"
                            className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-md w-full py-3 px-4 text-gray-700 dark:text-gray-200 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 resize-y"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            required
                            disabled={submitting}
                        ></textarea>
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md focus:outline-none focus:shadow-outline transition duration-200 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={submitting}
                    >
                        {submitting ? 'Enviando...' : 'Enviar Post'}
                    </button>
                </form>
            </div>
        );
    };

    
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            {}
            <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-center sticky top-0 z-10 rounded-b-lg">
                <nav className="flex space-x-4">
                    <button
                        onClick={() => setCurrentView('list')} 
                        className={`py-2 px-4 rounded-md text-lg font-medium transition duration-300 ease-in-out ${
                            currentView === 'list'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900'
                        }`}
                    >
                        Ver Posts do Blog
                    </button>
                    <button
                        onClick={() => setCurrentView('newPost')} 
                        className={`py-2 px-4 rounded-md text-lg font-medium transition duration-300 ease-in-out ${
                            currentView === 'newPost'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900'
                        }`}
                    >
                        Escrever Novo Post
                    </button>
                </nav>
            </header>

            {}
            <main className="container mx-auto p-4">
                {(() => {
                    switch (currentView) {
                        case 'list':
                            return <BlogList />;
                        case 'newPost':
                           
                            return <NewPost
                                db={db}
                                userId={userId}
                                setMessage={setMessage}
                                setCurrentView={setCurrentView}
                            />;
                        default:
                            return <BlogList />; 
                    }
                })()}
            </main>
        </div>
    );
};

export default App; 
