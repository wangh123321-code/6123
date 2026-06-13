<script lang="ts">
  import { get } from 'svelte/store';
  import type { Course, CourseDraft, Coach, Student, SkillLevel } from '../types';
  import { LANE_COUNT, SKILL_LEVELS, getSkillLevelName } from '../types';
  import { getTimeSlots } from '../lib/utils';
  import { saveCourse, deleteCourse, checkCourseConflicts, visibleStudents, visibleCoaches } from '../lib/stores';

  export let course: Course | null;
  export let draft: CourseDraft | null = null;
  export let branchId: string;
  export let onClose: () => void;
  export let onConflict: (conflicts: any[], draft: CourseDraft) => void;

  let visible = true;
  let title = '';
  let level: SkillLevel = 'breaststroke_beginner';
  let coachId = '';
  let lane = 1;
  let date = '';
  let startTime = '09:00';
  let endTime = '10:00';
  let studentIds: string[] = [];
  let notes = '';
  let searchText = '';

  $: coaches = $visibleCoaches;
  $: allStudents = $visibleStudents;
  $: filteredStudents = allStudents.filter(
    (s) => s.name.includes(searchText) || s.parentName.includes(searchText)
  );

  $: if (course) {
    title = course.title;
    level = course.level;
    coachId = course.coachId;
    lane = course.lane;
    date = course.date;
    startTime = course.startTime;
    endTime = course.endTime;
    studentIds = [...course.studentIds];
    notes = course.notes || '';
  } else if (draft) {
    title = draft.title;
    level = draft.level;
    coachId = draft.coachId || coaches[0]?.id || '';
    lane = draft.lane;
    date = draft.date;
    startTime = draft.startTime;
    endTime = draft.endTime;
    studentIds = draft.studentIds ? [...draft.studentIds] : [];
    notes = '';
  } else {
    title = '';
    level = 'breaststroke_beginner';
    coachId = coaches[0]?.id || '';
    lane = 1;
    date = '';
    startTime = '09:00';
    endTime = '10:00';
    studentIds = [];
    notes = '';
  }

  $: timeSlots = getTimeSlots();

  function toggleStudent(id: string) {
    if (studentIds.includes(id)) {
      studentIds = studentIds.filter((s) => s !== id);
    } else {
      studentIds = [...studentIds, id];
    }
  }

  async function handleSave() {
    if (!title || !coachId || !date || !startTime || !endTime) {
      alert('请填写完整信息');
      return;
    }

    const draft: CourseDraft = {
      id: course?.id,
      title,
      level,
      branchId,
      coachId,
      lane,
      startTime,
      endTime,
      date,
      studentIds,
      notes,
      status: course?.status || 'scheduled',
    };

    const conflicts = checkCourseConflicts(draft);
    if (conflicts.length > 0) {
      onConflict(conflicts, draft);
      return;
    }

    const saved = await saveCourse(draft);
    if (saved) {
      visible = false;
      onClose();
    }
  }

  async function handleDelete() {
    if (!course) return;
    if (confirm('确定要删除这节课吗？')) {
      await deleteCourse(course.id);
      visible = false;
      onClose();
    }
  }

  function handleClose() {
    visible = false;
    onClose();
  }
</script>

