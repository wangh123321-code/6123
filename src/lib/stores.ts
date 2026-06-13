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
  OperationLog,
  BatchScheduleConfig,
} from '../types';
import { db } from './db';
import { BRANCHES, COACHES, ALL_STUDENTS, generateInitialCourses } from './mockData';
import {
  detectConflicts,
  generateId,
  formatDate,
  snapTimeToSlot,
  getTimeSlots,
  minutesToTime,
  timeToMinutes,
  timesOverlapWithBuffer,
  calculateDurationMinutes,
  getAvailableLanes,
} from './utils';
import {
  BUFFER_MINUTES,
  MAX_CONSECUTIVE_COURSES,
  MAX_DAILY_STUDENT_COURSES,
  DAY_START_HOUR,
  DAY_END_HOUR,
} from '../types';

export const currentUser = writable<User | null>(null);
export const branches = writable<Branch[]>([]);
export const coaches = writable<Coach[]>([]);
export const students = writable<Student[]>([]);
export const courses = writable<Course[]>([]);
export const drafts = writable<(CourseDraft & { savedAt: string })[]>([]);
export const selectedBranchId = writable<string>(BRANCHES[0].id);
export const selectedDate = writable<Date>(new Date());
export const viewMode = writable<'schedule' | 'students' | 'reports'>('schedule');

const undoStack = writable<OperationLog[]>([]);
const redoStack = writable<OperationLog[]>([]);

export const canUndo = derived(undoStack, ($stack) => $stack.length > 0);
export const canRedo = derived(redoStack, ($stack) => $stack.length > 0);

function pushUndoLog(log: OperationLog) {
  undoStack.update(($stack) => [...$stack, log]);
  redoStack.set([]);
}

export function clearHistory() {
  undoStack.set([]);
  redoStack.set([]);
}

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
  return detectConflicts(draft, get(courses), get(coaches));
}

