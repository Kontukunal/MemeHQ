import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from "./utils.js";

// Badge definitions with requirements and rarity levels
const BADGES = {
  FIRST_MEME: {
    id: "FIRST_MEME",
    name: "Meme Creator",
    description: "Created your first meme",
    icon: "fas fa-star",
    rarity: "common",
    requirement: "Create your first meme",
    checkProgress: async (userId) => {
      const memesRef = collection(db, "memes");
      const q = query(memesRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.size > 0;
    }
  },
  VIRAL_POST: {
    id: "VIRAL_POST",
    name: "Viral Sensation",
    description: "Got 1000+ likes on a single meme",
    icon: "fas fa-fire",
    rarity: "rare",
    requirement: "Get 1000+ likes on a single meme",
    checkProgress: async (userId) => {
      const memesRef = collection(db, "memes");
      const q = query(
        memesRef,
        where("userId", "==", userId),
        where("likes", ">=", 1000)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.size > 0;
    }
  },
  WEEKLY_WINNER: {
    id: "WEEKLY_WINNER",
    name: "Weekly Winner",
    description: "Had the most liked meme of the week",
    icon: "fas fa-crown",
    rarity: "epic",
    requirement: "Have the most liked meme in a week",
    checkProgress: async (userId) => {
      const memesRef = collection(db, "memes");
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      // Get all memes from the last week
      const q = query(
        memesRef,
        where("createdAt", ">=", weekAgo),
        orderBy("createdAt", "desc"),
        orderBy("likes", "desc"),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const topMeme = querySnapshot.docs[0];
        return topMeme.data().userId === userId;
      }
      return false;
    }
  },
  VIEWS_10K: {
    id: "VIEWS_10K",
    name: "10k Views Club",
    description: "One of your memes reached 10,000 views",
    icon: "fas fa-eye",
    rarity: "rare",
    requirement: "Get 10,000 views on a single meme",
    checkProgress: async (userId) => {
      const memesRef = collection(db, "memes");
      const q = query(
        memesRef,
        where("userId", "==", userId),
        where("views", ">=", 10000)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.size > 0;
    }
  },
  MEME_MASTER: {
    id: "MEME_MASTER",
    name: "Meme Master",
    description: "Created 100 memes",
    icon: "fas fa-graduation-cap",
    rarity: "epic",
    requirement: "Create 100 memes",
    checkProgress: async (userId) => {
      const memesRef = collection(db, "memes");
      const q = query(memesRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      return {
        achieved: querySnapshot.size >= 100,
        progress: Math.min(100, Math.round((querySnapshot.size / 100) * 100))
      };
    }
  },
  TRENDING_CREATOR: {
    id: "TRENDING_CREATOR",
    name: "Trending Creator",
    description: "Had 3 memes in trending simultaneously",
    icon: "fas fa-chart-line",
    rarity: "epic",
    requirement: "Have 3 memes in trending at once",
    checkProgress: async (userId) => {
      const memesRef = collection(db, "memes");
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const q = query(
        memesRef,
        where("userId", "==", userId),
        where("createdAt", ">=", dayAgo),
        where("likes", ">=", 100)
      );
      const querySnapshot = await getDocs(q);
      return {
        achieved: querySnapshot.size >= 3,
        progress: Math.min(100, Math.round((querySnapshot.size / 3) * 100))
      };
    }
  },
  LEGENDARY_CREATOR: {
    id: "LEGENDARY_CREATOR",
    name: "Legendary Creator",
    description: "Created a meme that got 10,000+ likes",
    icon: "fas fa-dragon",
    rarity: "legendary",
    requirement: "Get 10,000+ likes on a single meme",
    checkProgress: async (userId) => {
      const memesRef = collection(db, "memes");
      const q = query(
        memesRef,
        where("userId", "==", userId),
        where("likes", ">=", 10000)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.size > 0;
    }
  },
  ENGAGEMENT_KING: {
    id: "ENGAGEMENT_KING",
    name: "Engagement King",
    description: "Got 1000+ comments across all memes",
    icon: "fas fa-comments",
    rarity: "epic",
    requirement: "Receive 1000+ total comments",
    checkProgress: async (userId) => {
      const memesRef = collection(db, "memes");
      const q = query(memesRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      
      const totalComments = querySnapshot.docs.reduce((total, doc) => {
        return total + (doc.data().commentCount || 0);
      }, 0);
      
      return {
        achieved: totalComments >= 1000,
        progress: Math.min(100, Math.round((totalComments / 1000) * 100))
      };
    }
  }
};

// Get user's badges
export async function getUserBadges(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return [];
    }

    return userDoc.data().badges || [];
  } catch (error) {
    console.error("Error getting user badges:", error);
    throw error;
  }
}

// Get all available badges
export async function getAllBadges() {
  return Object.values(BADGES);
}

// Get total number of users (for rarity calculations)
export async function getTotalUsers() {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    return snapshot.size;
  } catch (error) {
    console.error("Error getting total users:", error);
    return 100; // Fallback value
  }
}

// Check and award a specific badge
export async function checkAndAwardBadge(userId, badgeId) {
  try {
    const badge = BADGES[badgeId];
    if (!badge) return false;

    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return false;
    
    const userBadges = userDoc.data().badges || [];
    if (userBadges.some(b => b.id === badgeId)) return false;

    const progress = await badge.checkProgress(userId);
    const achieved = typeof progress === 'object' ? progress.achieved : progress;

    if (achieved) {
      await updateDoc(userRef, {
        badges: arrayUnion({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          rarity: badge.rarity,
          awardedAt: serverTimestamp()
        })
      });

      showToast(`New badge unlocked: ${badge.name}!`, "success");
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking badge:", error);
    return false;
  }
}

// Check all badges for a user
export async function checkAllBadges(userId) {
  try {
    const promises = Object.keys(BADGES).map(badgeId => 
      checkAndAwardBadge(userId, badgeId)
    );
    await Promise.all(promises);
  } catch (error) {
    console.error("Error checking all badges:", error);
  }
}

// Get badge progress for available badges
export async function getBadgeProgress(userId) {
  try {
    const progress = {};
    for (const [badgeId, badge] of Object.entries(BADGES)) {
      const result = await badge.checkProgress(userId);
      progress[badgeId] = typeof result === 'object' ? result : { achieved: result, progress: result ? 100 : 0 };
    }
    return progress;
  } catch (error) {
    console.error("Error getting badge progress:", error);
    return {};
  }
}