<script lang="ts">
  import type { Student } from '../types';
  import { getSkillPointsForLevel, getSkillLevelName } from '../types';
  import { updateStudent, currentUser, hasPermission } from '../lib/stores';

  export let students: Student[];

  let selectedStudent: Student | null = null;
  let searchText = '';
  let levelFilter = '';

  $: filteredStudents = students.filter((s) => {
    const matchSearch = s.name.includes(searchText) || s.parentName.includes(searchText);
    const matchLevel = !levelFilter || s.currentLevel === levelFilter;
    return matchSearch && matchLevel;
  });

  function getProgress(student: Student): { completed: number; total: number; percentage: number } {
    const skills = getSkillPointsForLevel(student.currentLevel);
    const completed = skills.filter((sk) => student.skillProgress[sk.id]?.completed).length;
    return {
      completed,
      total: skills.length,
      percentage: skills.length > 0 ? Math.round((completed / skills.length) * 100) : 0,
    };
  }

  function hasWarning(student: Student): boolean {
    const skills = getSkillPointsForLevel(student.currentLevel);
    return skills.some((sk) => (student.skillProgress[sk.id]?.failedAttempts || 0) >= 3);
  }

  async function toggleSkill(skillId: string, completed: boolean) {
    if (!selectedStudent) return;
    if (!hasPermission($currentUser!.role, 'mark_skill')) return;

    const now = new Date().toISOString();
    const updated: Student = {
      ...selectedStudent,
      skillProgress: {
        ...selectedStudent.skillProgress,
        [skillId]: {
          completed,
          completedAt: completed ? now : undefined,
          coachId: $currentUser?.id,
          failedAttempts: completed ? 0 : (selectedStudent.skillProgress[skillId]?.failedAttempts || 0) + 1,
        },
      },
    };

    await updateStudent(updated);
    selectedStudent = updated;
  }

  function formatDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
</script>

