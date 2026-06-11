// uploadVideo.ts
// Uploads a video file to Firebase Storage via the backend /api/upload-video
// endpoint (multipart/form-data). Uses XHR so we can track upload progress.
// Works for ALL auth types (email/password + Google) since auth is our own ID token.

import { API } from '../config';

export function uploadVideoToStorage(
  file: File,
  folder: string = 'posts',   // kept for API compat — backend ignores this, uses "videos/<uid>/"
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('fitconnect_id_token');
    if (!token) {
      reject(new Error('Not authenticated — please log in again.'));
      return;
    }

    const formData = new FormData();
    formData.append('video', file);
    // pass folder hint as a query param (backend can use it if needed)
    formData.append('folder', folder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/upload-video`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    // Upload progress
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.url) resolve(data.url);
          else reject(new Error('No URL returned from server'));
        } catch {
          reject(new Error('Invalid server response'));
        }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          if (err.error) msg = err.error;
        } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));

    xhr.send(formData);
  });
}
