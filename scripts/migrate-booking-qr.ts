import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const PUBLIC_BOOKING_BASE_URL =
  process.env.PUBLIC_BOOKING_BASE_URL ||
  process.env.VITE_PUBLIC_BOOKING_BASE_URL ||
  "https://ais-pre-hfmviuhpqhhx673vbwoye2-841267057913.asia-east1.run.app";

console.log("=================================================");
console.log(" BERGH.RYKER — BOOKING QR & LINK MIGRATION SCRIPT");
console.log("=================================================");
console.log("PUBLIC_BOOKING_BASE_URL:", PUBLIC_BOOKING_BASE_URL);

const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(configPath)) {
  console.error("firebase-applet-config.json not found!");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

function generateBookingCode(existingId?: string): string {
  const year = new Date().getFullYear();
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let randomPart = "";
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    randomPart += chars[idx];
  }
  return `BR-${year}-${randomPart}`;
}

async function runMigration() {
  console.log("Fetching bookings collection from Firestore...");
  const snapshot = await getDocs(collection(db, "bookings"));
  console.log(`Found ${snapshot.size} total bookings.`);

  let updatedCount = 0;
  let alreadyValidCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const id = docSnap.id;
    let bookingCode = data.bookingCode;
    let confirmationLink = data.confirmationLink || "";
    let qrCodeUrl = data.qrCodeUrl || "";

    const needsCode = !bookingCode;
    const isBadLink =
      !confirmationLink ||
      confirmationLink.includes("aistudio.google.com") ||
      confirmationLink.includes("ais-dev-") ||
      confirmationLink.includes("localhost") ||
      confirmationLink.includes("127.0.0.1") ||
      !confirmationLink.startsWith(PUBLIC_BOOKING_BASE_URL);

    const needsQr = !qrCodeUrl || isBadLink;

    if (needsCode || isBadLink || needsQr) {
      if (!bookingCode) {
        bookingCode = generateBookingCode(id);
      }

      const newConfirmationLink = `${PUBLIC_BOOKING_BASE_URL.replace(/\/+$/, "")}/booking/${bookingCode}`;
      const newQrDataUrl = await QRCode.toDataURL(newConfirmationLink, {
        width: 1200,
        margin: 3,
        errorCorrectionLevel: "H",
        color: {
          dark: "#09090b",
          light: "#ffffff",
        },
      });

      const updates: Record<string, any> = {
        bookingCode,
        confirmationLink: newConfirmationLink,
        qrCodeUrl: newQrDataUrl,
      };

      if (!data.confirmationStatus) {
        updates.confirmationStatus = "link_created";
      }

      await updateDoc(doc(db, "bookings", id), updates);
      updatedCount++;
      console.log(`[UPDATED] Booking ${id} -> Code: ${bookingCode} | Link: ${newConfirmationLink}`);
    } else {
      alreadyValidCount++;
      console.log(`[VALID] Booking ${id} -> Code: ${bookingCode} (already correct)`);
    }
  }

  console.log("=================================================");
  console.log(`Migration complete! Updated: ${updatedCount}, Already valid: ${alreadyValidCount}, Total: ${snapshot.size}`);
  console.log("=================================================");
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
