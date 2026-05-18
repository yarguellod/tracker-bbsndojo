import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDJ7F_M5QO3WVPLGRqhpUi91hNJzY3UK_4",
  authDomain: "tracker-bbsndojo.firebaseapp.com",
  projectId: "tracker-bbsndojo",
  storageBucket: "tracker-bbsndojo.firebasestorage.app",
  messagingSenderId: "724820423311",
  appId: "1:724820423311:web:f39517c3f415ba2eaf36fa",
  measurementId: "G-GCNQL18N5X"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