export async function saveCourse(
  draft: CourseDraft,
  skipConflictCheck: boolean = false
): Promise<Course | null> {
  const normalizedDraft: CourseDraft = {
    ...draft,
    startTime: snapTimeToSlot(draft.startTime),
    endTime: snapTimeToSlot(draft.endTime),
  };

  if (!skipConflictCheck) {
    const conflicts = checkCourseConflicts(normalizedDraft);
    if (conflicts.length > 0) {
      return null;
    }
  }

  const now = new Date().toISOString();
  let course: Course;
  let oldCourse: Course | null = null;
  let operationType: 'create' | 'update' = 'create';

  if (normalizedDraft.id) {
    const existing = get(courses).find((c) => c.id === normalizedDraft.id);
    if (existing) {
      oldCourse = { ...existing };
      course = {
        ...existing,
        ...normalizedDraft,
        id: normalizedDraft.id,
        updatedAt: now,
      } as Course;
      operationType = 'update';
    } else {
      return null;
    }
  } else {
    course = {
      ...normalizedDraft,
      id: generateId(),
      status: normalizedDraft.status || 'scheduled',
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

  if (normalizedDraft.id) {
    await db.deleteDraft(normalizedDraft.id);
    drafts.update((list) => list.filter((d) => d.id !== normalizedDraft.id));
  }

  await db.addSyncRecord({
    entityType: 'course',
    entityId: course.id,
    operation: normalizedDraft.id ? 'update' : 'create',
  });

  const log: OperationLog = {
    id: generateId(),
    type: operationType,
    entityType: 'course',
    timestamp: now,
    description: operationType === 'create'
      ? `创建课程：${course.title}`
      : `更新课程：${course.title}`,
    beforeState: oldCourse,
    afterState: course,
  };
  pushUndoLog(log);

  return course;
}

export async function deleteCourse(courseId: string): Promise<void> {
  const existing = get(courses).find((c) => c.id === courseId);
  await db.delete('courses', courseId);
  courses.update((list) => list.filter((c) => c.id !== courseId));
  await db.addSyncRecord({
    entityType: 'course',
    entityId: courseId,
    operation: 'delete',
  });

  if (existing) {
    const log: OperationLog = {
      id: generateId(),
      type: 'delete',
      entityType: 'course',
      timestamp: new Date().toISOString(),
      description: `删除课程：${existing.title}`,
      beforeState: existing,
      afterState: null,
    };
    pushUndoLog(log);
  }
}

export async function undo(): Promise<boolean> {
  const stack = get(undoStack);
  if (stack.length === 0) return false;

  const lastLog = stack[stack.length - 1];
  let success = false;

  try {
    if (lastLog.type === 'create' && lastLog.afterState && !Array.isArray(lastLog.afterState)) {
      await db.delete('courses', (lastLog.afterState as Course).id);
      courses.update((list) => list.filter((c) => c.id !== (lastLog.afterState as Course).id));
      success = true;
    } else if (lastLog.type === 'update' && lastLog.beforeState && !Array.isArray(lastLog.beforeState)) {
      await db.put('courses', lastLog.beforeState as Course);
      courses.update((list) => {
        const idx = list.findIndex((c) => c.id === (lastLog.beforeState as Course).id);
        if (idx >= 0) {
          const newList = [...list];
          newList[idx] = lastLog.beforeState as Course;
          return newList;
        }
        return list;
      });
      success = true;
    } else if (lastLog.type === 'delete' && lastLog.beforeState && !Array.isArray(lastLog.beforeState)) {
      await db.put('courses', lastLog.beforeState as Course);
      courses.update((list) => [...list, lastLog.beforeState as Course]);
      success = true;
    } else if (lastLog.type === 'batch_create' && Array.isArray(lastLog.afterState)) {
      for (const c of lastLog.afterState as Course[]) {
        await db.delete('courses', c.id);
      }
      courses.update((list) => {
        const ids = new Set((lastLog.afterState as Course[]).map((c) => c.id));
        return list.filter((c) => !ids.has(c.id));
      });
      success = true;
    }

    if (success) {
      undoStack.update(($stack) => $stack.slice(0, -1));
      redoStack.update(($stack) => [...$stack, lastLog]);
    }
  } catch {
    success = false;
  }

  return success;
}

export async function redo(): Promise<boolean> {
  const stack = get(redoStack);
  if (stack.length === 0) return false;

  const nextLog = stack[stack.length - 1];
  let success = false;

  try {
    if (nextLog.type === 'create' && nextLog.afterState && !Array.isArray(nextLog.afterState)) {
      await db.put('courses', nextLog.afterState as Course);
      courses.update((list) => [...list, nextLog.afterState as Course]);
      success = true;
    } else if (nextLog.type === 'update' && nextLog.afterState && !Array.isArray(nextLog.afterState)) {
      await db.put('courses', nextLog.afterState as Course);
      courses.update((list) => {
        const idx = list.findIndex((c) => c.id === (nextLog.afterState as Course).id);
        if (idx >= 0) {
          const newList = [...list];
          newList[idx] = nextLog.afterState as Course;
          return newList;
        }
        return list;
      });
      success = true;
    } else if (nextLog.type === 'delete' && nextLog.beforeState && !Array.isArray(nextLog.beforeState)) {
      await db.delete('courses', (nextLog.beforeState as Course).id);
      courses.update((list) => list.filter((c) => c.id !== (nextLog.beforeState as Course).id));
      success = true;
    } else if (nextLog.type === 'batch_create' && Array.isArray(nextLog.afterState)) {
      for (const c of nextLog.afterState as Course[]) {
        await db.put('courses', c);
      }
      courses.update((list) => [...list, ...(nextLog.afterState as Course[])]);
      success = true;
    }

    if (success) {
      redoStack.update(($stack) => $stack.slice(0, -1));
      undoStack.update(($stack) => [...$stack, nextLog]);
    }
  } catch {
    success = false;
  }

  return success;
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

function getCoachDailyCourses(
  coachId: string,
  date: string,
  allCourses: Course[]
): Course[] {
  return allCourses.filter(
    (c) => c.coachId === coachId && c.date === date && c.status !== 'cancelled'
  );
}

function getCoachConsecutiveCount(
  coachId: string,
  date: string,
  startTime: string,
  allCourses: Course[]
): number {
  const dayCourses = getCoachDailyCourses(coachId, date, allCourses).sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  const startMin = timeToMinutes(startTime);
  let consecutive = 1;

  for (let i = 0; i < dayCourses.length; i++) {
    const c = dayCourses[i];
    const cStart = timeToMinutes(c.startTime);
    const cEnd = timeToMinutes(c.endTime);

    if (cEnd + BUFFER_MINUTES === startMin) {
      consecutive++;
      for (let j = i - 1; j >= 0; j--) {
        const prev = dayCourses[j];
        const prevEnd = timeToMinutes(prev.endTime);
        if (prevEnd + BUFFER_MINUTES === timeToMinutes(dayCourses[j + 1].startTime)) {
          consecutive++;
        } else {
          break;
        }
      }
      break;
    }
  }

  return consecutive;
}

function getStudentDailyCount(
  studentId: string,
  date: string,
  allCourses: Course[]
): number {
  return allCourses.filter(
    (c) =>
      c.date === date &&
      c.status !== 'cancelled' &&
      c.studentIds.includes(studentId)
  ).length;
}

function hasStudentConflictOnDate(
  studentIds: string[],
  date: string,
  startTime: string,
  endTime: string,
  allCourses: Course[]
): boolean {
  return allCourses.some(
    (c) =>
      c.date === date &&
      c.status !== 'cancelled' &&
      c.studentIds.some((s) => studentIds.includes(s)) &&
      timesOverlapWithBuffer(startTime, endTime, c.startTime, c.endTime)
  );
}

export function generateAutoSchedule(
  config: BatchScheduleConfig
): { scheduled: CourseDraft[]; errors: string[] } {
  const scheduled: CourseDraft[] = [];
  const errors: string[] = [];
  const allCourses = get(courses);
  const timeSlots = getTimeSlots();
  const preferredStartMin = config.preferredStartTime
    ? timeToMinutes(config.preferredStartTime)
    : timeToMinutes('09:00');

  const dates: string[] = [];
  const start = new Date(config.startDate);
  const end = new Date(config.endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    if (config.avoidWeekends) {
      const day = d.getDay();
      if (day === 0 || day === 6) continue;
    }
    dates.push(dateStr);
  }

  if (dates.length === 0) {
    errors.push('指定日期范围内没有可用的排课日期');
    return { scheduled, errors };
  }

  let sessionsRemaining = config.totalSessions;
  let currentDateIdx = 0;
  let attempts = 0;
  const maxAttempts = dates.length * timeSlots.length * config.coachIds.length * 10;

  while (sessionsRemaining > 0 && attempts < maxAttempts) {
    attempts++;
    const date = dates[currentDateIdx % dates.length];
    currentDateIdx++;

    let scheduledToday = false;

    const sortedTimeSlots = [...timeSlots].sort((a, b) => {
      const diffA = Math.abs(timeToMinutes(a) - preferredStartMin);
      const diffB = Math.abs(timeToMinutes(b) - preferredStartMin);
      return diffA - diffB;
    });

    for (const startTime of sortedTimeSlots) {
      if (scheduledToday) break;

      const startMin = timeToMinutes(startTime);
      const endMin = startMin + config.durationMinutes;
      if (endMin > DAY_END_HOUR * 60) continue;
      const endTime = minutesToTime(endMin);

      for (const coachId of config.coachIds) {
        if (scheduledToday) break;

        const consecutiveCount = getCoachConsecutiveCount(
          coachId,
          date,
          startTime,
          [...allCourses, ...scheduled.map((d) => ({ ...d, id: 'temp' } as Course))]
        );
        if (consecutiveCount >= MAX_CONSECUTIVE_COURSES) {
          continue;
        }

        const coachDailyCourses = getCoachDailyCourses(
          coachId,
          date,
          [...allCourses, ...scheduled.map((d) => ({ ...d, id: 'temp' } as Course))]
        );
        const coachDailyMinutes = coachDailyCourses.reduce(
          (sum, c) => sum + calculateDurationMinutes(c.startTime, c.endTime),
          0
        );
        if (coachDailyMinutes + config.durationMinutes > MAX_DAILY_HOURS * 60) {
          continue;
        }

        const coachConflict = [...allCourses, ...scheduled.map((d) => ({ ...d, id: 'temp' } as Course))].some(
          (c) =>
            c.coachId === coachId &&
            c.date === date &&
            c.status !== 'cancelled' &&
            timesOverlapWithBuffer(startTime, endTime, c.startTime, c.endTime)
        );
        if (coachConflict) continue;

        const studentDailyLimitReached = config.studentIds.some(
          (s) =>
            getStudentDailyCount(
              s,
              date,
              [...allCourses, ...scheduled.map((d) => ({ ...d, id: 'temp' } as Course))]
            ) >= MAX_DAILY_STUDENT_COURSES
        );
        if (studentDailyLimitReached) continue;

        const studentConflict = hasStudentConflictOnDate(
          config.studentIds,
          date,
          startTime,
          endTime,
          [...allCourses, ...scheduled.map((d) => ({ ...d, id: 'temp' } as Course))]
        );
        if (studentConflict) continue;

        const availableLanes = getAvailableLanes(
          {
            title: config.title,
            level: config.level,
            branchId: config.coachIds.length > 0 ? get(selectedBranchId) : '',
            coachId,
            lane: 1,
            startTime,
            endTime,
            date,
            studentIds: config.studentIds,
          },
          [...allCourses, ...scheduled.map((d) => ({ ...d, id: 'temp' } as Course))],
          1
        );

        if (availableLanes.length === 0) continue;

        const draft: CourseDraft = {
          title: config.title,
          level: config.level,
          branchId: get(selectedBranchId),
          coachId,
          lane: availableLanes[0],
          startTime,
          endTime,
          date,
          studentIds: [...config.studentIds],
          skillPointsCovered: [],
          status: 'scheduled',
        };

        scheduled.push(draft);
        sessionsRemaining--;
        scheduledToday = true;
      }
    }
  }

  if (sessionsRemaining > 0) {
    errors.push(`仅成功排 ${scheduled.length} 节课，剩余 ${sessionsRemaining} 节课因资源不足无法安排。请尝试扩大日期范围或减少课程节数。`);
  }

  return { scheduled, errors };
}

export async function saveBatchCourses(drafts: CourseDraft[]): Promise<Course[]> {
  const saved: Course[] = [];
  const now = new Date().toISOString();

  for (const draft of drafts) {
    const course: Course = {
      ...draft,
      id: generateId(),
      status: draft.status || 'scheduled',
      createdAt: now,
      updatedAt: now,
    } as Course;

    await db.put('courses', course);
    saved.push(course);

    await db.addSyncRecord({
      entityType: 'course',
      entityId: course.id,
      operation: 'create',
    });
  }

  courses.update((list) => [...list, ...saved]);

  const log: OperationLog = {
    id: generateId(),
    type: 'batch_create',
    entityType: 'course',
    timestamp: now,
    description: `批量创建 ${saved.length} 节课：${drafts[0]?.title || '课程'}`,
    beforeState: null,
    afterState: saved,
  };
  pushUndoLog(log);

  return saved;
}
