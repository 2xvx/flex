// uploadVideo.ts — direct Firebase Storage upload (no backend hop = much faster)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const FB_CONFIG = {
  apiKey:        'AIzaSyDYIbJ010CGwWqBLtv4j_TqA6l31HJUrEU',
  authDomain:    'fitconnect-937d0.firebaseapp.com',
  projectId:     'fitconnect-937d0',
  storageBucket: 'fitconnect-937d0.firebasestorage.app',
};

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(FB_CONFIG);
}

export function uploadVideoToStorage(
  file: File,
  folder: string = 'posts',
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const storage  = getStorage(getFirebaseApp());
    const ext      = file.name.split('.').pop() || 'mp4';
    const filename = `videos/${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const task     = uploadBytesResumable(ref(storage, filename), file, {
      contentType: file.type || 'video/mp4',
    });

    task.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes > 0)
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      (err) => reject(new Error(err.message || 'Upload failed')),
      async () => {
        try { resolve(await getDownloadURL(task.snapshot.ref)); }
        catch (e: any) { reject(new Error(e.message || 'Could not get download URL')); }
      },
    );
  });
}
