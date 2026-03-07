/**
 * utils2.js
 * A collection of utility functions for the student dashboard.
 */

import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

export async function fetchAvailableTests(student, db) {
  if (!db || !student) return [];
  try {
    const now = new Date();
    const testsRef = collection(db, 'tests');

    const q1 = query(testsRef, where('departments', 'array-contains', student.department), where('end', '>=', now));
    const q2 = query(testsRef, where('years', 'array-contains', String(student.year)), where('end', '>=', now));
    const q3 = query(testsRef, where('sections', 'array-contains', student.section), where('end', '>=', now));
    const q4 = query(testsRef, where('departments', '==', []), where('years', '==', []), where('sections', '==', []), where('end', '>=', now));
    
    const queryPromises = [getDocs(q1), getDocs(q2), getDocs(q3), getDocs(q4)];
    const querySnapshots = await Promise.all(queryPromises);
    
    const allTests = new Map();
    querySnapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        allTests.set(doc.id, { id: doc.id, ...doc.data() });
      });
    });

    const eligibleTests = Array.from(allTests.values()).filter(test => {
      const deptMatch = test.departments.length === 0 || test.departments.includes(student.department);
      const yearMatch = test.years.length === 0 || test.years.includes(String(student.year));
      const sectionMatch = test.sections.length === 0 || test.sections.includes(student.section);
      return deptMatch && yearMatch && sectionMatch;
    });

    return eligibleTests.map(raw => ({
        ...raw,
        id: raw.id,
        name: raw.title || raw.name || 'Unnamed Test',
        testType: raw.type || 'monthly',
        questionsToAttend: raw.questionsToAttend || 10,
        questionCount: raw.questionCount || 20,
        timePerQuestion: raw.timePerQuestion || 60,
        startDate: raw.start || now,
        endDate: raw.end || now,
    }));
    
  } catch (err) {
    console.error('Error fetching available tests:', err);
    return [];
  }
}

export function categorizeTests(tests) {
  const categories = { unitTests: { subjects: [] }, technicalSkills: { tests: [] }, aptitude: { tests: [] }, softSkills: { tests: [] } };
  const subjectsMap = new Map();
  const now = new Date();

  (tests || []).forEach(test => {
    const startDate = (test.startDate?.toDate) ? test.startDate.toDate() : new Date(test.startDate);
    const endDate = (test.endDate?.toDate) ? test.endDate.toDate() : new Date(test.endDate);
    
    let availability = 'expired';
    if (now < startDate) availability = 'upcoming';
    else if (now >= startDate && now <= endDate) availability = 'available';

    const formattedTest = {
      id: test.id,
      title: test.name,
      type: test.testType,
      details: [
        { value: test.timePerQuestion, unit: 'Secs/Q' },
        { value: test.questionsToAttend, unit: 'Questions' }
      ],
      availability,
      icon: 'code',
      colorScheme: { main: 'navy', light: 'navy-light', text: 'navy' },
      raw: test
    };

    if (formattedTest.type === 'monthly') {
      const sub = test.testSubType || test.subject || 'General';
      if (!subjectsMap.has(sub)) subjectsMap.set(sub, { name: sub, tests: [] });
      subjectsMap.get(sub).tests.push(formattedTest);
    } else if (formattedTest.type === 'tsp') {
      const subType = (test.testSubType || '').toLowerCase();
      if (subType.includes('aptitude')) {
        formattedTest.icon = 'psychology';
        formattedTest.colorScheme = { main: 'orange-500', light: 'orange-50', text: 'orange-600' };
        categories.aptitude.tests.push(formattedTest);
      } else if (subType.includes('soft')) {
        formattedTest.icon = 'groups';
        formattedTest.colorScheme = { main: 'green-600', light: 'green-50', text: 'green-700' };
        categories.softSkills.tests.push(formattedTest);
      } else {
        categories.technicalSkills.tests.push(formattedTest);
      }
    } else {
      const sub = test.testSubType || test.subject || 'General';
      if (!subjectsMap.has(sub)) subjectsMap.set(sub, { name: sub, tests: [] });
      subjectsMap.get(sub).tests.push(formattedTest);
    }
  });

  categories.unitTests.subjects = Array.from(subjectsMap.values());
  return categories;
}

export async function fetchAttendedTests(student,db) {
  if (!db || !student?.email) return [];
  try {
    const scoresRef = collection(db, 'scores');
    const q = query(scoresRef, where('userId', '==', student.email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return [];
    }

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      const completedDate = data.timeCompleted ? new Date(data.timeCompleted) : new Date(data.timeCreated);

      let displayStatus = 'In Progress';
      if (data.status === 'completed') {
          const passMark = 40;
          displayStatus = (parseFloat(data.score) || 0) >= passMark ? 'Pass' : 'Fail';
      }

      return {
        testId: data.testId,
        title: data.testName || 'Unnamed Test',
        date: completedDate.toLocaleDateString(),
        score: data.score ? parseFloat(data.score).toFixed(0) : null,
        status: displayStatus,
        rawStatus: data.status
      };
    });

  } catch (err) {
    console.error('Error fetching attended tests:', err);
    return [];
  }
}
