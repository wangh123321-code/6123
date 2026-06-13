<script lang="ts">
  import { get } from 'svelte/store';
  import type { BatchScheduleConfig, CourseDraft, Coach, Student, SkillLevel } from '../types';
  import { SKILL_LEVELS, getSkillLevelName, MAX_CONSECUTIVE_COURSES, MAX_DAILY_STUDENT_COURSES, BUFFER_MINUTES } from '../types';
  import { formatDate } from '../lib/utils';
  import { generateAutoSchedule, saveBatchCourses, selectedBranchId, visibleCoaches, visibleStudents } from '../lib/stores';

  export let onClose: () => void;

  let visible = true;
  let title = '';
  let level: SkillLevel = 'breaststroke_beginner';
  let coachIds: string[] = [];
  let studentIds: string[] = [];
  let totalSessions = 10;
  let startDate = formatDate(new Date());
  let endDate = formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  let durationMinutes = 60;
  let preferredStartTime = '09:00';
  let avoidWeekends = true;
  let searchText = '';
  let generatedSchedules: CourseDraft[] = [];
  let errors: string[] = [];
  let isGenerating = false;
  let isSaving = false;

  $: coaches = $visibleCoaches;
  $: allStudents = $visibleStudents;
  $: filteredStudents = allStudents.filter(
    (s) => s.name.includes(searchText) || s.parentName.includes(searchText)
  );

  function toggleCoach(id: string) {
    if (coachIds.includes(id)) {
      coachIds = coachIds.filter((c) => c !== id);
    } else {
      coachIds = [...coachIds, id];
    }
  }

  function toggleStudent(id: string) {
    if (studentIds.includes(id)) {
      studentIds = studentIds.filter((s) => s !== id);
    } else {
      studentIds = [...studentIds, id];
    }
  }

  function selectAllCoaches() {
    if (coachIds.length === coaches.length) {
      coachIds = [];
    } else {
      coachIds = coaches.map((c) => c.id);
    }
  }

  function selectAllStudents() {
    if (studentIds.length === filteredStudents.length) {
      studentIds = studentIds.filter((s) => !filteredStudents.some((fs) => fs.id === s));
    } else {
      const newIds = new Set(studentIds);
      filteredStudents.forEach((s) => newIds.add(s.id));
      studentIds = Array.from(newIds);
    }
  }

  function generatePreview() {
    if (!title || coachIds.length === 0 || studentIds.length === 0 || !startDate || !endDate) {
      alert('请填写完整信息：课程名称、教练、学员、起止日期');
      return;
    }

    if (totalSessions < 1 || totalSessions > 100) {
      alert('课程节数需在 1-100 之间');
      return;
    }

    isGenerating = true;
    generatedSchedules = [];
    errors = [];

    setTimeout(() => {
      const config: BatchScheduleConfig = {
        coachIds,
        studentIds,
        totalSessions,
        startDate,
        endDate,
        title,
        level,
        durationMinutes,
        preferredStartTime,
        avoidWeekends,
      };

      const result = generateAutoSchedule(config);
      generatedSchedules = result.scheduled;
      errors = result.errors;
      isGenerating = false;
    }, 100);
  }

  async function handleSave() {
    if (generatedSchedules.length === 0) return;

    isSaving = true;
    try {
      await saveBatchCourses(generatedSchedules);
      visible = false;
      onClose();
    } finally {
      isSaving = false;
    }
  }

  function handleClose() {
    visible = false;
    onClose();
  }

  function getCoachName(id: string): string {
    return coaches.find((c) => c.id === id)?.name || id;
  }

  function formatScheduleDate(dateStr: string): string {
    const d = new Date(dateStr);
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${dateStr.slice(5)} ${days[d.getDay()]}`;
  }
</script>

{#if visible}
  <div class="backdrop" on:click={handleClose}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <div class="header-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <line x1="8" y1="14" x2="16" y2="14"/>
          </svg>
        </div>
        <h3>批量自动排课</h3>
        <button class="close-btn" on:click={handleClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="rules-notice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4"/>
            <path d="M12 8h.01"/>
          </svg>
          <span>排课规则：教练不连续上课超 {MAX_CONSECUTIVE_COURSES} 节，同一学生每天最多 {MAX_DAILY_STUDENT_COURSES} 节，含前后 {BUFFER_MINUTES} 分钟缓冲时间</span>
        </div>

        {#if generatedSchedules.length === 0}
          <div class="form-grid">
            <div class="form-item full">
              <label>课程名称</label>
              <input type="text" bind:value={title} placeholder="例如：暑期蛙泳集训班" />
            </div>

            <div class="form-item">
              <label>课程级别</label>
              <select bind:value={level}>
                {#each SKILL_LEVELS as sl}
                  <option value={sl.level}>{sl.name}</option>
                {/each}
              </select>
            </div>

            <div class="form-item">
              <label>每节课时长</label>
              <select bind:value={durationMinutes}>
                <option value={30}>30 分钟</option>
                <option value={45}>45 分钟</option>
                <option value={60}>60 分钟</option>
                <option value={90}>90 分钟</option>
                <option value={120}>120 分钟</option>
              </select>
            </div>

            <div class="form-item">
              <label>课程总节数</label>
              <input type="number" bind:value={totalSessions} min="1" max="100" />
            </div>

            <div class="form-item">
              <label>开始日期</label>
              <input type="date" bind:value={startDate} />
            </div>

            <div class="form-item">
              <label>结束日期</label>
              <input type="date" bind:value={endDate} />
            </div>

            <div class="form-item">
              <label>首选开始时间</label>
              <select bind:value={preferredStartTime}>
                <option value="08:00">08:00</option>
                <option value="09:00">09:00</option>
                <option value="10:00">10:00</option>
                <option value="14:00">14:00</option>
                <option value="15:00">15:00</option>
                <option value="16:00">16:00</option>
                <option value="18:00">18:00</option>
                <option value="19:00">19:00</option>
              </select>
            </div>

            <div class="form-item checkbox-item">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={avoidWeekends} />
                <span>避开周末</span>
              </label>
            </div>

            <div class="form-item full">
              <div class="selection-header">
                <label>选择教练（已选 {coachIds.length} 人）</label>
                <button type="button" class="select-all-btn" on:click={selectAllCoaches}>
                  {coachIds.length === coaches.length ? '取消全选' : '全选'}
                </button>
              </div>
              <div class="coach-selection">
                {#each coaches as coach}
                  <label
                    class="coach-card {coachIds.includes(coach.id) ? 'selected' : ''}"
                    style="--coach-color: {coach.color};"
                  >
                    <input
                      type="checkbox"
                      checked={coachIds.includes(coach.id)}
                      on:change={() => toggleCoach(coach.id)}
                    />
                    <div class="coach-avatar" style="background: {coach.color};"></div>
                    <div class="coach-info">
                      <span class="coach-name">{coach.name}</span>
                      <span class="coach-specialties">{coach.specialties.slice(0, 2).join('、')}</span>
                    </div>
                  </label>
                {/each}
              </div>
            </div>

            <div class="form-item full">
              <div class="selection-header">
                <label>选择学员（已选 {studentIds.length} 人）</label>
                <button type="button" class="select-all-btn" on:click={selectAllStudents}>
                  {studentIds.length === filteredStudents.length && filteredStudents.length > 0 ? '取消全选' : '全选当前'}
                </button>
              </div>
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
              <div class="student-selection">
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
          </div>
        {:else}
          <div class="preview-section">
            <div class="preview-header">
              <h4>排课预览</h4>
              <span class="preview-count">共 {generatedSchedules.length} 节课</span>
            </div>

            {#if errors.length > 0}
              <div class="preview-warnings">
                {#each errors as error}
                  <div class="warning-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {error}
                  </div>
                {/each}
              </div>
            {/if}

            <div class="schedule-list">
              {#each generatedSchedules as schedule, idx}
                <div class="schedule-item">
                  <span class="schedule-index">{idx + 1}</span>
                  <span class="schedule-date">{formatScheduleDate(schedule.date)}</span>
                  <span class="schedule-time">{schedule.startTime} - {schedule.endTime}</span>
                  <span class="schedule-coach" style="background: {coaches.find(c => c.id === schedule.coachId)?.color || '#666'};"></span>
                  <span class="schedule-coach-name">{getCoachName(schedule.coachId)}</span>
                  <span class="schedule-lane">第 {schedule.lane} 泳道</span>
                </div>
              {/each}
            </div>

            <button class="btn btn-outline modify-btn" on:click={() => { generatedSchedules = []; errors = []; }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              修改排课条件
            </button>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" on:click={handleClose}>取消</button>
        {#if generatedSchedules.length === 0}
          <button class="btn btn-primary" on:click={generatePreview} disabled={isGenerating}>
            {#if isGenerating}
              <div class="spinner-small"></div>
              生成中...
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 10 12 13 22 3"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              生成排课方案
            {/if}
          </button>
        {:else}
          <button class="btn btn-primary" on:click={handleSave} disabled={isSaving}>
            {#if isSaving}
              <div class="spinner-small"></div>
              保存中...
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              确认保存 {generatedSchedules.length} 节课
            {/if}
          </button>
        {/if}
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
    width: 720px;
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
    background: linear-gradient(135deg, var(--ocean-600), var(--ocean-500));
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
    padding: 20px 28px;
    overflow-y: auto;
    flex: 1;
  }

  .rules-notice {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    background: var(--ocean-50);
    border: 1px solid var(--ocean-200);
    border-radius: var(--radius-md);
    margin-bottom: 20px;
    color: var(--ocean-700);
    font-size: 13px;
    line-height: 1.5;
  }

  .rules-notice svg {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
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
  .form-item select {
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
  .form-item select:focus {
    outline: none;
    border-color: var(--teal-400);
    box-shadow: 0 0 0 3px var(--teal-50);
  }

  .form-item.checkbox-item {
    display: flex;
    align-items: center;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-primary);
    font-weight: 500;
  }

  .checkbox-label input {
    width: 18px;
    height: 18px;
    accent-color: var(--teal-500);
  }

  .selection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .selection-header label {
    margin-bottom: 0;
  }

  .select-all-btn {
    background: none;
    border: none;
    color: var(--teal-500);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    transition: background 0.15s;
  }

  .select-all-btn:hover {
    background: var(--teal-50);
  }

  .coach-selection {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
    max-height: 140px;
    overflow-y: auto;
    padding: 8px;
    background: var(--surface-50);
    border-radius: var(--radius-md);
    border: 1px solid var(--surface-100);
  }

  .coach-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
    border: 2px solid transparent;
    background: var(--surface-0);
  }

  .coach-card:hover {
    background: var(--surface-100);
  }

  .coach-card.selected {
    border-color: var(--coach-color);
    background: color-mix(in srgb, var(--coach-color) 10%, var(--surface-0));
  }

  .coach-card input {
    width: 16px;
    height: 16px;
    accent-color: var(--coach-color);
  }

  .coach-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
  }

  .coach-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .coach-name {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-primary);
  }

  .coach-specialties {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  .student-selection {
    max-height: 180px;
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

  .preview-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--surface-200);
  }

  .preview-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-display);
  }

  .preview-count {
    font-size: 14px;
    font-weight: 600;
    color: var(--teal-600);
    background: var(--teal-50);
    padding: 4px 12px;
    border-radius: var(--radius-full);
  }

  .preview-warnings {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .warning-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 14px;
    background: var(--amber-50);
    border: 1px solid var(--amber-200);
    border-radius: var(--radius-md);
    color: var(--amber-700);
    font-size: 13px;
    line-height: 1.5;
  }

  .warning-item svg {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .schedule-list {
    max-height: 320px;
    overflow-y: auto;
    border: 1.5px solid var(--surface-200);
    border-radius: var(--radius-md);
  }

  .schedule-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--surface-100);
    font-size: 13px;
  }

  .schedule-item:last-child {
    border-bottom: none;
  }

  .schedule-index {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-100);
    border-radius: 50%;
    font-weight: 700;
    color: var(--text-secondary);
    font-size: 12px;
    flex-shrink: 0;
  }

  .schedule-date {
    font-weight: 600;
    color: var(--text-primary);
    min-width: 100px;
  }

  .schedule-time {
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
    min-width: 100px;
  }

  .schedule-coach {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .schedule-coach-name {
    color: var(--text-secondary);
    min-width: 70px;
  }

  .schedule-lane {
    margin-left: auto;
    color: var(--ocean-600);
    font-weight: 500;
    background: var(--ocean-50);
    padding: 2px 10px;
    border-radius: var(--radius-full);
    font-size: 12px;
  }

  .modify-btn {
    align-self: center;
    margin-top: 8px;
  }

  .modal-footer {
    padding: 16px 28px;
    border-top: 1px solid var(--surface-200);
    display: flex;
    justify-content: flex-end;
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

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--surface-200);
  }

  .btn-ghost:hover:not(:disabled) {
    background: var(--surface-50);
    color: var(--text-primary);
  }

  .btn-primary {
    background: var(--teal-500);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--teal-600);
    box-shadow: var(--shadow-glow-teal);
  }

  .btn-outline {
    background: transparent;
    color: var(--teal-600);
    border: 1.5px solid var(--teal-300);
  }

  .btn-outline:hover:not(:disabled) {
    background: var(--teal-50);
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
