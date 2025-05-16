import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function saveMeme(memeData) {
  try {
    const docRef = await addDoc(collection(db, "memes"), {
      ...memeData,
      createdAt: new Date().toISOString(),
      likes: 0,
      views: 0,
      likedBy: [],
      isPublic: true,
    });
    return docRef.id;
  } catch (error) {
    console.error("Error saving meme:", error);
    throw error;
  }
}

export async function getAllMemes() {
  const q = query(collection(db, "memes"), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getUserMemes(userId) {
  const q = query(
    collection(db, "memes"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getTrendingMemes(limitCount = 10) {
  const q = query(
    collection(db, "memes"),
    orderBy("likes", "desc"),
    limit(limitCount)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function likeMeme(memeId, userId) {
  const memeRef = doc(db, "memes", memeId);
  const memeSnap = await getDoc(memeRef);

  if (memeSnap.exists() && memeSnap.data().likedBy.includes(userId)) {
    throw new Error("You've already liked this meme");
  }

  await updateDoc(memeRef, {
    likes: increment(1),
    likedBy: arrayUnion(userId),
  });
}

export async function unlikeMeme(memeId, userId) {
  const memeRef = doc(db, "memes", memeId);
  await updateDoc(memeRef, {
    likes: increment(-1),
    likedBy: arrayRemove(userId),
  });
}
