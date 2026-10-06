
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto-id",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "123456789",
    appId: "sua-app-id"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


export { db, collection, addDoc, getDocs, query, orderBy, limit };


< !--Google tag(gtag.js)-- >
<script async src="https://www.googletagmanager.com/gtag/js?id=G-DT4FG20QMR"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-DT4FG20QMR');
</script>
