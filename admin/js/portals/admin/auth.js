// This line now correctly imports both `db` and `auth`
import { db, auth } from '../../shared/firebase-config.js';

export function initializeAuth() {
  const signOutBtn = document.querySelector('.sign-out-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      // This will now work because 'auth' is imported
      auth.signOut().then(() => {
        console.log('User signed out successfully.');
        window.location.href = '../index.html';
      }).catch((error) => {
        console.error('Sign Out Error:', error);
        alert('Could not sign out. Please try again.');
      });
    });
  }
}