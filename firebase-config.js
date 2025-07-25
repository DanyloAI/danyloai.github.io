// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Your web app's Firebase configuration
// Make sure to replace these with your actual config from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBC6Sj4oT8gA2wCcbFRKjGPSEHLsgsQZqM",
  authDomain: "danai-48214.firebaseapp.com",
  projectId: "danai-48214",
  storageBucket: "danai-48214.firebasestorage.app",
  messagingSenderId: "1095700919083",
  appId: "1:1095700919083:web:e11ed30bb07819264ccb6e",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };