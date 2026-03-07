// This script populates the 'My Profile' page.

export function initMyProfile(faculty) {
    const profileContent = document.getElementById('profile-details-content');
    const subjectsContent = document.getElementById('handled-subjects-content');
    
    // Display basic faculty info
    profileContent.innerHTML = `
      <div class="detail-item">
          <span class="detail-label">Name</span>
          <span class="detail-value">${faculty.info.name || 'N/A'}</span>
      </div>
      <div class="detail-item">
          <span class="detail-label">Email</span>
          <span class="detail-value">${faculty.info.email || 'N/A'}</span>
      </div>
      <div class="detail-item">
          <span class="detail-label">Department</span>
          <span class="detail-value">${faculty.info.department || 'N/A'}</span>
      </div>
    `;
    
    // Display all assigned subjects as tags
    if (faculty.subjects && faculty.subjects.length > 0) {
      subjectsContent.innerHTML = faculty.subjects.map(sub => 
        `<span class="subject-tag">${sub.subjectCode} - ${sub.subjectName} (Year ${sub.year}, Sec ${sub.section})</span>`
      ).join('');
    } else {
      subjectsContent.innerHTML = '<p>No subjects assigned.</p>';
    }
}