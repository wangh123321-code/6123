import {
  DAY_START_HOUR,
  DAY_END_HOUR,
  TIME_SLOT_MINUTES,
  MAX_DAILY_HOURS,
  LANE_COUNT,
  BUFFER_MINUTES,
  MAX_CONSECUTIVE_COURSES,
  MAX_DAILY_STUDENT_COURSES,
  type Course,
  type ConflictInfo,
  type CoachDailyStats,
  type SkillLevel,
  type CourseDraft,
  type Coach,
  type TimeSlotSuggestion,
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

export function timesOverlapWithBuffer(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
  bufferMinutes: number = BUFFER_MINUTES
): boolean {
  const s1 = timeToMinutes(start1) - bufferMinutes;
  const e1 = timeToMinutes(end1) + bufferMinutes;
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

export function snapToTimeSlot(minutes: number): number {
  return Math.round(minutes / TIME_SLOT_MINUTES) * TIME_SLOT_MINUTES;
}

export function snapTimeToSlot(timeStr: string): string {
  const minutes = timeToMinutes(timeStr);
  return minutesToTime(snapToTimeSlot(minutes));
}

export function calculateDurationMinutes(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

export function getAvailableTimeSlots(
  draft: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  allCourses: Course[],
  coaches: Coach[],
  count: number = 3
): TimeSlotSuggestion[] {
  const duration = calculateDurationMinutes(draft.startTime, draft.endTime);
  const slots = getTimeSlots();
  const suggestions: TimeSlotSuggestion[] = [];
  const currentStartMinutes = timeToMinutes(draft.startTime);

  const sortedSlots = [...slots].sort((a, b) => {
    const diffA = Math.abs(timeToMinutes(a) - currentStartMinutes);
    const diffB = Math.abs(timeToMinutes(b) - currentStartMinutes);
    return diffA - diffB;
  });

  for (const candidateStart of sortedSlots) {
    const candidateStartMin = timeToMinutes(candidateStart);
    const candidateEndMin = candidateStartMin + duration;
    if (candidateEndMin > DAY_END_HOUR * 60) continue;
    const candidateEnd = minutesToTime(candidateEndMin);

    const hasCoachConflict = allCourses.some(
      (c) =>
        c.id !== draft.id &&
        c.date === draft.date &&
        c.coachId === draft.coachId &&
        c.status !== 'cancelled' &&
        timesOverlapWithBuffer(candidateStart, candidateEnd, c.startTime, c.endTime)
    );

    const hasLaneConflict = allCourses.some(
      (c) =>
        c.id !== draft.id &&
        c.date === draft.date &&
        c.lane === draft.lane &&
        c.branchId === draft.branchId &&
        c.status !== 'cancelled' &&
        timesOverlapWithBuffer(candidateStart, candidateEnd, c.startTime, c.endTime)
    );

    const hasStudentConflict = draft.studentIds.length > 0 && allCourses.some(
      (c) =>
        c.id !== draft.id &&
        c.date === draft.date &&
        c.status !== 'cancelled' &&
        c.studentIds.some((s) => draft.studentIds.includes(s)) &&
        timesOverlapWithBuffer(candidateStart, candidateEnd, c.startTime, c.endTime)
    );

    if (!hasCoachConflict && !hasLaneConflict && !hasStudentConflict) {
      suggestions.push({
        date: draft.date,
        startTime: candidateStart,
        endTime: candidateEnd,
      });
      if (suggestions.length >= count) break;
    }
  }

  return suggestions;
}

export function getAvailableCoaches(
  draft: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  allCourses: Course[],
  coaches: Coach[],
  count: number = 3
): { id: string; name: string; color: string }[] {
  const suggestions: { id: string; name: string; color: string }[] = [];

  for (const coach of coaches) {
    if (coach.id === draft.coachId) continue;
    if (coach.branchId !== draft.branchId) continue;

    const hasConflict = allCourses.some(
      (c) =>
        c.id !== draft.id &&
        c.date === draft.date &&
        c.coachId === coach.id &&
        c.status !== 'cancelled' &&
        timesOverlapWithBuffer(draft.startTime, draft.endTime, c.startTime, c.endTime)
    );

    if (!hasConflict) {
      suggestions.push({ id: coach.id, name: coach.name, color: coach.color });
      if (suggestions.length >= count) break;
    }
  }

  return suggestions;
}

export function getAvailableLanes(
  draft: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  allCourses: Course[],
  count: number = 3
): number[] {
  const suggestions: number[] = [];

  for (let lane = 1; lane <= LANE_COUNT; lane++) {
    if (lane === draft.lane) continue;

    const hasConflict = allCourses.some(
      (c) =>
        c.id !== draft.id &&
        c.date === draft.date &&
        c.lane === lane &&
        c.branchId === draft.branchId &&
        c.status !== 'cancelled' &&
        timesOverlapWithBuffer(draft.startTime, draft.endTime, c.startTime, c.endTime)
    );

    if (!hasConflict) {
      suggestions.push(lane);
      if (suggestions.length >= count) break;
    }
  }

  return suggestions;
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
  allCourses: Course[],
  coaches: Coach[] = []
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const otherCourses = allCourses.filter(
    (c) =>
      c.id !== draft.id &&
      c.date === draft.date &&
      c.branchId === draft.branchId &&
      c.status !== 'cancelled'
  );

  const normalizedDraft = {
    ...draft,
    startTime: snapTimeToSlot(draft.startTime),
    endTime: snapTimeToSlot(draft.endTime),
  };

  const coachConflicts: Course[] = [];
  const laneConflicts: Course[] = [];
  const studentConflicts: { course: Course; students: string[] }[] = [];

  for (const existing of otherCourses) {
    if (!timesOverlapWithBuffer(
      normalizedDraft.startTime,
      normalizedDraft.endTime,
      existing.startTime,
      existing.endTime
    )) {
      continue;
    }

    if (existing.coachId === normalizedDraft.coachId) {
      coachConflicts.push(existing);
    }

    if (existing.lane === normalizedDraft.lane) {
      laneConflicts.push(existing);
    }

    const overlappingStudents = existing.studentIds.filter((s) =>
      normalizedDraft.studentIds.includes(s)
    );
    if (overlappingStudents.length > 0) {
      studentConflicts.push({ course: existing, students: overlappingStudents });
    }
  }

  if (coachConflicts.length > 0) {
    const firstConflict = coachConflicts[0];
    const timeSlots = getAvailableTimeSlots(normalizedDraft, allCourses, coaches, 3);
    const altCoaches = getAvailableCoaches(normalizedDraft, allCourses, coaches, 3);
    const altLanes = getAvailableLanes(normalizedDraft, allCourses, 3);

    conflicts.push({
      type: 'coach',
      message: `教练时间冲突：${coachConflicts.length} 节课重叠（含前后${BUFFER_MINUTES}分钟缓冲）。冲突课程：${coachConflicts.map((c) => `${c.startTime}-${c.endTime} ${c.title}`).join('、')}`,
      conflictingCourseId: firstConflict.id,
      conflictingCourseTitle: firstConflict.title,
      suggestion: timeSlots.length > 0 ? {
        date: timeSlots[0].date,
        startTime: timeSlots[0].startTime,
        lane: altLanes.length > 0 ? altLanes[0] : undefined,
        coachId: altCoaches.length > 0 ? altCoaches[0].id : undefined,
        coachName: altCoaches.length > 0 ? altCoaches[0].name : undefined,
      } : undefined,
      suggestedTimeSlots: timeSlots,
      suggestedCoaches: altCoaches,
      suggestedLanes: altLanes,
    });
  }

  if (laneConflicts.length > 0) {
    const firstConflict = laneConflicts[0];
    const timeSlots = getAvailableTimeSlots(normalizedDraft, allCourses, coaches, 3);
    const altCoaches = getAvailableCoaches(normalizedDraft, allCourses, coaches, 3);
    const altLanes = getAvailableLanes(normalizedDraft, allCourses, 3);

    conflicts.push({
      type: 'lane',
      message: `泳道占用冲突：第 ${normalizedDraft.lane} 泳道在 ${firstConflict.startTime}-${firstConflict.endTime} 已被「${firstConflict.title}」占用（含前后${BUFFER_MINUTES}分钟缓冲）`,
      conflictingCourseId: firstConflict.id,
      conflictingCourseTitle: firstConflict.title,
      suggestion: altLanes.length > 0 ? {
        lane: altLanes[0],
        date: timeSlots.length > 0 ? timeSlots[0].date : undefined,
        startTime: timeSlots.length > 0 ? timeSlots[0].startTime : undefined,
      } : undefined,
      suggestedTimeSlots: timeSlots,
      suggestedCoaches: altCoaches,
      suggestedLanes: altLanes,
    });
  }

  if (studentConflicts.length > 0) {
    const firstConflict = studentConflicts[0];
    const timeSlots = getAvailableTimeSlots(normalizedDraft, allCourses, coaches, 3);
    const altCoaches = getAvailableCoaches(normalizedDraft, allCourses, coaches, 3);
    const altLanes = getAvailableLanes(normalizedDraft, allCourses, 3);

    const allOverlappingStudentIds = new Set<string>();
    studentConflicts.forEach((sc) =>
      sc.students.forEach((s) => allOverlappingStudentIds.add(s))
    );

    conflicts.push({
      type: 'student',
      message: `学员时间冲突：${allOverlappingStudentIds.size} 名学员在 ${firstConflict.course.startTime}-${firstConflict.course.endTime} 已有课程「${firstConflict.course.title}」（含前后${BUFFER_MINUTES}分钟缓冲）`,
      conflictingCourseId: firstConflict.course.id,
      conflictingCourseTitle: firstConflict.course.title,
      suggestion: timeSlots.length > 0 ? {
        date: timeSlots[0].date,
        startTime: timeSlots[0].startTime,
        lane: altLanes.length > 0 ? altLanes[0] : undefined,
      } : undefined,
      suggestedTimeSlots: timeSlots,
      suggestedCoaches: altCoaches,
      suggestedLanes: altLanes,
    });
  }

  return conflicts;
}

export function quickCheckConflict(
  draft: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  allCourses: Course[]
): { hasConflict: boolean; reason?: string } {
  const normalizedDraft = {
    ...draft,
    startTime: snapTimeToSlot(draft.startTime),
    endTime: snapTimeToSlot(draft.endTime),
  };

  const otherCourses = allCourses.filter(
    (c) =>
      c.id !== draft.id &&
      c.date === draft.date &&
      c.branchId === draft.branchId &&
      c.status !== 'cancelled'
  );

  for (const existing of otherCourses) {
    if (!timesOverlapWithBuffer(
      normalizedDraft.startTime,
      normalizedDraft.endTime,
      existing.startTime,
      existing.endTime
    )) {
      continue;
    }

    if (existing.coachId === normalizedDraft.coachId) {
      return {
        hasConflict: true,
        reason: `教练在 ${existing.startTime}-${existing.endTime} 已有课程：${existing.title}`,
      };
    }

    if (existing.lane === normalizedDraft.lane) {
      return {
        hasConflict: true,
        reason: `第 ${existing.lane} 泳道已被「${existing.title}」占用`,
      };
    }

    const overlappingStudents = existing.studentIds.filter((s) =>
      normalizedDraft.studentIds.includes(s)
    );
    if (overlappingStudents.length > 0) {
      return {
        hasConflict: true,
        reason: `${overlappingStudents.length} 名学员有时间冲突`,
      };
    }
  }

  return { hasConflict: false };
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
