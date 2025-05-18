import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from "./utils.js";

async function ensureUserDocumentExists(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      username: user.email.split("@")[0],
      memeCount: 0,
      totalLikes: 0,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      photoURL: user.photoURL || null,
      badges: [],
    });
  }
}

// auth.js
export function initAuth() {
  return new Promise((resolve) => {
    const currentPage = window.location.pathname.split("/").pop();

    // Skip auth checks for analytics page - it handles its own auth
    if (currentPage === "analytics.html") {
      resolve(auth.currentUser);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const protectedPages = ["create.html", "badges.html", "profile.html"];

      if (user) {
        try {
          await ensureUserDocumentExists(user);
          updateUserUI(user);

          // If on login page and user is authenticated, redirect
          if (currentPage === "login.html" || currentPage === "") {
            const redirectTo = sessionStorage.getItem("redirectTo") || "index.html";
            sessionStorage.removeItem("redirectTo");
            window.location.href = redirectTo;
          }
        } catch (error) {
          console.error("Error in auth initialization:", error);
          showToast("Error initializing user data", "error");
        }
      } else {
        if (protectedPages.includes(currentPage)) {
          sessionStorage.setItem("redirectTo", window.location.href);
          window.location.href = "login.html";
        }
      }
      unsubscribe();
      resolve(user);
    });
  });
}

function updateUserUI(user) {
  const userNameElements = document.querySelectorAll("#userName, .user-name");
  const userAvatarElements = document.querySelectorAll(
    "#userAvatar, .user-avatar"
  );
  const logoutButtons = document.querySelectorAll("#logoutBtn, .logout-btn");
  const authRequiredElements = document.querySelectorAll(".auth-required");

  userNameElements.forEach((el) => {
    el.textContent = user.email.split("@")[0];
  });

  userAvatarElements.forEach((el) => {
    el.src =
      user.photoURL ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user.email
      )}&background=random`;
  });

  logoutButtons.forEach((btn) => {
    btn.style.display = "block";
    btn.addEventListener("click", handleLogout);
  });

  authRequiredElements.forEach((el) => {
    el.style.display = "block";
  });
}

export async function handleLogin(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update user document
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      lastActive: serverTimestamp(),
      photoURL: user.photoURL || null,
    }, { merge: true });

    showToast("Login successful!", "success");
    
    // Force redirect after successful login
    const redirectTo = sessionStorage.getItem("redirectTo") || "index.html";
    sessionStorage.removeItem("redirectTo");
    window.location.href = redirectTo;
    
    return { success: true };
  } catch (error) {
    let errorMessage = "Login failed";
    switch (error.code) {
      case "auth/invalid-email":
        errorMessage = "Invalid email address";
        break;
      case "auth/user-not-found":
      case "auth/wrong-password":
        errorMessage = "Invalid email or password";
        break;
      default:
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

export async function handleSignup(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Create user document
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      username: user.email.split("@")[0],
      memeCount: 0,
      totalLikes: 0,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      photoURL: null,
      badges: [],
    });

    showToast("Account created successfully!", "success");
    return { success: true };
  } catch (error) {
    let errorMessage = "Signup failed";
    switch (error.code) {
      case "auth/email-already-in-use":
        errorMessage = "Email already in use";
        break;
      case "auth/invalid-email":
        errorMessage = "Invalid email address";
        break;
      case "auth/weak-password":
        errorMessage = "Password should be at least 6 characters";
        break;
      default:
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

export async function handleLogout() {
  try {
    await signOut(auth);
    showToast("Logged out successfully", "success");
    window.location.href = "login.html";
  } catch (error) {
    showToast("Logout failed: " + error.message, "error");
  }
}
