import admin from "firebase-admin";

if (!admin.apps.length) {

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: "gen-lang-client-0039862552.appspot.com"
  });

}

export const db = admin.firestore();

export const bucket = admin.storage().bucket();
