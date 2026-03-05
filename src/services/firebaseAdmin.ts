import admin from "firebase-admin";

if (!admin.apps.length) {

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: "gen-lang-client-0039862552-33f08.firebasestorage.app"
  });

}

export const db = admin.firestore();

<<<<<<< HEAD
export const bucket = admin.storage().bucket();
=======
export const bucket = admin.storage().bucket();
>>>>>>> ae0906bef3bd040013a384b0623194687de20a5f
