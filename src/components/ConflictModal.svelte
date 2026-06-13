<script lang="ts">
  import type { ConflictInfo, CourseDraft } from '../types';
  import { saveCourse } from '../lib/stores';

  export let conflicts: ConflictInfo[];
  export let draft: CourseDraft | null;
  export let onClose: () => void;
  export let onApplySuggestion: (suggestion: ConflictInfo['suggestion']) => void;

  async function handleApplyFirstSuggestion() {
    const suggestion = conflicts.find((c) => c.suggestion)?.suggestion;
    if (suggestion && draft) {
      const newDraft: CourseDraft = {
        ...draft,
        date: suggestion.date || draft.date,
        startTime: suggestion.startTime || draft.startTime,
        lane: suggestion.lane || draft.lane,
      };
      const saved = await saveCourse(newDraft);
      if (saved) {
        onClose();
      }
    }
  }
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
        <h3>排课冲突</h3>
        <button class="close-btn" on:click={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <p class="intro">检测到以下冲突，无法完成排课：</p>
        <ul class="conflict-list">
          {#each conflicts as conflict}
            <li class="conflict-item {conflict.type}">
              <div class="conflict-type">
                {#if conflict.type === 'coach'}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  教练冲突
                {:else if conflict.type === 'lane'}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="16" x2="22" y2="16"/></svg>
                  泳道冲突
                {:else}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  学员冲突
                {/if}
              </div>
              <div class="conflict-message">{conflict.message}</div>
              {#if conflict.suggestion}
                <div class="suggestion">
                  <div class="suggestion-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    建议
                  </div>
                  <div class="suggestion-text">
                    {#if conflict.suggestion.startTime}
                      改到 {conflict.suggestion.startTime}
                    {/if}
                    {#if conflict.suggestion.lane}
                      改用第 {conflict.suggestion.lane} 泳道
                    {/if}
                  </div>
                  <button
                    class="apply-suggestion-btn"
                    on:click={() => onApplySuggestion(conflict.suggestion)}
                  >
                    应用建议
                  </button>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" on:click={onClose}>我知道了</button>
        {#if conflicts.some((c) => c.suggestion)}
          <button class="btn btn-primary" on:click={handleApplyFirstSuggestion}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            应用第一个建议
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
    width: 480px;
    max-width: 90vw;
    max-height: 80vh;
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

  .conflict-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
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

  .conflict-type {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 6px;
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

  .suggestion {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed var(--surface-200);
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .suggestion-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--teal-500);
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .suggestion-text {
    font-size: 13px;
    color: var(--text-secondary);
    flex: 1;
  }

  .apply-suggestion-btn {
    padding: 5px 14px;
    background: var(--teal-500);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
    flex-shrink: 0;
  }

  .apply-suggestion-btn:hover {
    background: var(--teal-600);
    box-shadow: var(--shadow-glow-teal);
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
