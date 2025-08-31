require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = express();
app.use(bodyParser.json());

function stringToIntHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

app.post("/sendNotification", async (req, res) => {
  try {
    const { currentDeviceFcmToken, userName, update, details } = req.body;

    if (!currentDeviceFcmToken || !userName || !update) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Fetch all users from Firestore
    const snapshot = await db.collection("users").get();
    const tokens = [];

    snapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.fcmToken && userData.fcmToken !== currentDeviceFcmToken) {
        tokens.push(userData.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return res.json({ message: "No tokens to send notification" });
    }

    // Build notification
    const message = {
      data: {
        notificationId: stringToIntHash(userName+update+details),
        userName,
        update,
        details,
      },
      tokens: tokens,
    };

    // Send to multiple devices
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log("FCM Response:", response);

    res.json({ message: "Notification sent", successCount: response.successCount });
  } catch (err) {
    console.error("Error sending notification:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

const PORT = Number(process.env.PORT) || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
