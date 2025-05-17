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
  getDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function saveMeme(memeData) {
  try {
    const docRef = await addDoc(collection(db, "memes"), {
      ...memeData,
      createdAt: serverTimestamp(),
      likes: 0,
      views: 0,
      likedBy: [],
      dislikedBy: [],
      commentCount: 0,
      reports: 0,
      lowercaseTags: memeData.tags?.map((tag) => tag.toLowerCase()) || [],
    });

    // Update user stats
    const userRef = doc(db, "users", memeData.userId);
    await updateDoc(userRef, {
      memeCount: increment(1),
      lastMemeCreated: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Error saving meme:", error);
    throw error;
  }
}

export async function getMemes(filter = "new", searchQuery = "") {
  const memesRef = collection(db, "memes");
  let q;

  switch (filter) {
    case "top-24h":
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      q = query(
        memesRef,
        where("createdAt", ">", yesterday),
        orderBy("createdAt", "desc"),
        orderBy("likes", "desc")
      );
      break;

    case "top-week":
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      q = query(
        memesRef,
        where("createdAt", ">", lastWeek),
        orderBy("createdAt", "desc"),
        orderBy("likes", "desc")
      );
      break;

    case "top-all":
      q = query(memesRef, orderBy("likes", "desc"));
      break;

    case "new":
    default:
      q = query(memesRef, orderBy("createdAt", "desc"));
  }

  const querySnapshot = await getDocs(q);
  let memes = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Apply search if provided
  if (searchQuery) {
    const searchTerm = searchQuery.toLowerCase();
    memes = memes.filter(
      (meme) =>
        meme.title?.toLowerCase().includes(searchTerm) ||
        meme.tags?.some((tag) => tag.toLowerCase().includes(searchTerm))
    );
  }

  return memes;
}

export async function getMemeComments(memeId, limitCount = 3) {
  const q = query(
    collection(db, `memes/${memeId}/comments`),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

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

export async function likeMeme(memeId, userId) {
  const memeRef = doc(db, "memes", memeId);
  const userRef = doc(db, "users", userId);

  // Check if already liked
  const memeSnap = await getDoc(memeRef);
  if (memeSnap.data().likedBy?.includes(userId)) {
    throw new Error("You've already liked this meme");
  }

  await Promise.all([
    updateDoc(memeRef, {
      likes: increment(1),
      likedBy: arrayUnion(userId),
      dislikedBy: arrayRemove(userId),
    }),
    updateDoc(userRef, {
      totalLikes: increment(1),
    }),
  ]);
}

export async function dislikeMeme(memeId, userId) {
  const memeRef = doc(db, "memes", memeId);
  const userRef = doc(db, "users", userId);

  // Check if already disliked
  const memeSnap = await getDoc(memeRef);
  if (memeSnap.data().dislikedBy?.includes(userId)) {
    throw new Error("You've already disliked this meme");
  }

  await Promise.all([
    updateDoc(memeRef, {
      likes: increment(-1),
      dislikedBy: arrayUnion(userId),
      likedBy: arrayRemove(userId),
    }),
    updateDoc(userRef, {
      totalLikes: increment(-1),
    }),
  ]);
}

export async function addComment(memeId, comment) {
  const commentsRef = collection(db, `memes/${memeId}/comments`);

  // Add comment to subcollection
  const docRef = await addDoc(commentsRef, {
    text: comment.text,
    author: comment.author,
    authorId: comment.authorId || null,
    createdAt: serverTimestamp(),
  });

  // Update comment count in meme document
  const memeRef = doc(db, "memes", memeId);
  await updateDoc(memeRef, {
    commentCount: increment(1),
  });

  return docRef.id;
}

export async function reportMeme(memeId, userId, reason) {
  const batch = writeBatch(db);

  // Add report
  const reportRef = doc(collection(db, "reports"));
  batch.set(reportRef, {
    memeId,
    userId,
    reason,
    createdAt: serverTimestamp(),
    status: "pending",
  });

  // Also increment report count on meme
  const memeRef = doc(db, "memes", memeId);
  batch.update(memeRef, {
    reports: increment(1),
  });

  await batch.commit();
}

export async function getMemeById(memeId) {
  const memeRef = doc(db, "memes", memeId);
  const memeSnap = await getDoc(memeRef);
  return memeSnap.exists() ? { id: memeSnap.id, ...memeSnap.data() } : null;
}

export async function searchMemesByTag(tag) {
  const q = query(
    collection(db, "memes"),
    where("lowercaseTags", "array-contains", tag.toLowerCase()),
    orderBy("createdAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getTopCreators(limitCount = 3) {
  const q = query(
    collection(db, "users"),
    orderBy("totalLikes", "desc"),
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