{#if visible}
  <div class="backdrop" on:click={handleClose}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <div class="header-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <h3>{course ? '编辑课程' : '新建课程'}</h3>
        <button class="close-btn" on:click={handleClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          <div class="form-item full">
            <label>课程名称</label>
            <input type="text" bind:value={title} placeholder="例如：蛙泳入门班" />
          </div>

          <div class="form-item">
            <label>级别</label>
            <select bind:value={level}>
              {#each SKILL_LEVELS as sl}
                <option value={sl.level}>{sl.name}</option>
              {/each}
            </select>
          </div>

          <div class="form-item">
            <label>教练</label>
            <select bind:value={coachId}>
              {#each coaches as coach}
                <option value={coach.id}>{coach.name}</option>
              {/each}
            </select>
          </div>

          <div class="form-item">
            <label>泳道</label>
            <select bind:value={lane}>
              {#each Array.from({ length: LANE_COUNT }, (_, i) => i + 1) as l}
                <option value={l}>第 {l} 泳道</option>
              {/each}
            </select>
          </div>

          <div class="form-item">
            <label>日期</label>
            <input type="date" bind:value={date} />
          </div>

          <div class="form-item">
            <label>开始时间</label>
            <select bind:value={startTime}>
              {#each timeSlots.slice(0, -2) as t}
                <option value={t}>{t}</option>
              {/each}
            </select>
          </div>

          <div class="form-item">
            <label>结束时间</label>
            <select bind:value={endTime}>
              {#each timeSlots.slice(2) as t}
                <option value={t}>{t}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="form-item">
          <label>学员名单（已选 {studentIds.length} 人）</label>
          <div class="student-search">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              bind:value={searchText}
              placeholder="搜索学员姓名或家长姓名..."
            />
          </div>
          <div class="student-list">
            {#each filteredStudents as student}
              <label
                class="student-item {studentIds.includes(student.id) ? 'selected' : ''} {student.currentLevel === level ? 'match-level' : ''}"
              >
                <input
                  type="checkbox"
                  checked={studentIds.includes(student.id)}
                  on:change={() => toggleStudent(student.id)}
                />
                <div class="student-info">
                  <span class="student-name">{student.name}</span>
                  <span class="student-level">{getSkillLevelName(student.currentLevel)}</span>
                </div>
                {#if student.currentLevel === level}
                  <span class="level-match-tag">匹配</span>
                {/if}
              </label>
            {/each}
            {#if filteredStudents.length === 0}
              <div class="empty">没有匹配的学员</div>
            {/if}
          </div>
        </div>

        <div class="form-item">
          <label>备注</label>
          <textarea bind:value={notes} rows="2" placeholder="可选"></textarea>
        </div>
      </div>

      <div class="modal-footer">
        {#if course}
          <button class="btn btn-danger" on:click={handleDelete}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            删除
          </button>
        {/if}
        <div style="flex: 1"></div>
        <button class="btn btn-ghost" on:click={handleClose}>取消</button>
        <button class="btn btn-primary" on:click={handleSave}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
          {course ? '保存修改' : '创建课程'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 22, 40, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fade-in 0.2s var(--ease-out);
  }

  .modal {
    background: var(--surface-0);
    border-radius: var(--radius-xl);
    width: 680px;
    max-width: 95vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
    animation: slide-up 0.3s var(--ease-spring);
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 28px;
    background: linear-gradient(135deg, var(--ocean-700), var(--ocean-500));
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  .header-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.15);
    border-radius: var(--radius-md);
    color: white;
    flex-shrink: 0;
  }

  .modal-header h3 {
    margin: 0;
    flex: 1;
    font-size: 18px;
    font-weight: 700;
    font-family: var(--font-display);
    color: white;
    letter-spacing: 0.01em;
  }

  .close-btn {
    width: 34px;
    height: 34px;
    border: none;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    cursor: pointer;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .modal-body {
    padding: 24px 28px;
    overflow-y: auto;
    flex: 1;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }

  .form-item {
    margin-bottom: 16px;
  }

  .form-item.full {
    grid-column: 1 / -1;
  }

  .form-item label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
    font-family: var(--font-display);
    letter-spacing: 0.02em;
  }

  .form-item input,
  .form-item select,
  .form-item textarea {
    width: 100%;
    padding: 9px 14px;
    border: 1.5px solid var(--surface-200);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: var(--font-body);
    box-sizing: border-box;
    background: var(--surface-0);
    color: var(--text-primary);
    transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
  }

  .form-item input:focus,
  .form-item select:focus,
  .form-item textarea:focus {
    outline: none;
    border-color: var(--teal-400);
    box-shadow: 0 0 0 3px var(--teal-50);
  }

  .form-item input::placeholder,
  .form-item textarea::placeholder {
    color: var(--text-muted);
  }

  .student-search {
    position: relative;
    margin-bottom: 8px;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }

  .student-search input {
    padding-left: 36px;
  }

  .student-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1.5px solid var(--surface-200);
    border-radius: var(--radius-md);
  }

  .student-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--surface-100);
    cursor: pointer;
    transition: background 0.15s;
  }

  .student-item:last-child {
    border-bottom: none;
  }

  .student-item:hover {
    background: var(--surface-50);
  }

  .student-item.selected {
    background: var(--teal-50);
  }

  .student-item.match-level {
    border-left: 3px solid var(--teal-500);
  }

  .student-item input {
    width: 18px;
    height: 18px;
    accent-color: var(--teal-500);
    flex-shrink: 0;
  }

  .student-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .student-name {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 14px;
  }

  .student-level {
    font-size: 12px;
    color: var(--text-muted);
  }

  .level-match-tag {
    font-size: 11px;
    padding: 2px 10px;
    background: var(--teal-500);
    color: white;
    border-radius: var(--radius-full);
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  .modal-footer {
    padding: 16px 28px;
    border-top: 1px solid var(--surface-200);
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .btn {
    padding: 10px 20px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    border: none;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s var(--ease-out);
  }

  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--surface-200);
  }

  .btn-ghost:hover {
    background: var(--surface-50);
    color: var(--text-primary);
  }

  .btn-primary {
    background: var(--teal-500);
    color: white;
  }

  .btn-primary:hover {
    background: var(--teal-600);
    box-shadow: var(--shadow-glow-teal);
  }

  .btn-danger {
    background: var(--coral-100);
    color: var(--coral-600);
  }

  .btn-danger:hover {
    background: var(--coral-200);
    box-shadow: var(--shadow-glow-coral);
  }
</style>
