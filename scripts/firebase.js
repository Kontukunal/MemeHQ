// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1U2njOXHOiah16fWS9MKWmMhF0aoa7Ao",
  authDomain: "memehq-d7183.firebaseapp.com",
  projectId: "memehq-d7183",
  storageBucket: "memehq-d7183.appspot.com",
  messagingSenderId: "415135722489",
  appId: "1:415135722489:web:3cd02ba00955b9f3062b28",
  measurementId: "G-027L0X2XJE",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize Firestore with the new persistence API (recommended approach)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});
export { auth, db };