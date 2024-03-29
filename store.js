"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
exports.admin = admin;
const firebase_functions_1 = require("firebase-functions");
// Initialize the default app
admin.initializeApp();
// const defaultApp = admin.initializeApp();
// const defaultAuth = defaultApp.auth();
// const defaultDatabase = defaultApp.database();
// Initialize the main app
const firebaseConfig = firebase_functions_1.config().config;
const serviceAccount = firebase_functions_1.config().service_account;
// Need replace \\n - https://github.com/firebase/firebase-tools/issues/371
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
firebaseConfig.credential = admin.credential.cert(serviceAccount);
const mainApp = admin.initializeApp(firebaseConfig, "mainApp");
const auth = mainApp.auth();
exports.auth = auth;
const db = mainApp.firestore();
exports.db = db;
//# sourceMappingURL=store.js.map