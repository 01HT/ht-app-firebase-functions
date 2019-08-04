import * as admin from "firebase-admin";
import { config } from "firebase-functions";

// Initialize the default app
admin.initializeApp();
// const defaultApp = admin.initializeApp();
// const defaultAuth = defaultApp.auth();
// const defaultDatabase = defaultApp.database();

// Initialize the main app
const firebaseConfig = config().config;
const serviceAccount = config().service_account;
// Need replace \\n - https://github.com/firebase/firebase-tools/issues/371
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
firebaseConfig.credential = admin.credential.cert(serviceAccount);
const mainApp = admin.initializeApp(firebaseConfig, "mainApp");

const auth = mainApp.auth();
const db = mainApp.firestore();

export { admin, auth, db };
