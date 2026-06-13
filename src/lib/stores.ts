import { writable, derived, get } from 'svelte/store';
import type {
  Branch,
  Coach,
  Course,
  CourseDraft,
  Student,
  User,
  UserRole,
  ConflictInfo,
} from '../types';
import { db } from './db';
import { BRANCHES, COACHES, ALL_STUDENTS, generateInitialCourses } from './mockData';
import { detectConflicts, generateId, formatDate } from './utils';

export const currentUser = writable<User | null>(null);
export const branches = writable<Branch[]>([]);
export const coaches = writable<Coach[]>([]);
export const students = writable<Student[]>([]);
export const courses = writable<Course[]>([]);
export const drafts = writable<(CourseDraft & { savedAt: string })[]>([]);
export const selectedBranchId = writable<string>(BRANCHES[0].id);
export const selectedDate = writable<Date>(new Date());
export const viewMode = writable<'schedule' | 'students' | 'reports'>('schedule');

export const visibleCoaches = derived(
  [coaches, currentUser, selectedBranchId],
  ([$coaches, $currentUser, $selectedBranchId]) => {
    if (!$currentUser) return [];
    if ($currentUser.role === 'headquarters') {
      return $coaches.filter((c) => c.branchId === $selectedBranchId);
    }
    if ($currentUser.role === 'coach') {
      return $coaches.filter((c) => c.id === $currentUser.id);
    }
    return $coaches.filter((c) => c.branchId === $selectedBranchId);
  }
);

export const visibleStudents = derived(
  [students, currentUser, selectedBranchId, courses],
  ([$students, $currentUser, $selectedBranchId, $courses]) => {
    if (!$currentUser) return [];
    if ($currentUser.role === 'headquarters') {
      return $students.filter((s) => s.branchId === $selectedBranchId);
    }
    if ($currentUser.role === 'coach') {
      const coachCourseStudentIds = new Set<string>();
      $courses
        .filter((c) => c.coachId === $currentUser.id)
        .forEach((c) => c.studentIds.forEach((id) => coachCourseStudentIds.add(id)));
      return $students.filter((s) => coachCourseStudentIds.has(s.id));
    }
    return $students.filter((s) => s.branchId === $selectedBranchId);
  }
);

export const visibleCourses = derived(
  [courses, currentUser, selectedBranchId],
  ([$courses, $currentUser, $selectedBranchId]) => {
    if (!$currentUser) return [];
    if ($currentUser.role === 'headquarters') {
      return $courses.filter((c) => c.branchId === $selectedBranchId);
    }
    if ($currentUser.role === 'coach') {
      return $courses.filter((c) => c.coachId === $currentUser.id);
    }
    return $courses.filter((c) => c.branchId === $selectedBranchId);
  }
);

export function hasPermission(role: UserRole, action: string): boolean {
  const permissions: Record<UserRole, string[]> = {
    coach: ['view_own_schedule', 'view_own_students', 'mark_skill', 'complete_course'],
    reception: ['view_schedule', 'create_course', 'edit_course', 'delete_course', 'view_students', 'batch_copy', 'batch_cancel'],
    headquarters: ['*'],
  };
  const rolePerms = permissions[role] || [];
  return rolePerms.includes('*') || rolePerms.includes(action);
}

export async function initializeData(): Promise<void> {
  await db.init();

  const storedBranches = await db.getAll('branches');
  if (storedBranches.length === 0) {
    for (const b of BRANCHES) {
      await db.put('branches', b);
    }
    branches.set(BRANCHES);
  } else {
    branches.set(storedBranches);
  }

  const storedCoaches = await db.getAll('coaches');
  if (storedCoaches.length === 0) {
    for (const c of COACHES) {
      await db.put('coaches', c);
    }
    coaches.set(COACHES);
  } else {
    coaches.set(storedCoaches as Coach[]);
  }

  const storedStudents = await db.getAll('students');
  if (storedStudents.length === 0) {
    for (const s of ALL_STUDENTS) {
      await db.put('students', s);
    }
    students.set(ALL_STUDENTS);
  } else {
    students.set(storedStudents as Student[]);
  }

  const storedCourses = await db.getAll('courses');
  if (storedCourses.length === 0) {
    const initialCourses = generateInitialCourses();
    for (const c of initialCourses) {
      await db.put('courses', c);
    }
    courses.set(initialCourses);
  } else {
    courses.set(storedCourses as Course[]);
  }

  const storedDrafts = await db.getDrafts();
  drafts.set(storedDrafts);

  const currentUsers = await db.getAll('currentUser');
  if (currentUsers.length > 0) {
    const cu = currentUsers[0] as { userId: string };
    const allUsers = [...(storedCoaches as Coach[])];
    const found = allUsers.find((u) => u.id === cu.userId);
    if (found) {
      currentUser.set(found);
    }
  }
}

export async function setCurrentUser(user: User): Promise<void> {
  currentUser.set(user);
  await db.put('currentUser', { userId: user.id });
}

