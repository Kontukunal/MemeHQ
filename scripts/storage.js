import { storage } from "./firebase.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

export async function uploadMemeImage(file, userId) {
  try {
    // Generate a unique filename
    const fileExt = file.name.split(".").pop();
    const filename = `${Date.now()}.${fileExt}`;

    const storageRef = ref(storage, `memes/${userId}/${filename}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
}

export async function deleteMemeImage(imageUrl) {
  try {
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
}
