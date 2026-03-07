import { db } from '../../../shared/firebase-config.js';
// v9 SYNTAX: Import necessary modular functions
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initManageAdmins() {
  const adminBody = document.getElementById('admin-body');
  let adminCache = null;

  const renderAdmins = async () => {
    try {
      if (!adminCache) {
        console.log("Fetching admins from Firestore.");
        // v9 SYNTAX: Use query() and getDocs()
        const q = query(collection(db, 'users'), where('role', '==', 'admin'));
        const snapshot = await getDocs(q);
        adminCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      adminBody.innerHTML = '';
      if (adminCache.length === 0) {
        adminBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No admins found.</td></tr>';
        return;
      }
      
      adminCache.forEach(admin => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${admin.email || 'N/A'}</td>
          <td>${admin.name || 'N/A'}</td>
          <td>
            <div class="table-actions">
              <button class="btn-delete-secondary" data-id="${admin.id}" data-name="${admin.name}">Delete</button>
            </div>
          </td>`;
        adminBody.appendChild(row);
      });
    } catch (error) { console.error("Error fetching admins: ", error); }
  };
  
  document.getElementById('dynamic-content-area').addEventListener('click', async (e) => {
    if (e.target.id === 'add-admin-btn') {
      const name = prompt("Enter new admin's name:");
      const email = prompt("Enter new admin's email:");
      if (name && email) {
        try {
          // v9 SYNTAX: Use doc() and setDoc()
          await setDoc(doc(db, 'users', email.toLowerCase()), { name, email: email.toLowerCase(), role: 'admin' });
          alert('Admin added successfully!');
          adminCache = null; // Invalidate cache
          renderAdmins();
        } catch (error) { console.error("Error adding admin: ", error); }
      } else if (name || email) {
        alert("Both name and email are required.");
      }
    } else if (e.target.classList.contains('btn-delete-secondary')) {
      const adminId = e.target.dataset.id;
      const adminName = e.target.dataset.name;
      if (confirm(`Are you sure you want to delete ${adminName}?`)) {
        try {
          // v9 SYNTAX: Use doc() and deleteDoc()
          await deleteDoc(doc(db, 'users', adminId));
          alert('Admin deleted successfully!');
          adminCache = null; // Invalidate cache
          renderAdmins();
        } catch (error) { console.error("Error deleting admin: ", error); }
      }
    }
  });

  renderAdmins();
}