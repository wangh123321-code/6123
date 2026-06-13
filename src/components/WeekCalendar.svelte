<script lang="ts">
  import { get } from 'svelte/store';
  import type { Course, Coach, ConflictInfo, CourseDraft } from '../types';
  import { LANE_COUNT, DAY_START_HOUR, DAY_END_HOUR, TIME_SLOT_MINUTES, BUFFER_MINUTES } from '../types';
  import {
    getWeekDateStrings,
    getTimeSlots,
    getDayName,
    isToday,
    timeToMinutes,
    calculateDurationMinutes,
    quickCheckConflict,
    snapTimeToSlot,
  } from '../lib/utils';
  import {
    selectedDate,
    selectedBranchId,
    checkCourseConflicts,
    saveCourse,
    currentUser,
    hasPermission,
    visibleCourses,
  } from '../lib/stores';

  export let courses: Course[];
  export let coaches: Coach[];
  export let onConflict: (conflicts: ConflictInfo[], draft: CourseDraft) => void;
  export let onEditCourse: (course: Course) => void;
  export let onCreateCourse: (draft: CourseDraft | null) => void;
  export let onBatchSchedule: () => void;

  export let hoverCell: { date: string; time: string; lane: number } | null = null;
  export let dragConflict: { hasConflict: boolean; reason: string } | null = null;

  $: weekDates = getWeekDateStrings($selectedDate);
  $: timeSlots = getTimeSlots();
  $: laneCount = LANE_COUNT;

  const coachColorMap = new Map(coaches.map((c) => [c.id, c.color]));
  const coachNameMap = new Map(coaches.map((c) => [c.id, c.name]));

  function openNewCourseModal() {
    onCreateCourse(null);
  }

  function openQuickAdd(date: string, time: string, lane: number) {
    const endMinutes = timeToMinutes(time) + 60;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    const draft: CourseDraft = {
      title: '新课程',
      level: 'breaststroke_beginner',
      branchId: get(selectedBranchId),
      coachId: coaches.length > 0 ? coaches[0].id : '',
      lane,
      startTime: time,
      endTime,
      date,
      studentIds: [],
      skillPointsCovered: [],
    };
    onCreateCourse(draft);
  }

  function getCellPosition(course: Course) {
    const dayIdx = weekDates.indexOf(course.date);
    if (dayIdx < 0) return null;
    const startMin = timeToMinutes(course.startTime);
    const slotStartMin = DAY_START_HOUR * 60;
    const topPx = ((startMin - slotStartMin) / TIME_SLOT_MINUTES) * 40;
    const duration = calculateDurationMinutes(course.startTime, course.endTime);
    const heightPx = (duration / TIME_SLOT_MINUTES) * 40 - 4;
    return { dayIdx, topPx, heightPx };
  }

  let draggingPayload: any = null;
  let draggingCourse: Course | null = null;

  function cellFromEvent(event: DragEvent): { date: string; time: string; lane: number } | null {
    const target = event.target as HTMLElement;
    const cell = target.closest('.time-cell') as HTMLElement | null;
    if (!cell) return null;
    const date = cell.dataset.date;
    const time = cell.dataset.time;
    const lane = parseInt(cell.dataset.lane || '0');
    if (!date || !time || !lane) return null;
    return { date, time, lane };
  }

  function checkDragConflict(
    cell: { date: string; time: string; lane: number },
    payload: any
  ): { hasConflict: boolean; reason: string } {
    const endMinutes = timeToMinutes(cell.time) + (draggingCourse ? calculateDurationMinutes(draggingCourse.startTime, draggingCourse.endTime) : 60);
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const draft: CourseDraft = {
      title: payload.type === 'course' ? draggingCourse?.title || '课程' : '临时课程',
      level: payload.type === 'course' ? draggingCourse?.level || 'breaststroke_beginner' : 'breaststroke_beginner',
      branchId: get(selectedBranchId),
      coachId: payload.type === 'coach' ? payload.coachId : (payload.type === 'course' ? draggingCourse?.coachId || '' : ''),
      lane: cell.lane,
      startTime: snapTimeToSlot(cell.time),
      endTime: snapTimeToSlot(endTime),
      date: cell.date,
      studentIds: payload.type === 'course' ? draggingCourse?.studentIds || [] : [],
      id: payload.type === 'course' ? payload.courseId : undefined,
    };

    return quickCheckConflict(draft, get(visibleCourses));
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (!hasPermission(get(currentUser)!.role, 'create_course')) return;
    const cell = cellFromEvent(event);
    if (cell && draggingPayload) {
      hoverCell = cell;
      const conflict = checkDragConflict(cell, draggingPayload);
      dragConflict = conflict;
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = conflict.hasConflict ? 'none' : 'copy';
      }
    }
  }

  function handleDragLeave() {
    hoverCell = null;
    dragConflict = null;
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    hoverCell = null;
    dragConflict = null;
    if (!hasPermission(get(currentUser)!.role, 'create_course')) return;

    const cell = cellFromEvent(event);
    if (!cell || !event.dataTransfer) return;

    let payload;
    try {
      payload = JSON.parse(event.dataTransfer.getData('application/json'));
    } catch {
      draggingPayload = null;
      draggingCourse = null;
      return;
    }

    if (payload.type === 'coach') {
      const coach = coaches.find((c) => c.id === payload.coachId);
      if (!coach) {
        draggingPayload = null;
        return;
      }

      const endMinutes = timeToMinutes(cell.time) + 60;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

      const draft: CourseDraft = {
        title: `${coach.name}的课`,
        level: 'breaststroke_beginner',
        branchId: get(selectedBranchId),
        coachId: coach.id,
        lane: cell.lane,
        startTime: snapTimeToSlot(cell.time),
        endTime: snapTimeToSlot(endTime),
        date: cell.date,
        studentIds: [],
        skillPointsCovered: [],
      };

      const conflicts = checkCourseConflicts(draft);
      if (conflicts.length > 0) {
        onConflict(conflicts, draft);
        draggingPayload = null;
        return;
      }

      const saved = await saveCourse(draft);
      if (!saved) {
        onConflict(checkCourseConflicts(draft), draft);
      }
    } else if (payload.type === 'course') {
      const existingCourse = courses.find((c) => c.id === payload.courseId);
      if (!existingCourse) {
        draggingPayload = null;
        draggingCourse = null;
        return;
      }

      const duration = calculateDurationMinutes(existingCourse.startTime, existingCourse.endTime);
      const endMinutes = timeToMinutes(cell.time) + duration;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

      const draft: CourseDraft = {
        ...existingCourse,
        id: existingCourse.id,
        lane: cell.lane,
        startTime: snapTimeToSlot(cell.time),
        endTime: snapTimeToSlot(endTime),
        date: cell.date,
      };

      const conflicts = checkCourseConflicts(draft);
      if (conflicts.length > 0) {
        onConflict(conflicts, draft);
        draggingPayload = null;
        draggingCourse = null;
        return;
      }

      await saveCourse(draft);
    }

    draggingPayload = null;
    draggingCourse = null;
  }

  function handleCourseDragStart(event: DragEvent, course: Course) {
    if (!hasPermission(get(currentUser)!.role, 'edit_course')) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    draggingCourse = course;
    draggingPayload = { type: 'course', courseId: course.id };
    if (event.dataTransfer) {
      event.dataTransfer.setData(
        'application/json',
        JSON.stringify({ type: 'course', courseId: course.id })
      );
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleCoachDragStart(event: DragEvent, coachId: string) {
    draggingPayload = { type: 'coach', coachId };
    draggingCourse = null;
  }

  function handleDragEnd() {
    hoverCell = null;
    dragConflict = null;
    draggingPayload = null;
    draggingCourse = null;
  }

  function handleCourseClick(course: Course) {
    onEditCourse(course);
  }

  function prevWeek() {
    const d = new Date($selectedDate);
    d.setDate(d.getDate() - 7);
    $selectedDate = d;
  }

  function nextWeek() {
    const d = new Date($selectedDate);
    d.setDate(d.getDate() + 7);
    $selectedDate = d;
  }

  function today() {
    $selectedDate = new Date();
  }
</script>

<div class="week-calendar" role="grid" on:dragover={handleDragOver} on:dragleave={handleDragLeave} on:drop={handleDrop} on:dragend={handleDragEnd}>
  <div class="calendar-header">
    <div class="nav-controls">
      <button class="nav-btn" on:click={prevWeek} aria-label="上一周">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="today-btn" on:click={today}>今天</button>
      <button class="nav-btn" on:click={nextWeek} aria-label="下一周">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <span class="week-range">{weekDates[0].slice(5)} ~ {weekDates[6].slice(5)}</span>
    </div>
    {#if hasPermission($currentUser!.role, 'create_course')}
      <div class="header-buttons">
        <button class="add-course-btn secondary" on:click={onBatchSchedule}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="12" height="10" rx="1"/>
            <line x1="2" y1="7" x2="14" y2="7"/>
            <line x1="6" y1="3" x2="6" y2="13"/>
            <line x1="10" y1="3" x2="10" y2="13"/>
          </svg>
          批量排课
        </button>
        <button class="add-course-btn" on:click={openNewCourseModal}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>
          新建课程
        </button>
      </div>
    {/if}
  </div>

  {#if dragConflict && dragConflict.hasConflict}
    <div class="conflict-tooltip">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>无法放置：{dragConflict.reason}</span>
    </div>
  {/if}

  <div class="calendar-body">
    <div class="scroll-wrapper">
      <div class="time-column">
        <div class="corner-cell">
          <div class="lanes-row">
            {#each Array.from({ length: laneCount }, (_, i) => i + 1) as lane}
              <div class="lane-label" role="columnheader">{lane}道</div>
            {/each}
          </div>
        </div>
        {#each timeSlots as time}
          <div class="time-label" role="rowheader">{time}</div>
        {/each}
      </div>

      <div class="days-container" role="rowgroup">
        {#each weekDates as date, dayIdx}
          <div class="day-column {isToday(date) ? 'today' : ''}" role="gridcell">
            <div class="day-header" role="columnheader">
              <div class="day-name">{getDayName(date)}</div>
              <div class="day-date">{date.slice(5)}</div>
            </div>
            <div class="lanes-header-inner">
              {#each Array.from({ length: laneCount }, (_, i) => i + 1) as lane}
                <div class="lane-label-inner" role="columnheader">{lane}</div>
              {/each}
            </div>
            <div class="day-slots" role="grid">
              {#each timeSlots as time}
                <div class="slot-row" role="row">
                  {#each Array.from({ length: laneCount }, (_, i) => i + 1) as lane}
                    <div
                      class="time-cell {hoverCell && hoverCell.date === date && hoverCell.time === time && hoverCell.lane === lane ? (dragConflict?.hasConflict ? 'hovered-forbidden' : 'hovered') : ''}"
                      role="gridcell"
                      data-date={date}
                      data-time={time}
                      data-lane={lane}
                      on:click|stopPropagation={() => hasPermission($currentUser!.role, 'create_course') && openQuickAdd(date, time, lane)}
                    >
                      {#if hasPermission($currentUser!.role, 'create_course')}
                        <div class="cell-plus">+</div>
                      {/if}
                      {#if hoverCell && hoverCell.date === date && hoverCell.time === time && hoverCell.lane === lane && dragConflict?.hasConflict}
                        <div class="forbidden-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                          </svg>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/each}

              {#each courses.filter((c) => weekDates.includes(c.date)) as course}
                {@const pos = getCellPosition(course)}
                {#if pos && pos.dayIdx === dayIdx}
                  <div
                    class="course-block {course.status} {pos.heightPx < 60 ? 'compact' : ''}"
                    style="top:{pos.topPx}px;height:{pos.heightPx}px;left:{((course.lane - 1) / laneCount) * 100}%;width:{(1 / laneCount) * 100 - 0.6}%;background-color:{coachColorMap.get(course.coachId) || 'var(--ocean-600)'};"
                    draggable={hasPermission($currentUser!.role, 'edit_course')}
                    on:dragstart={(e) => handleCourseDragStart(e, course)}
                    on:click={() => handleCourseClick(course)}
                    title="{course.startTime}-{course.endTime} {course.title} {coachNameMap.get(course.coachId) || ''} {course.studentIds.length}人"
                  >
                    <div class="course-time">{course.startTime}-{course.endTime}</div>
                    <div class="course-title">{course.title}</div>
                    <div class="course-extra">
                      <span class="course-coach">{coachNameMap.get(course.coachId) || '未分配'}</span>
                      <span class="course-students">{course.studentIds.length}人</span>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .week-calendar {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--surface-0);
    overflow: hidden;
    font-family: var(--font-body);
  }

  .calendar-header {
    padding: 14px 20px;
    background: var(--surface-0);
    border-bottom: 1px solid var(--surface-100);
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: var(--shadow-xs);
    z-index: 10;
  }

  .nav-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .nav-btn {
    width: 36px;
    height: 36px;
    border: 1px solid var(--surface-200);
    background: var(--surface-0);
    border-radius: var(--radius-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    transition: all 0.2s var(--ease-out);
  }

  .nav-btn:hover {
    background: var(--teal-50);
    border-color: var(--teal-300);
    color: var(--teal-500);
    box-shadow: var(--shadow-xs);
  }

  .today-btn {
    height: 36px;
    padding: 0 18px;
    border: 1px solid var(--teal-300);
    background: var(--teal-50);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: var(--teal-500);
    font-family: var(--font-body);
    transition: all 0.2s var(--ease-out);
  }

  .today-btn:hover {
    background: var(--teal-100);
    box-shadow: var(--shadow-xs);
  }

  .week-range {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin-left: 12px;
    font-family: var(--font-display);
    letter-spacing: 0.02em;
  }

  .header-buttons {
    display: flex;
    gap: 10px;
  }

  .add-course-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 18px;
    border: none;
    background: linear-gradient(135deg, var(--teal-500), var(--teal-600));
    color: white;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font-body);
    cursor: pointer;
    box-shadow: 0 3px 10px rgba(0, 191, 165, 0.3), 0 1px 2px rgba(0, 191, 165, 0.2);
    transition: all 0.25s var(--ease-spring);
  }

  .add-course-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(0, 191, 165, 0.4), 0 2px 4px rgba(0, 191, 165, 0.25);
    filter: brightness(1.08);
  }

  .add-course-btn:active {
    transform: translateY(0);
  }

  .add-course-btn.secondary {
    background: linear-gradient(135deg, var(--ocean-500), var(--ocean-600));
    box-shadow: 0 3px 10px rgba(59, 130, 246, 0.3), 0 1px 2px rgba(59, 130, 246, 0.2);
  }

  .add-course-btn.secondary:hover {
    box-shadow: 0 6px 18px rgba(59, 130, 246, 0.4), 0 2px 4px rgba(59, 130, 246, 0.25);
  }

  .conflict-tooltip {
    position: absolute;
    top: 72px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--coral-500);
    color: white;
    padding: 10px 18px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: var(--shadow-lg);
    z-index: 100;
    animation: fade-in 0.2s var(--ease-out);
  }

  .conflict-tooltip::after {
    content: '';
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 12px;
    height: 12px;
    background: var(--coral-500);
  }

  .calendar-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .scroll-wrapper {
    flex: 1;
    display: flex;
    overflow: auto;
  }

  .scroll-wrapper::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  .scroll-wrapper::-webkit-scrollbar-track {
    background: var(--surface-50);
  }

  .scroll-wrapper::-webkit-scrollbar-thumb {
    background: var(--surface-200);
    border-radius: 5px;
  }

  .scroll-wrapper::-webkit-scrollbar-thumb:hover {
    background: var(--teal-300);
  }

  .time-column {
    flex-shrink: 0;
    width: 64px;
    background: var(--surface-0);
    border-right: 1px solid var(--surface-100);
    position: sticky;
    left: 0;
    z-index: 5;
  }

  .corner-cell {
    height: 84px;
    border-bottom: 1px solid var(--surface-100);
    display: flex;
    align-items: flex-end;
    position: sticky;
    top: 0;
    background: var(--surface-0);
    z-index: 6;
  }

  .lanes-row {
    display: flex;
    width: 100%;
    height: 24px;
    border-top: 1px solid var(--surface-100);
  }

  .lane-label {
    flex: 1;
    min-width: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .time-label {
    height: 40px;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 3px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    border-bottom: 1px solid var(--surface-50);
  }

  .days-container {
    flex: 1;
    display: flex;
    min-width: 0;
  }

  .day-column {
    flex: 1;
    min-width: 360px;
    border-right: 1px solid var(--surface-100);
    position: relative;
  }

  .day-column.today {
    background: var(--teal-50);
  }

  .day-column.today .day-header {
    background: var(--teal-500);
    color: white;
    border-bottom-color: var(--teal-400);
  }

  .day-column.today .day-name,
  .day-column.today .day-date {
    color: white;
  }

  .day-header {
    height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--surface-100);
    background: var(--surface-0);
    position: sticky;
    top: 0;
    z-index: 4;
  }

  .day-column.today .day-header {
    border-top: 3px solid var(--teal-500);
    height: 63px;
  }

  .day-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .day-date {
    font-size: 18px;
    font-weight: 800;
    color: var(--text-primary);
    margin-top: 2px;
    font-family: var(--font-display);
  }

  .lanes-header-inner {
    display: flex;
    height: 24px;
    border-bottom: 1px solid var(--surface-100);
    background: var(--surface-50);
    position: sticky;
    top: 60px;
    z-index: 3;
  }

  .day-column.today .lanes-header-inner {
    top: 63px;
  }

  .lane-label-inner {
    flex: 1;
    min-width: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    border-right: 1px solid var(--surface-100);
  }

  .lane-label-inner:last-child {
    border-right: none;
  }

  .day-slots {
    position: relative;
  }

  .slot-row {
    display: flex;
    height: 40px;
  }

  .time-cell {
    flex: 1;
    min-width: 40px;
    border-right: 1px solid var(--surface-50);
    border-bottom: 1px solid var(--surface-50);
    transition: background 0.2s var(--ease-out);
    position: relative;
    cursor: pointer;
    overflow: hidden;
  }

  .time-cell:hover {
    background: rgba(0, 191, 165, 0.04);
  }

  .cell-plus {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    opacity: 0;
    font-size: 20px;
    font-weight: 300;
    pointer-events: none;
    transition: all 0.15s var(--ease-out);
  }

  .time-cell:hover .cell-plus {
    opacity: 0.4;
    color: var(--teal-500);
    font-size: 22px;
  }

  .time-cell.hovered {
    background: rgba(0, 191, 165, 0.12);
    box-shadow: inset 0 0 0 2px var(--teal-500);
    animation: pulse-glow 1.2s ease-in-out infinite;
  }

  .time-cell.hovered .cell-plus {
    opacity: 0;
  }

  .time-cell.hovered-forbidden {
    background: rgba(239, 68, 68, 0.12);
    box-shadow: inset 0 0 0 2px var(--coral-500);
    animation: pulse-glow-red 1.2s ease-in-out infinite;
    cursor: not-allowed;
  }

  .time-cell.hovered-forbidden .cell-plus {
    opacity: 0;
  }

  .forbidden-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--coral-500);
    animation: forbidden-pulse 1s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: inset 0 0 0 2px var(--teal-500), inset 0 0 6px rgba(0, 191, 165, 0.15); }
    50% { box-shadow: inset 0 0 0 2px var(--teal-400), inset 0 0 12px rgba(0, 191, 165, 0.3); }
  }

  @keyframes pulse-glow-red {
    0%, 100% { box-shadow: inset 0 0 0 2px var(--coral-500), inset 0 0 6px rgba(239, 68, 68, 0.15); }
    50% { box-shadow: inset 0 0 0 2px var(--coral-400), inset 0 0 12px rgba(239, 68, 68, 0.3); }
  }

  @keyframes forbidden-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.1); }
  }

  .course-block {
    position: absolute;
    border-radius: var(--radius-sm);
    padding: 5px 7px;
    color: white;
    font-size: 11px;
    cursor: pointer;
    overflow: hidden;
    box-shadow: var(--shadow-sm), inset 0 0 0 1px rgba(255, 255, 255, 0.12);
    transition: transform 0.2s var(--ease-spring), box-shadow 0.2s var(--ease-out), filter 0.2s ease-out;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .course-block:hover {
    transform: scale(1.03) translateY(-1px);
    box-shadow: var(--shadow-lg), inset 0 0 0 1px rgba(255, 255, 255, 0.2);
    filter: brightness(1.08);
    z-index: 10;
  }

  .course-block.completed {
    opacity: 0.6;
    filter: saturate(0.5);
  }

  .course-block.cancelled {
    opacity: 0.35;
    text-decoration: line-through;
    filter: grayscale(0.4);
  }

  .course-time {
    font-weight: 700;
    font-size: 10px;
    opacity: 0.95;
    line-height: 1.2;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  .course-title {
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--font-display);
    line-height: 1.2;
    font-size: 11.5px;
    flex-shrink: 0;
  }

  .course-extra {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
    opacity: 0.9;
    margin-top: auto;
    line-height: 1.2;
  }

  .course-coach {
    font-size: 9.5px;
    opacity: 0.9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 70%;
  }

  .course-students {
    font-size: 9.5px;
    font-weight: 700;
    opacity: 0.95;
    flex-shrink: 0;
    padding: 1px 4px;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    line-height: 1.4;
  }

  .course-block.compact {
    padding: 3px 5px;
    gap: 0;
  }

  .course-block.compact .course-extra {
    display: none;
  }

  .course-block.compact .course-title {
    font-size: 10.5px;
  }
</style>