export async function logout(): Promise<void> {
  currentUser.set(null);
  await db.clear('currentUser');
}

export function checkCourseConflicts(
  draft: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): ConflictInfo[] {
  return detectConflicts(draft, get(courses));
}

export async function saveCourse(draft: CourseDraft): Promise<Course | null> {
  const conflicts = checkCourseConflicts(draft);
  if (conflicts.length > 0) {
    return null;
  }

  const now = new Date().toISOString();
  let course: Course;

  if (draft.id) {
    const existing = get(courses).find((c) => c.id === draft.id);
    if (existing) {
      course = {
        ...existing,
        ...draft,
        id: draft.id,
        updatedAt: now,
      } as Course;
    } else {
      return null;
    }
  } else {
    course = {
      ...draft,
      id: generateId(),
      status: draft.status || 'scheduled',
      createdAt: now,
      updatedAt: now,
    } as Course;
  }

  await db.put('courses', course);
  courses.update((list) => {
    const idx = list.findIndex((c) => c.id === course.id);
    if (idx >= 0) {
      const newList = [...list];
      newList[idx] = course;
      return newList;
    }
    return [...list, course];
  });

  if (draft.id) {
    await db.deleteDraft(draft.id);
    drafts.update((list) => list.filter((d) => d.id !== draft.id));
  }

  await db.addSyncRecord({
    entityType: 'course',
    entityId: course.id,
    operation: draft.id ? 'update' : 'create',
  });

  return course;
}

export async function deleteCourse(courseId: string): Promise<void> {
  await db.delete('courses', courseId);
  courses.update((list) => list.filter((c) => c.id !== courseId));
  await db.addSyncRecord({
    entityType: 'course',
    entityId: courseId,
    operation: 'delete',
  });
}

export async function saveCourseDraft(draft: CourseDraft): Promise<void> {
  await db.saveDraft(draft);
  const allDrafts = await db.getDrafts();
  drafts.set(allDrafts);
}

export async function clearCourseDraft(draftId: string): Promise<void> {
  await db.deleteDraft(draftId);
  drafts.update((list) => list.filter((d) => d.id !== draftId));
}

export async function updateStudent(student: Student): Promise<void> {
  await db.put('students', student);
  students.update((list) => {
    const idx = list.findIndex((s) => s.id === student.id);
    if (idx >= 0) {
      const newList = [...list];
      newList[idx] = student;
      return newList;
    }
    return [...list, student];
  });
  await db.addSyncRecord({
    entityType: 'student',
    entityId: student.id,
    operation: 'update',
  });
}

export async function copyWeekToNext(fromDate: Date): Promise<number> {
  const weekStart = new Date(fromDate);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1));

  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekDates.push(formatDate(d));
  }

  const nextWeekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + 7 + i);
    nextWeekDates.push(formatDate(d));
  }

  const allCourses = get(courses);
  const branchId = get(selectedBranchId);
  const weekCourses = allCourses.filter(
    (c) => weekDates.includes(c.date) && c.branchId === branchId && c.status !== 'cancelled'
  );

  let copiedCount = 0;
  for (const course of weekCourses) {
    const dayIdx = weekDates.indexOf(course.date);
    if (dayIdx < 0) continue;
    const newDate = nextWeekDates[dayIdx];

    const newDraft: CourseDraft = {
      title: course.title,
      level: course.level,
      branchId: course.branchId,
      coachId: course.coachId,
      lane: course.lane,
      startTime: course.startTime,
      endTime: course.endTime,
      date: newDate,
      studentIds: [...course.studentIds],
      skillPointsCovered: [],
      notes: course.notes,
    };

    const conflicts = checkCourseConflicts(newDraft);
    if (conflicts.length === 0) {
      const saved = await saveCourse(newDraft);
      if (saved) copiedCount++;
    }
  }

  return copiedCount;
}

export async function cancelDateRange(startDate: Date, endDate: Date): Promise<number> {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  const allCourses = get(courses);
  const branchId = get(selectedBranchId);

  let cancelledCount = 0;
  for (const course of allCourses) {
    if (
      course.branchId === branchId &&
      course.status === 'scheduled' &&
      course.date >= start &&
      course.date <= end
    ) {
      const cancelled: Course = { ...course, status: 'cancelled' as const };
      await db.put('courses', cancelled);
      cancelledCount++;
    }
  }

  courses.update((list) =>
    list.map((c) => {
      if (
        c.branchId === branchId &&
        c.status === 'scheduled' &&
        c.date >= start &&
        c.date <= end
      ) {
        return { ...c, status: 'cancelled' as const };
      }
      return c;
    })
  );

  return cancelledCount;
}

export async function syncWithServer(): Promise<{ success: number; failed: number }> {
  const pending = await db.getPendingSyncRecords();
  let success = 0;
  let failed = 0;

  for (const record of pending) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await db.markSyncRecordSynced(record.timestamp);
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}
