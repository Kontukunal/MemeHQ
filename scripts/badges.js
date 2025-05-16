import { db, auth } from "./firebase.js";
import { doc, updateDoc, arrayUnion, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from "./utils.js";

const BADGES = {
  FIRST_MEME: {
    id: 'first_meme',
    name: 'First Meme',
    description: 'Created your first meme',
    icon: 'fa-star',
    color: '#FFD700'
  },
  VIRAL: {
    id: 'viral',
    name: 'Viral Creator',
    description: 'Got 100+ likes on a meme',
    icon: 'fa-virus',
    color: '#FF4500'
  },
  PROLIFIC: {
    id: 'prolific',
    name: 'Prolific Creator',
    description: 'Created 10+ memes',
    icon: 'fa-bolt',
    color: '#9370DB'
  },
  TOP_CREATOR: {
    id: 'top_creator',
    name: 'Top Creator',
    description: 'Featured in top 10 leaderboard',
    icon: 'fa-crown',
    color: '#FFD700'
  }
};

export async function checkAndAwardBadge(userId, badgeId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (!userData.badges || !userData.badges.includes(badgeId)) {
        await updateDoc(userRef, {
          badges: arrayUnion(badgeId)
        });
        showToast(`Earned badge: ${BADGES[badgeId].name}`, 'success');
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error awarding badge:', error);
    return false;
  }
}

export async function getUserBadges(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data().badges || [];
    }
    return [];
  } catch (error) {
    console.error('Error getting badges:', error);
    return [];
  }
}

export function getAllBadges() {
  return BADGES;
}