<div class="student-panel">
  <div class="panel-header">
    <h3 class="panel-title">学员进度追踪</h3>
    <div class="header-stats">
      <span class="stat-badge">共 {students.length} 人</span>
      <span class="stat-badge stat-badge--warning">需关注 {students.filter(hasWarning).length} 人</span>
    </div>
  </div>

  <div class="filters">
    <input
      type="text"
      bind:value={searchText}
      placeholder="搜索学员姓名..."
      class="search-input"
    />
    <select bind:value={levelFilter} class="level-filter">
      <option value="">全部级别</option>
      <option value="breaststroke_beginner">蛙泳入门</option>
      <option value="breaststroke_intermediate">蛙泳进阶</option>
      <option value="freestyle_beginner">自由泳入门</option>
      <option value="freestyle_advanced">自由泳进阶</option>
      <option value="backstroke_beginner">仰泳入门</option>
      <option value="butterfly_beginner">蝶泳入门</option>
    </select>
  </div>

  <div class="content">
    <div class="student-list">
      {#each filteredStudents as student}
        {@const progress = getProgress(student)}
        {@const warning = hasWarning(student)}
        <div
          class="student-card {selectedStudent?.id === student.id ? 'selected' : ''} {warning ? 'has-warning' : ''}"
          on:click={() => (selectedStudent = student)}
        >
          <div class="student-card__header">
            <span class="student-card__name">{student.name}</span>
            {#if warning}
              <span class="student-card__warning-icon">⚠</span>
            {/if}
          </div>
          <span class="student-card__level-tag">{getSkillLevelName(student.currentLevel)}</span>
          <div class="student-card__progress">
            <div class="progress-track">
              <div
                class="progress-fill {progress.percentage >= 100 ? 'done' : ''}"
                style="width: {progress.percentage}%"
              ></div>
              <span class="progress-text">{progress.percentage}%</span>
            </div>
            <span class="progress-fraction">{progress.completed}/{progress.total}</span>
          </div>
        </div>
      {/each}
      {#if filteredStudents.length === 0}
        <div class="list-empty">没有匹配的学员</div>
      {/if}
    </div>

    <div class="student-detail">
      {#if selectedStudent}
        {@const progress = getProgress(selectedStudent)}
        {@const skills = getSkillPointsForLevel(selectedStudent.currentLevel)}
        <div class="detail-header">
          <div class="detail-header__info">
            <h4 class="detail-name">{selectedStudent.name}</h4>
            <div class="detail-meta">
              <span class="meta-tag meta-tag--level">{getSkillLevelName(selectedStudent.currentLevel)}</span>
              <span class="meta-item">家长：{selectedStudent.parentName}</span>
              <span class="meta-item">📱 {selectedStudent.parentPhone}</span>
            </div>
          </div>
          <div class="progress-circle">
            <svg viewBox="0 0 36 36">
              <path
                class="circle-bg"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                class="circle-fill"
                stroke-dasharray="{progress.percentage}, 100"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span class="circle-text">{progress.percentage}%</span>
          </div>
        </div>

        <div class="skills-section">
          <h5 class="section-title">技能点考核</h5>
          <div class="skills-list">
            {#each skills as skill}
              {@const sp = selectedStudent.skillProgress[skill.id]}
              {@const failed = (sp?.failedAttempts || 0) >= 3}
              <div class="skill-item {sp?.completed ? 'completed' : ''} {failed ? 'needs-attention' : ''}">
                <label class="skill-checkbox">
                  <input
                    type="checkbox"
                    checked={!!sp?.completed}
                    disabled={!hasPermission($currentUser!.role, 'mark_skill')}
                    on:change={(e) => toggleSkill(skill.id, (e.target as HTMLInputElement).checked)}
                  />
                  <span class="checkmark">✓</span>
                </label>
                <div class="skill-info">
                  <div class="skill-name">{skill.name}</div>
                  <div class="skill-desc">{skill.description}</div>
                  {#if sp?.completedAt}
                    <div class="skill-date">✓ {formatDate(sp.completedAt)}</div>
                  {/if}
                </div>
                {#if failed}
                  <div class="skill-warning">
                    ⚠ 连续{sp?.failedAttempts}次未达标，请安排补课
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        {#if selectedStudent.notes}
          <div class="notes-section">
            <h5 class="section-title">备注</h5>
            <p class="notes-text">{selectedStudent.notes}</p>
          </div>
        {/if}
      {:else}
        <div class="select-hint">
          <div class="hint-icon">🏊</div>
          <p class="hint-text">点击左侧学员查看详细进度</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .student-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--surface-0, #f0f4f8);
    overflow: hidden;
    font-family: var(--font-body, system-ui, sans-serif);
  }

  .panel-header {
    padding: 20px 28px;
    background: var(--ocean-800, #1a4a6b);
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.1));
  }

  .panel-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    font-family: var(--font-display, system-ui, sans-serif);
    letter-spacing: .02em;
  }

  .header-stats {
    display: flex;
    gap: 10px;
  }

  .stat-badge {
    font-size: 12px;
    font-weight: 600;
    background: rgba(255, 255, 255, .15);
    padding: 5px 14px;
    border-radius: var(--radius-xl, 9999px);
    backdrop-filter: blur(4px);
  }

  .stat-badge--warning {
    background: var(--coral-500, #ff6b6b);
  }

  .filters {
    padding: 14px 28px;
    border-bottom: 1px solid var(--surface-200, #d0dbe6);
    display: flex;
    gap: 12px;
    background: var(--surface-50, #f7f9fc);
  }

  .search-input,
  .level-filter {
    padding: 9px 14px;
    border: 1px solid var(--surface-200, #d0dbe6);
    border-radius: var(--radius-sm, 6px);
    font-size: 13px;
    font-family: var(--font-body, system-ui, sans-serif);
    background: #fff;
    color: var(--text-primary, #1a2a3a);
    transition: border-color .2s var(--ease-out, ease), box-shadow .2s var(--ease-out, ease);
  }

  .search-input:focus,
  .level-filter:focus {
    outline: none;
    border-color: var(--teal-400, #26c6b0);
    box-shadow: 0 0 0 3px rgba(0, 191, 165, .15);
  }

  .search-input {
    flex: 1;
    max-width: 300px;
  }

  .content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .student-list {
    width: 280px;
    border-right: 1px solid var(--surface-200, #d0dbe6);
    overflow-y: auto;
    padding: 14px;
    background: var(--surface-50, #f7f9fc);
  }

  .student-card {
    padding: 14px;
    background: #fff;
    border-radius: var(--radius-md, 10px);
    margin-bottom: 10px;
    cursor: pointer;
    border-left: 4px solid transparent;
    box-shadow: var(--shadow-xs, 0 1px 2px rgba(0,0,0,.04));
    transition: all .2s var(--ease-out, ease);
  }

  .student-card:hover {
    box-shadow: var(--shadow-sm, 0 2px 6px rgba(0,0,0,.08));
    transform: translateY(-1px);
  }

  .student-card.selected {
    border-left-color: var(--teal-500, #00bfa5);
    background: var(--teal-50, #e0f7f4);
    box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 191, 165, .15));
  }

  .student-card.has-warning {
    border-left-color: var(--amber-500, #f59e0b);
    background: var(--amber-300, #fcd34d);
  }

  .student-card.has-warning.selected {
    border-left-color: var(--amber-500, #f59e0b);
    background: var(--teal-50, #e0f7f4);
    box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 191, 165, .15));
  }

  .student-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .student-card__name {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary, #1a2a3a);
  }

  .student-card__warning-icon {
    color: var(--amber-500, #f59e0b);
    font-size: 14px;
  }

  .student-card__level-tag {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    color: var(--teal-500, #00bfa5);
    background: var(--teal-50, #e0f7f4);
    padding: 2px 8px;
    border-radius: var(--radius-sm, 6px);
    margin-bottom: 10px;
  }

  .student-card__progress {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .progress-track {
    position: relative;
    flex: 1;
    height: 18px;
    background: var(--surface-200, #d0dbe6);
    border-radius: var(--radius-xl, 9999px);
    overflow: hidden;
  }

  .progress-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--teal-500, #00bfa5);
    border-radius: var(--radius-xl, 9999px);
    transition: width .4s var(--ease-out, ease);
  }

  .progress-fill.done {
    background: linear-gradient(90deg, var(--teal-400, #26c6b0), var(--teal-300, #4dd8c4));
  }

  .progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .25);
  }

  .progress-fraction {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #8a9bb0);
    white-space: nowrap;
  }

  .student-detail {
    flex: 1;
    overflow-y: auto;
    padding: 28px;
    background: var(--surface-0, #f0f4f8);
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 24px;
    border-bottom: 2px solid var(--surface-200, #d0dbe6);
    margin-bottom: 24px;
  }

  .detail-name {
    margin: 0 0 10px;
    font-size: 26px;
    font-weight: 700;
    font-family: var(--font-display, system-ui, sans-serif);
    color: var(--ocean-900, #0d2b3e);
    letter-spacing: -.01em;
  }

  .detail-meta {
    display: flex;
    gap: 14px;
    align-items: center;
    flex-wrap: wrap;
  }

  .meta-tag--level {
    font-size: 12px;
    font-weight: 600;
    color: var(--teal-500, #00bfa5);
    background: var(--teal-50, #e0f7f4);
    padding: 3px 10px;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--teal-200, #80e8d8);
  }

  .meta-item {
    font-size: 13px;
    color: var(--text-secondary, #4a6070);
  }

  .progress-circle {
    position: relative;
    width: 90px;
    height: 90px;
    flex-shrink: 0;
  }

  .progress-circle svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .circle-bg {
    fill: none;
    stroke: var(--surface-200, #d0dbe6);
    stroke-width: 3;
  }

  .circle-fill {
    fill: none;
    stroke: var(--teal-500, #00bfa5);
    stroke-width: 3.5;
    stroke-linecap: round;
    transition: stroke-dasharray .6s var(--ease-spring, cubic-bezier(.34, 1.56, .64, 1));
    filter: drop-shadow(0 0 4px rgba(0, 191, 165, .35));
  }

  .circle-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 17px;
    font-weight: 700;
    color: var(--teal-500, #00bfa5);
    font-family: var(--font-display, system-ui, sans-serif);
  }

  .skills-section {
    margin-bottom: 24px;
  }

  .section-title {
    margin: 0 0 14px;
    font-size: 15px;
    font-weight: 700;
    color: var(--ocean-900, #0d2b3e);
    font-family: var(--font-display, system-ui, sans-serif);
  }

  .skills-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .skill-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px;
    background: #fff;
    border-radius: var(--radius-md, 10px);
    border-left: 4px solid var(--surface-200, #d0dbe6);
    box-shadow: var(--shadow-xs, 0 1px 2px rgba(0,0,0,.04));
    transition: all .2s var(--ease-out, ease);
  }

  .skill-item.completed {
    border-left-color: var(--teal-500, #00bfa5);
    background: var(--teal-50, #e0f7f4);
  }

  .skill-item.needs-attention {
    border-left-color: var(--amber-500, #f59e0b);
    background: var(--amber-300, #fcd34d);
  }

  .skill-checkbox {
    position: relative;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    cursor: pointer;
  }

  .skill-checkbox input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    z-index: 1;
  }

  .checkmark {
    position: absolute;
    top: 0;
    left: 0;
    width: 22px;
    height: 22px;
    border: 2px solid var(--surface-200, #d0dbe6);
    border-radius: var(--radius-sm, 6px);
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: transparent;
    font-size: 14px;
    font-weight: bold;
    transition: all .2s var(--ease-out, ease);
  }

  .skill-checkbox input:checked + .checkmark {
    background: var(--teal-500, #00bfa5);
    border-color: var(--teal-500, #00bfa5);
    color: #fff;
    box-shadow: 0 2px 6px rgba(0, 191, 165, .3);
  }

  .skill-info {
    flex: 1;
    min-width: 0;
  }

  .skill-name {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary, #1a2a3a);
  }

  .skill-desc {
    font-size: 12px;
    color: var(--text-secondary, #4a6070);
    margin-top: 3px;
  }

  .skill-date {
    font-size: 11px;
    color: var(--teal-500, #00bfa5);
    margin-top: 5px;
    font-weight: 600;
  }

  .skill-warning {
    font-size: 12px;
    font-weight: 600;
    color: var(--amber-500, #f59e0b);
    background: var(--amber-100, #fef3c7);
    padding: 5px 12px;
    border-radius: var(--radius-sm, 6px);
    align-self: center;
    white-space: nowrap;
    border: 1px solid var(--amber-400, #fbbf24);
  }

  .notes-section {
    margin-top: 24px;
    padding: 18px;
    background: var(--sand-100, #fdf6e3);
    border-radius: var(--radius-md, 10px);
    border: 1px solid var(--sand-200, #f5e6c8);
  }

  .notes-text {
    margin: 0;
    color: var(--text-secondary, #4a6070);
    font-size: 13px;
    line-height: 1.7;
  }

  .select-hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted, #8a9bb0);
  }

  .hint-icon {
    font-size: 56px;
    margin-bottom: 16px;
    opacity: .7;
  }

  .hint-text {
    margin: 0;
    font-size: 15px;
    color: var(--text-muted, #8a9bb0);
  }

  .list-empty {
    text-align: center;
    padding: 40px 16px;
    color: var(--text-muted, #8a9bb0);
    font-size: 13px;
  }
</style>
