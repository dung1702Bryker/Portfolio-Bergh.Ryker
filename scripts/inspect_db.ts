import dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || "ai-studio-01acd3e7-5d2e-492d-a9cc-c46484de9c60");

async function inspect() {
  console.log('--- INSPECTING FIRESTORE COLLECTIONS ---');
  
  const bSnap = await getDocs(collection(db, 'bookings'));
  console.log('bookings count:', bSnap.size);
  bSnap.docs.forEach((doc, idx) => {
    console.log(`[Booking ${idx + 1}] ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });

  const aSnap = await getDocs(collection(db, 'availableDates'));
  console.log('availableDates count:', aSnap.size);
  let hasInfoCount = 0;
  aSnap.docs.forEach((doc) => {
    const d = doc.data();
    if (d.schoolName || d.phone || d.customerName || d.contact || d.notes || d.status === 'booked' || d.slots) {
      hasInfoCount++;
      console.log(`[AvailableDate] ${doc.id}:`, JSON.stringify(d));
    }
  });
  console.log('availableDates with info count:', hasInfoCount);
}

inspect().catch(console.error);
