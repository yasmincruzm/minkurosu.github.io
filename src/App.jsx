// app.jsx

// Importações necessárias para um componente React
import React, { useState, useEffect, useRef } from 'react';

// 1. Importar as instâncias do Firebase que você exportou de firebase-init.js
// Certifique-se de que o caminho './firebase-init.js' está correto
// e que 'auth', 'db', 'storage' e FIREBASE_CONFIG estão realmente sendo exportados lá.
import { auth, db, storage, FIREBASE_CONFIG } from './firebase-init.js'; // <-- Adicionado FIREBASE_CONFIG aqui

// Importar funções específicas do Firebase que serão usadas no App.js
// Agora importamos do pacote 'firebase/auth' e 'firebase/firestore' diretamente
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';


// ** ATENÇÃO: PASSO CRÍTICO! PREENCHA COM O SEU PRÓPRIO USER ID (UID) DO FIREBASE **
// Você encontrará este ID exibido na tela do seu blog após o primeiro deploy com FIREBASE_CONFIG.
const OWNER_USER_ID = "IjZOQYPyoqTqr89SrZVqJ9RjVN23"; // EX: "k4j2h1l3kj4h2l3kj4h2l3kj4h2l3kj4h2l3k"


// Componente principal da aplicação
const App = () => {
    // Estados para gerenciar o usuário, posts e visualização
    const [userId, setUserId] = useState(null); // ID do usuário atualmente logado
    const [blogPosts, setBlogPosts] = useState([]); // Array de posts do blog
    const [currentView, setCurrentView] = useState('list'); // Controla qual tela é exibida: 'list' (lista de posts) ou 'newPost' (formulário de novo post)
    const [message, setMessage] = useState(''); // Mensagens para o usuário (sucesso/erro)

    // Efeito para configurar a autenticação e obter o userId
    useEffect(() => {
        // Verifica se a instância 'auth' foi importada e está disponível
        if (!auth) {
            setMessage("Erro: Serviço de autenticação do Firebase não disponível.");
            console.error("Auth instance is null or undefined.");
            return;
        }

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                console.log('Usuário logado (do console.log de depuração):', user.uid);
            } else {
                try {
                    await signInAnonymously(auth);
                    console.log('Logado anonimamente.');
                } catch (error) {
                    console.error("Erro durante a autenticação anônima:", error);
                    setMessage("Falha na autenticação. Por favor, tente novamente.");
                }
            }
        });

        // Função de limpeza para o listener de autenticação
        return () => unsubscribeAuth();
    }, []); // Este efeito roda apenas uma vez na montagem do componente

    // Efeito para buscar posts do blog do Firestore
    useEffect(() => {
        // Só busca se a instância 'db' e o 'userId' estiverem disponíveis
        if (!db) {
            setMessage("Erro: Serviço de banco de dados do Firebase não disponível.");
            console.error("Firestore instance is null or undefined.");
            return;
        }

        if (userId) { // A busca de posts depende de o usuário estar logado (mesmo que anonimamente)
            // Define o caminho da coleção para dados públicos
            // Agora usamos FIREBASE_CONFIG.appId que foi importado
            const blogPostsCollectionRef = collection(db, `artifacts/${FIREBASE_CONFIG.appId}/public/data/blogPosts`);

            // Cria uma query para ordenar os posts por data, do mais novo para o mais antigo
            const q = query(blogPostsCollectionRef, orderBy('timestamp', 'desc'));

            // Configura um listener em tempo real para os posts do blog
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const posts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    // Converte o timestamp do Firestore para um objeto Date se for um Timestamp do Firebase
                    timestamp: doc.data().timestamp instanceof Timestamp ? doc.data().timestamp.toDate() : doc.data().timestamp
                }));
                setBlogPosts(posts); // Atualiza o estado com os posts
            }, (error) => {
                console.error("Erro ao buscar posts:", error);
                setMessage("Erro ao carregar posts. Por favor, tente novamente.");
            });

            // Função de limpeza para o listener de snapshot
            return () => unsubscribe();
        }
    }, [db, userId]); // Este efeito roda quando db ou userId mudam

    return (
        <div>
            <h1>Meu Blog Simples</h1>
            {message && <p style={{ color: 'red' }}>{message}</p>}

            {currentView === 'list' && (
                <div>
                    <h2>Lista de Posts</h2>
                    {blogPosts.length > 0 ? (
                        <ul>
                            {blogPosts.map(post => (
                                <li key={post.id}>
                                    <h3>{post.title}</h3>
                                    <p>{post.content}</p>
                                    {/* Exibe a data formatada, garantindo que timestamp seja um objeto Date */}
                                    <small>Publicado em: {post.timestamp ? new Date(post.timestamp).toLocaleString() : 'Data desconhecida'}</small>
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
                    appId={FIREBASE_CONFIG.appId} // <-- Passando o appId do FIREBASE_CONFIG importado
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

// Componente para o formulário de novo post
const NewPostForm = ({ db, userId, ownerUserId, appId, onPostAdded, onCancel, onError }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!db || !userId) {
            onError("Banco de dados ou ID de usuário não disponíveis.");
            return;
        }

        // Apenas o OWNER_USER_ID pode adicionar posts
        if (userId !== ownerUserId) {
            onError("Você não tem permissão para adicionar posts. Verifique seu OWNER_USER_ID.");
            return;
        }

        try {
            await addDoc(collection(db, `artifacts/${appId}/public/data/blogPosts`), {
                title,
                content,
                timestamp: Timestamp.now(), // Usar Timestamp.now() para melhor compatibilidade com Firestore
                authorId: userId
            });
            onPostAdded();
            setTitle('');
            setContent('');
        } catch (error) {
            console.error("Erro ao adicionar post:", error);
            onError("Erro ao adicionar post. Por favor, tente novamente.");
        }
    };

    return (
        <div>
            <h2>Novo Post</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Título:</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Conteúdo:</label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        required
                    ></textarea>
                </div>
                <button type="submit">Adicionar Post</button>
                <button type="button" onClick={onCancel}>Cancelar</button>
            </form>
        </div>
    );
};

export default App;