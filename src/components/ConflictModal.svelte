<script lang="ts">
  import type { ConflictInfo, CourseDraft, TimeSlotSuggestion } from '../types';
  import { saveCourse } from '../lib/stores';

  export let conflicts: ConflictInfo[];
  export let draft: CourseDraft | null;
  export let onClose: () => void;

  async function applyTimeSlot(slot: TimeSlotSuggestion) {
    if (!draft) return;
    const newDraft: CourseDraft = {
      ...draft,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };
    const saved = await saveCourse(newDraft);
    if (saved) {
      onClose();
    }
  }

  async function applyCoach(coachId: string, coachName: string) {
    if (!draft) return;
    const newDraft: CourseDraft = {
      ...draft,
      coachId,
    };
    const saved = await saveCourse(newDraft);
    if (saved) {
      onClose();
    }
  }

  async function applyLane(lane: number) {
    if (!draft) return;
    const newDraft: CourseDraft = {
      ...draft,
      lane,
    };
    const saved = await saveCourse(newDraft);
    if (saved) {
      onClose();
    }
  }

  function getTypeLabel(type: string): string {
    switch (type) {
      case 'coach': return '教练冲突';
      case 'lane': return '泳道冲突';
      case 'student': return '学员冲突';
      default: return '冲突';
    }
  }

  function getTypeIcon(type: string): string {
    switch (type) {
      case 'coach':
        return '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
      case 'lane':
        return '<rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="16" x2="22" y2="16"/>';
      default:
        return '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
    }
  }

  const allSuggestedTimeSlots = conflicts.flatMap((c) => c.suggestedTimeSlots || []).slice(0, 3);
  const allSuggestedCoaches = conflicts.flatMap((c) => c.suggestedCoaches || []).slice(0, 3);
  const allSuggestedLanes = conflicts.flatMap((c) => c.suggestedLanes || []).slice(0, 3);
</script>

{#if conflicts.length > 0}
  <div class="backdrop" on:click={onClose}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <div class="header-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3>排课冲突检测</h3>
        <button class="close-btn" on:click={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <p class="intro">检测到 <strong>{conflicts.length}</strong> 个排课冲突，无法完成保存：</p>

        <div class="conflict-list">
          {#each conflicts as conflict}
            <div class="conflict-item {conflict.type}">
              <div class="conflict-header">
                <div class="conflict-type">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    {@html getTypeIcon(conflict.type)}
                  </svg>
                  {getTypeLabel(conflict.type)}
                </div>
              </div>
              <div class="conflict-message">{conflict.message}</div>
            </div>
          {/each}
        </div>

        <div class="suggestions-section">
          <div class="suggestions-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            智能调整建议
          </div>

          {#if allSuggestedTimeSlots.length > 0}
            <div class="suggestion-group">
              <div class="suggestion-group-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                推荐空闲时间段
              </div>
              <div class="suggestion-options">
                {#each allSuggestedTimeSlots as slot}
                  <button class="suggestion-btn time-slot" on:click={() => applyTimeSlot(slot)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 10 12 13 22 3"/>
                    </svg>
                    <span>{slot.startTime} - {slot.endTime}</span>
                    <span class="apply-label">点击应用</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          {#if allSuggestedCoaches.length > 0}
            <div class="suggestion-group">
              <div class="suggestion-group-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                可选替代教练
              </div>
              <div class="suggestion-options">
                {#each allSuggestedCoaches as coach}
                  <button
                    class="suggestion-btn coach"
                    style="--coach-color: {coach.color};"
                    on:click={() => applyCoach(coach.id, coach.name)}
                  >
                    <span class="coach-dot"></span>
                    <span>{coach.name}</span>
                    <span class="apply-label">点击应用</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          {#if allSuggestedLanes.length > 0}
            <div class="suggestion-group">
              <div class="suggestion-group-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <line x1="2" y1="8" x2="22" y2="8"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <line x1="2" y1="16" x2="22" y2="16"/>
                </svg>
                建议可用泳道
              </div>
              <div class="suggestion-options">
                {#each allSuggestedLanes as lane}
                  <button class="suggestion-btn lane" on:click={() => applyLane(lane)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 10 12 13 22 3"/>
                    </svg>
                    <span>第 {lane} 泳道</span>
                    <span class="apply-label">点击应用</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          {#if allSuggestedTimeSlots.length === 0 && allSuggestedCoaches.length === 0 && allSuggestedLanes.length === 0}
            <div class="no-suggestions">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p>暂无可用的调整建议</p>
              <p class="hint">请尝试修改课程时间、更换教练或选择其他日期</p>
            </div>
          {/if}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" on:click={onClose}>
          返回修改
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
    width: 560px;
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
    padding: 20px 24px;
    background: linear-gradient(135deg, var(--coral-500), var(--coral-600));
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  .header-icon {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
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
    width: 32px;
    height: 32px;
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
    padding: 20px 24px;
    overflow-y: auto;
    flex: 1;
  }

  .intro {
    margin: 0 0 16px;
    color: var(--text-secondary);
    font-size: 14px;
  }

  .intro strong {
    color: var(--coral-500);
    font-weight: 700;
  }

  .conflict-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }

  .conflict-item {
    padding: 14px 16px;
    border-radius: var(--radius-md);
    border-left: 4px solid;
    background: var(--surface-50);
    transition: background 0.15s;
  }

  .conflict-item:hover {
    background: var(--surface-100);
  }

  .conflict-item.coach {
    border-color: var(--coral-500);
  }

  .conflict-item.lane {
    border-color: var(--amber-500);
  }

  .conflict-item.student {
    border-color: var(--ocean-400);
  }

  .conflict-header {
    margin-bottom: 6px;
  }

  .conflict-type {
    font-weight: 600;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-display);
  }

  .conflict-item.coach .conflict-type {
    color: var(--coral-600);
  }

  .conflict-item.lane .conflict-type {
    color: var(--amber-500);
  }

  .conflict-item.student .conflict-type {
    color: var(--ocean-400);
  }

  .conflict-message {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .suggestions-section {
    background: var(--teal-50);
    border-radius: var(--radius-md);
    padding: 16px;
    border: 1px solid var(--teal-100);
  }

  .suggestions-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 14px;
    color: var(--teal-700);
    margin-bottom: 14px;
    font-family: var(--font-display);
  }

  .suggestion-group {
    margin-bottom: 14px;
  }

  .suggestion-group:last-child {
    margin-bottom: 0;
  }

  .suggestion-group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .suggestion-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .suggestion-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--surface-0);
    border: 1.5px solid var(--surface-200);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    font-family: var(--font-body);
    transition: all 0.2s var(--ease-out);
    min-width: 140px;
  }

  .suggestion-btn:hover {
    border-color: var(--teal-400);
    background: var(--teal-50);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .suggestion-btn svg {
    color: var(--teal-500);
    flex-shrink: 0;
  }

  .suggestion-btn.coach .coach-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--coach-color);
    flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
  }

  .apply-label {
    margin-left: auto;
    font-size: 11px;
    color: var(--teal-500);
    font-weight: 600;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .suggestion-btn:hover .apply-label {
    opacity: 1;
  }

  .no-suggestions {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
  }

  .no-suggestions svg {
    margin-bottom: 8px;
    opacity: 0.5;
  }

  .no-suggestions p {
    margin: 4px 0;
    font-size: 13px;
  }

  .no-suggestions .hint {
    font-size: 12px;
    color: var(--text-muted);
  }

  .modal-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--surface-200);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
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
</style>
