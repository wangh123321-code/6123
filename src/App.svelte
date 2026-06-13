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
  } from './lib/stores';
  import LoginScreen from './components/LoginScreen.svelte';
  import TopBar from './components/TopBar.svelte';
  import CoachList from './components/CoachList.svelte';
  import WeekCalendar from './components/WeekCalendar.svelte';
  import StudentPanel from './components/StudentPanel.svelte';
  import ReportPanel from './components/ReportPanel.svelte';
  import ConflictModal from './components/ConflictModal.svelte';
  import CourseModal from './components/CourseModal.svelte';

  let hoverCell: { date: string; time: string; lane: number } | null = null;
  let conflictList: ConflictInfo[] = [];
  let conflictDraft: CourseDraft | null = null;
  let editingCourse: Course | null = null;
  let creatingDraft: CourseDraft | null = null;
  let showCourseModal = false;
  let initialized = false;

  onMount(async () => {
    await initializeData();
    initialized = true;
  });

  function handleConflict(conflicts: ConflictInfo[], draft: CourseDraft) {
    conflictList = conflicts;
    conflictDraft = draft;
  }

  function closeConflictModal() {
    conflictList = [];
    conflictDraft = null;
  }

  async function handleApplySuggestion(suggestion: ConflictInfo['suggestion']) {
    if (!suggestion || !conflictDraft) return;
    const newDraft: CourseDraft = {
      ...conflictDraft,
      date: suggestion.date || conflictDraft.date,
      startTime: suggestion.startTime || conflictDraft.startTime,
      lane: suggestion.lane || conflictDraft.lane,
    };
    const saved = await saveCourse(newDraft);
    if (saved) {
      closeConflictModal();
    }
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

  function closeCourseModal() {
    showCourseModal = false;
    editingCourse = null;
    creatingDraft = null;
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
        <CoachList coaches={$visibleCoaches} />
        <WeekCalendar
          courses={$visibleCourses}
          coaches={$visibleCoaches}
          {hoverCell}
          onConflict={handleConflict}
          onEditCourse={handleEditCourse}
          onCreateCourse={handleCreateCourse}
        />
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
      onApplySuggestion={handleApplySuggestion}
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
</style>
