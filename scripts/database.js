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
  deleteDoc,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth } from "./firebase.js";

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

export async function getTopCreators(period = "day") {
  try {
    const memesRef = collection(db, "memes");

    // Get the timestamp for the start of the period
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case "day":
        startDate.setDate(now.getDate() - 1);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "all":
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Get all memes in the time period
    const memesQuery = query(
      memesRef,
      where("createdAt", ">=", startDate),
      orderBy("createdAt", "desc")
    );
    const memesSnapshot = await getDocs(memesQuery);

    // Calculate creator stats
    const creatorStats = {};
    memesSnapshot.forEach((doc) => {
      const meme = doc.data();
      const creatorId = meme.userId;

      if (!creatorStats[creatorId]) {
        creatorStats[creatorId] = {
          userId: creatorId,
          userName: meme.userName,
          photoURL: meme.userPhotoURL,
          totalLikes: 0,
          memeCount: 0,
        };
      }

      creatorStats[creatorId].totalLikes += meme.likes;
      creatorStats[creatorId].memeCount++;
    });

    // Convert to array and sort by total likes
    const creators = Object.values(creatorStats)
      .sort((a, b) => b.totalLikes - a.totalLikes)
      .slice(0, 10); // Top 10 creators

    return creators;
  } catch (error) {
    console.error("Error getting top creators:", error);
    throw error;
  }
}

export async function getTrendingMemes(period = "day") {
  try {
    const memesRef = collection(db, "memes");

    // Get the timestamp for the start of the period
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case "day":
        startDate.setDate(now.getDate() - 1);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "all":
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Query memes with engagement score (likes + views/10 + comments*2)
    const memesQuery = query(
      memesRef,
      where("createdAt", ">=", startDate),
      orderBy("createdAt", "desc")
    );
    const memesSnapshot = await getDocs(memesQuery);

    const memes = [];
    memesSnapshot.forEach((doc) => {
      const meme = doc.data();
      const engagementScore =
        meme.likes + Math.floor(meme.views / 10) + meme.commentCount * 2;

      memes.push({
        id: doc.id,
        ...meme,
        engagementScore,
      });
    });

    // Sort by engagement score and return top 12
    return memes
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 12);
  } catch (error) {
    console.error("Error getting trending memes:", error);
    throw error;
  }
}

export async function getTrendingTags(period = "day") {
  try {
    const memesRef = collection(db, "memes");

    // Get the timestamp for the start of the period
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case "day":
        startDate.setDate(now.getDate() - 1);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "all":
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Get memes in the time period
    const memesQuery = query(
      memesRef,
      where("createdAt", ">=", startDate),
      orderBy("createdAt", "desc")
    );
    const memesSnapshot = await getDocs(memesQuery);

    // Count tag occurrences and calculate weights
    const tagStats = {};
    let maxCount = 0;

    memesSnapshot.forEach((doc) => {
      const meme = doc.data();
      const tags = meme.tags || [];

      tags.forEach((tag) => {
        if (!tagStats[tag]) {
          tagStats[tag] = {
            name: tag,
            count: 0,
            weight: 0,
          };
        }
        tagStats[tag].count++;
        maxCount = Math.max(maxCount, tagStats[tag].count);
      });
    });

    // Calculate weights (1.0 to 2.0 scale)
    Object.values(tagStats).forEach((tag) => {
      tag.weight = 1 + tag.count / maxCount;
    });

    // Sort by count and return top 20
    return Object.values(tagStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  } catch (error) {
    console.error("Error getting trending tags:", error);
    throw error;
  }
}

export async function deleteMeme(memeId) {
  try {
    // Verify user is logged in
    if (!auth.currentUser) {
      throw new Error("You must be logged in to delete a meme");
    }

    const memeRef = doc(db, "memes", memeId);
    const memeDoc = await getDoc(memeRef);

    if (!memeDoc.exists()) {
      throw new Error("Meme not found");
    }

    const memeData = memeDoc.data();

    // Check if the current user is the owner
    if (memeData.userId !== auth.currentUser.uid) {
      throw new Error("You don't have permission to delete this meme");
    }

    // Start a batch write
    const batch = writeBatch(db);

    // Delete the meme document
    batch.delete(memeRef);

    // Update user stats
    const userRef = doc(db, "users", auth.currentUser.uid);
    batch.update(userRef, {
      memeCount: increment(-1),
      lastDeletedAt: serverTimestamp(),
    });

    // Commit the batch
    await batch.commit();

    return true;
  } catch (error) {
    console.error("Error deleting meme:", error);
    throw error;
  }
}

export async function recordMemeStats(memeId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const historyRef = doc(
    db,
    `memes/${memeId}/history`,
    today.toISOString().split("T")[0]
  );

  await setDoc(
    historyRef,
    {
      date: today,
      likes: increment(0),
      views: increment(0),
      comments: increment(0),
      userId: auth.currentUser.uid,
    },
    { merge: true }
  );
}

export async function trackMemeView(memeId) {
  const batch = writeBatch(db);

  // Update main meme doc
  const memeRef = doc(db, "memes", memeId);
  batch.update(memeRef, {
    views: increment(1),
  });

  // Update daily history
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const historyRef = doc(
    db,
    `memes/${memeId}/history`,
    today.toISOString().split("T")[0]
  );
  batch.set(
    historyRef,
    {
      date: today,
      views: increment(1),
      userId: auth.currentUser?.uid || null,
    },
    { merge: true }
  );

  await batch.commit();
}
