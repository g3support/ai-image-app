import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: "gen-lang-client-00398625-33f08.firebasestorage.app"
  });
}

export const db = admin.firestore();
export const bucket = admin.storage().bucket();

export const auth = admin.auth();
