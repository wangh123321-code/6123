<script lang="ts">
  import { get } from 'svelte/store';
  import type { Coach, Course } from '../types';
  import {
    calculateCoachDailyStats,
    formatDate,
    formatHoursMinutes,
    isOverloaded,
  } from '../lib/utils';
  import { selectedDate, visibleCourses, currentUser } from '../lib/stores';
  import { hasPermission } from '../lib/stores';

  export let coaches: Coach[];

  function handleDragStart(event: DragEvent, coach: Coach) {
    if (!hasPermission(get(currentUser)!.role, 'create_course')) {
      event.preventDefault();
      return;
    }
    if (event.dataTransfer) {
      event.dataTransfer.setData(
        'application/json',
        JSON.stringify({ type: 'coach', coachId: coach.id })
      );
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  $: dateStr = formatDate($selectedDate);
  $: courses = $visibleCourses;
</script>

<div class="coach-list">
  <div class="header">
    <div class="header-left">
      <svg class="whale-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 12c0-3.5 3-7 8-7s8 3.5 8 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M19 12c1 0 2 .8 2 2s-1 2-2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M3 12c0 4 3.5 7 8 7s8-3 8-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="8" cy="11" r="1" fill="currentColor"/>
        <path d="M11 14c.5.5 1.5.5 2 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <h3>教练列表</h3>
    </div>
    <span class="coach-count">{coaches.length}</span>
  </div>

  <div class="coach-items">
    {#each coaches as coach}
      {@const stats = calculateCoachDailyStats(coach.id, dateStr, courses)}
      {@const overloaded = isOverloaded(stats)}
      <div
        class="coach-item"
        class:overloaded
        draggable={hasPermission($currentUser!.role, 'create_course')}
        on:dragstart={(e) => handleDragStart(e, coach)}
      >
        <div class="coach-avatar" style="background-color: {coach.color}">
          {coach.name.slice(0, 1)}
        </div>
        <div class="coach-info">
          <div class="coach-name">{coach.name}</div>
          <div class="coach-specialties">
            {coach.specialties.join(' · ')}
          </div>
          <div class="coach-stats">
            <span class="stat" class:danger={overloaded}>
              {formatHoursMinutes(stats.totalMinutes)}
            </span>
            <span class="stat">
              {stats.courseCount}节课
            </span>
          </div>
          <div class="saturation-bar">
            <div
              class="saturation-fill"
              class:fill-danger={overloaded}
              class:fill-warning={!overloaded && stats.saturation >= 80}
              style="width: {Math.min(stats.saturation, 100)}%"
            ></div>
            <span class="saturation-label">{stats.saturation}%</span>
          </div>
          {#if overloaded}
            <div class="overload-warning">⚠ 超过8小时</div>
          {/if}
        </div>
      </div>
    {/each}

    {#if coaches.length === 0}
      <div class="empty-state">暂无教练数据</div>
    {/if}
  </div>
</div>

<style>
  .coach-list {
    width: 260px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--surface-0, #ffffff);
    border-right: 1px solid var(--surface-200, #e2e8f0);
  }

  .header {
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--ocean-800, #1e3a5f);
    color: white;
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .whale-icon {
    width: 20px;
    height: 20px;
    color: var(--teal-200, #80cbc4);
  }

  .header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    font-family: var(--font-body, sans-serif);
    letter-spacing: 0.5px;
  }

  .coach-count {
    font-size: 12px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.18);
    padding: 2px 10px;
    border-radius: var(--radius-xl, 20px);
    color: var(--teal-200, #80cbc4);
  }

  .coach-items {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .coach-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    margin-bottom: 8px;
    background: var(--surface-50, #f8fafc);
    border-radius: var(--radius-md, 8px);
    cursor: grab;
    transition: transform 0.2s var(--ease-out, ease), box-shadow 0.2s var(--ease-out, ease), background 0.2s;
    border-left: 3px solid transparent;
  }

  .coach-item:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.1));
    background: var(--surface-100, #f1f5f9);
  }

  .coach-item:active {
    cursor: grabbing;
  }

  .coach-item.overloaded {
    border-left-color: var(--coral-500, #ff6b6b);
    background: var(--coral-100, #fff0f0);
  }

  .coach-item.overloaded:hover {
    background: var(--coral-200, #ffe0e0);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(255, 107, 107, 0.15));
  }

  .coach-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 17px;
    flex-shrink: 0;
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.12));
  }

  .coach-info {
    flex: 1;
    min-width: 0;
  }

  .coach-name {
    font-family: var(--font-display, sans-serif);
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary, #1e293b);
    margin-bottom: 2px;
  }

  .coach-specialties {
    font-size: 11px;
    color: var(--text-muted, #94a3b8);
    margin-bottom: 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .coach-stats {
    display: flex;
    gap: 12px;
    margin-bottom: 6px;
  }

  .stat {
    font-size: 12px;
    color: var(--text-secondary, #64748b);
    font-weight: 500;
  }

  .stat.danger {
    color: var(--coral-500, #ff6b6b);
    font-weight: 600;
  }

  .saturation-bar {
    position: relative;
    height: 16px;
    background: var(--surface-200, #e2e8f0);
    border-radius: var(--radius-xl, 20px);
    overflow: hidden;
  }

  .saturation-fill {
    height: 100%;
    background: var(--teal-500, #00bfa5);
    border-radius: var(--radius-xl, 20px);
    transition: width 0.3s var(--ease-out, ease);
  }

  .saturation-fill.fill-warning {
    background: var(--amber-500, #f59e0b);
  }

  .saturation-fill.fill-danger {
    background: var(--coral-500, #ff6b6b);
  }

  .saturation-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 10px;
    font-weight: 700;
    color: var(--text-primary, #1e293b);
    text-shadow: 0 0 4px rgba(255, 255, 255, 0.8);
  }

  .overload-warning {
    margin-top: 6px;
    font-size: 11px;
    color: var(--coral-500, #ff6b6b);
    font-weight: 600;
  }

  .empty-state {
    text-align: center;
    padding: 48px 16px;
    color: var(--text-muted, #94a3b8);
    font-size: 14px;
    font-family: var(--font-body, sans-serif);
  }
</style>
