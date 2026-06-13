<script lang="ts">
  import { onMount } from 'svelte';
  import type { ConflictInfo, Course, CourseDraft } from './types';
  import {
    currentUser,
    branches,
    visibleCoaches,
    visibleCourses,
    visibleStudents,
    viewMode,
    selectedBranchId,
    initializeData,
    saveCourse,
    undo,
    redo,
    canUndo,
    canRedo,
    hasPermission,
  } from './lib/stores';
  import LoginScreen from './components/LoginScreen.svelte';
  import TopBar from './components/TopBar.svelte';
  import CoachList from './components/CoachList.svelte';
  import WeekCalendar from './components/WeekCalendar.svelte';
  import StudentPanel from './components/StudentPanel.svelte';
  import ReportPanel from './components/ReportPanel.svelte';
  import ConflictModal from './components/ConflictModal.svelte';
  import CourseModal from './components/CourseModal.svelte';
  import BatchScheduleModal from './components/BatchScheduleModal.svelte';

  let hoverCell: { date: string; time: string; lane: number } | null = null;
  let dragConflict: { hasConflict: boolean; reason: string } | null = null;
  let conflictList: ConflictInfo[] = [];
  let conflictDraft: CourseDraft | null = null;
  let editingCourse: Course | null = null;
  let creatingDraft: CourseDraft | null = null;
  let showCourseModal = false;
  let showBatchScheduleModal = false;
  let initialized = false;

  onMount(async () => {
    await initializeData();
    initialized = true;

    document.addEventListener('keydown', handleKeyDown);
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (!initialized || !$currentUser) return;

    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      if (hasPermission($currentUser.role, 'edit_course')) {
        event.preventDefault();
        handleUndo();
      }
    }

    if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.shiftKey && event.key === 'z'))) {
      if (hasPermission($currentUser.role, 'edit_course')) {
        event.preventDefault();
        handleRedo();
      }
    }
  }

  function handleConflict(conflicts: ConflictInfo[], draft: CourseDraft) {
    conflictList = conflicts;
    conflictDraft = draft;
  }

  function closeConflictModal() {
    conflictList = [];
    conflictDraft = null;
  }

  function handleEditCourse(course: Course) {
    editingCourse = course;
    creatingDraft = null;
    showCourseModal = true;
  }

  function handleCreateCourse(draft: CourseDraft | null) {
    editingCourse = null;
    creatingDraft = draft;
    showCourseModal = true;
  }

  function handleBatchSchedule() {
    showBatchScheduleModal = true;
  }

  function closeBatchScheduleModal() {
    showBatchScheduleModal = false;
  }

  function closeCourseModal() {
    showCourseModal = false;
    editingCourse = null;
    creatingDraft = null;
  }

  async function handleUndo() {
    if (!$canUndo) return;
    await undo();
  }

  async function handleRedo() {
    if (!$canRedo) return;
    await redo();
  }
</script>

{#if !initialized}
  <div class="loading">
    <div class="loading-wave">
      <span class="wave"></span>
      <span class="wave"></span>
      <span class="wave"></span>
    </div>
    <div class="spinner"></div>
    <p class="loading-text">正在加载数据...</p>
  </div>
{:else if !$currentUser}
  <LoginScreen />
{:else}
  <div class="app">
    <TopBar user={$currentUser} branches={$branches} />

    <main class="main-content">
      {#if $viewMode === 'schedule'}
        <div class="schedule-container">
          <CoachList coaches={$visibleCoaches} />
          <div class="calendar-wrapper">
            {#if hasPermission($currentUser!.role, 'edit_course')}
              <div class="toolbar">
                <button
                  class="toolbar-btn {$canUndo ? '' : 'disabled'}"
                  on:click={handleUndo}
                  disabled={!$canUndo}
                  title="撤销 (Ctrl+Z)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                  撤销
                </button>
                <button
                  class="toolbar-btn {$canRedo ? '' : 'disabled'}"
                  on:click={handleRedo}
                  disabled={!$canRedo}
                  title="重做 (Ctrl+Y / Ctrl+Shift+Z)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                  </svg>
                  重做
                </button>
              </div>
            {/if}
            <WeekCalendar
              courses={$visibleCourses}
              coaches={$visibleCoaches}
              {hoverCell}
              {dragConflict}
              onConflict={handleConflict}
              onEditCourse={handleEditCourse}
              onCreateCourse={handleCreateCourse}
              onBatchSchedule={handleBatchSchedule}
            />
          </div>
        </div>
      {:else if $viewMode === 'students'}
        <StudentPanel students={$visibleStudents} />
      {:else if $viewMode === 'reports'}
        <ReportPanel
          branches={$branches.filter(
            (b) => $currentUser!.role === 'headquarters' || b.id === $currentUser!.branchId
          )}
          coaches={$visibleCoaches}
          courses={$visibleCourses}
          students={$visibleStudents}
        />
      {/if}
    </main>

    <ConflictModal
      conflicts={conflictList}
      draft={conflictDraft}
      onClose={closeConflictModal}
    />

    {#if showCourseModal}
      <CourseModal
        course={editingCourse}
        draft={creatingDraft}
        branchId={$selectedBranchId}
        onClose={closeCourseModal}
        onConflict={handleConflict}
      />
    {/if}

    {#if showBatchScheduleModal}
      <BatchScheduleModal
        onClose={closeBatchScheduleModal}
      />
    {/if}
  </div>
{/if}

<style>
  .loading {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, var(--ocean-800), var(--ocean-600));
    gap: 24px;
  }

  .loading-wave {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    height: 32px;
  }

  .wave {
    display: block;
    width: 6px;
    height: 12px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.5);
    animation: wave-motion 1.2s var(--ease-out) infinite;
  }

  .wave:nth-child(2) {
    animation-delay: 0.15s;
  }

  .wave:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes wave-motion {
    0%, 100% { height: 12px; background: rgba(255, 255, 255, 0.4); }
    50% { height: 28px; background: rgba(255, 255, 255, 0.9); }
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.15);
    border-top-color: var(--teal-400);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-text {
    margin: 0;
    font-family: var(--font-body);
    font-size: 15px;
    color: rgba(255, 255, 255, 0.85);
    letter-spacing: 0.5px;
  }

  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-50);
    font-family: var(--font-body);
  }

  .main-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .schedule-container {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .calendar-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    background: var(--surface-0);
    border-bottom: 1px solid var(--border-100);
    align-items: center;
  }

  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--border-200);
    border-radius: 6px;
    background: var(--surface-0);
    color: var(--text-700);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
  }

  .toolbar-btn:hover:not(.disabled) {
    background: var(--ocean-50);
    border-color: var(--ocean-200);
    color: var(--ocean-700);
  }

  .toolbar-btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
