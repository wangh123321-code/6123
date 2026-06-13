import {
  DAY_START_HOUR,
  DAY_END_HOUR,
  TIME_SLOT_MINUTES,
  MAX_DAILY_HOURS,
  type Course,
  type ConflictInfo,
  type CoachDailyStats,
  type SkillLevel,
} from '../types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(':').map(Number);
  return { hours: h, minutes: m };
}

export function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay();
  const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(baseDate);
  monday.setDate(diff);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function getWeekDateStrings(baseDate: Date): string[] {
  return getWeekDates(baseDate).map((d) => formatDate(d));
}

export function getTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    if (TIME_SLOT_MINUTES === 30) {
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
  }
  return slots;
}

export function timeToMinutes(time: string): number {
  const { hours, minutes } = parseTime(time);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

export function calculateDurationMinutes(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

export function getDayName(dateStr: string): string {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const date = parseDate(dateStr);
  return names[date.getDay()];
}

export function isToday(dateStr: string): boolean {
  return dateStr === formatDate(new Date());
}

export function calculateCoachDailyStats(
  coachId: string,
  date: string,
  courses: Course[]
): CoachDailyStats {
  const coachCourses = courses.filter(
    (c) => c.coachId === coachId && c.date === date && c.status !== 'cancelled'
  );
  let totalMinutes = 0;
  for (const course of coachCourses) {
    totalMinutes += calculateDurationMinutes(course.startTime, course.endTime);
  }
  const saturation = Math.min(100, Math.round((totalMinutes / (MAX_DAILY_HOURS * 60)) * 100));
  return {
    coachId,
    date,
    totalMinutes,
    courseCount: coachCourses.length,
    saturation,
  };
}

export function isOverloaded(stats: CoachDailyStats): boolean {
  return stats.totalMinutes > MAX_DAILY_HOURS * 60;
}

export function detectConflicts(
  draft: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  allCourses: Course[]
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const otherCourses = allCourses.filter(
    (c) =>
      c.id !== draft.id &&
      c.date === draft.date &&
      c.branchId === draft.branchId &&
      c.status !== 'cancelled'
  );

  for (const existing of otherCourses) {
    if (!timesOverlap(draft.startTime, draft.endTime, existing.startTime, existing.endTime)) {
      continue;
    }

    if (existing.coachId === draft.coachId) {
      conflicts.push({
        type: 'coach',
        message: `教练在 ${existing.startTime}-${existing.endTime} 已有课程：${existing.title}`,
        conflictingCourseId: existing.id,
        suggestion: findAlternativeSlot(existing, draft, allCourses),
      });
    }

    if (existing.lane === draft.lane) {
      conflicts.push({
        type: 'lane',
        message: `第 ${existing.lane} 泳道在 ${existing.startTime}-${existing.endTime} 已被占用：${existing.title}`,
        conflictingCourseId: existing.id,
        suggestion: findAlternativeLane(existing, draft, allCourses),
      });
    }

    const overlappingStudents = existing.studentIds.filter((s) => draft.studentIds.includes(s));
    if (overlappingStudents.length > 0) {
      conflicts.push({
        type: 'student',
        message: `学员时间冲突：${overlappingStudents.length} 名学员在 ${existing.startTime}-${existing.endTime} 已有课程`,
        conflictingCourseId: existing.id,
      });
    }
  }

  return conflicts;
}

function findAlternativeSlot(
  conflicting: Course,
  draft: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  allCourses: Course[]
): { date?: string; startTime?: string; lane?: number } | undefined {
  const duration = calculateDurationMinutes(draft.startTime, draft.endTime);
  const slots = getTimeSlots();

  for (let i = 0; i < slots.length; i++) {
    const candidateStart = slots[i];
    const candidateEnd = minutesToTime(timeToMinutes(candidateStart) + duration);
    if (timeToMinutes(candidateEnd) > DAY_END_HOUR * 60) continue;

    const hasConflict = allCourses.some(
      (c) =>
        c.id !== draft.id &&
        c.date === draft.date &&
        c.coachId === draft.coachId &&
        c.status !== 'cancelled' &&
        timesOverlap(candidateStart, candidateEnd, c.startTime, c.endTime)
    );

    if (!hasConflict) {
      return { date: draft.date, startTime: candidateStart };
    }
  }
  return undefined;
}

function findAlternativeLane(
  conflicting: Course,
  draft: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  allCourses: Course[]
): { date?: string; startTime?: string; lane?: number } | undefined {
  for (let lane = 1; lane <= 8; lane++) {
    if (lane === draft.lane) continue;
    const hasConflict = allCourses.some(
      (c) =>
        c.id !== draft.id &&
        c.date === draft.date &&
        c.lane === lane &&
        c.branchId === draft.branchId &&
        c.status !== 'cancelled' &&
        timesOverlap(draft.startTime, draft.endTime, c.startTime, c.endTime)
    );
    if (!hasConflict) {
      return { lane };
    }
  }
  return undefined;
}

export function getNextLevel(current: SkillLevel): SkillLevel | null {
  const order: SkillLevel[] = [
    'breaststroke_beginner',
    'breaststroke_intermediate',
    'freestyle_beginner',
    'freestyle_advanced',
    'backstroke_beginner',
    'butterfly_beginner',
  ];
  const idx = order.indexOf(current);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
}

export function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}小时${m > 0 ? m + '分钟' : ''}`;
}
