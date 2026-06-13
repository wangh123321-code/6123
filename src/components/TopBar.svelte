<script lang="ts">
  import type { User, Branch } from '../types';
  import { logout, viewMode, selectedBranchId, hasPermission, copyWeekToNext, cancelDateRange, syncWithServer } from '../lib/stores';

  export let user: User;
  export let branches: Branch[];

  function getRoleLabel(role: User['role']): string {
    switch (role) {
      case 'headquarters':
        return '总部管理员';
      case 'reception':
        return '前台';
      case 'coach':
        return '教练';
      default:
        return '';
    }
  }

  function getRoleIcon(role: User['role']): string {
    switch (role) {
      case 'headquarters':
        return '🏢';
      case 'reception':
        return '📋';
      case 'coach':
        return '👨‍🏫';
      default:
        return '';
    }
  }

  async function handleCopyWeek() {
    if (!confirm('确定要将本周的课程复制到下一周吗？有冲突的课将被跳过。')) return;
    const count = await copyWeekToNext(new Date());
    alert(`成功复制 ${count} 节课到下一周`);
  }

  async function handleHolidayCancel() {
    const input = prompt('请输入停课日期范围（格式：YYYY-MM-DD~YYYY-MM-DD），例如国庆节停课：');
    if (!input) return;
    const parts = input.split('~');
    if (parts.length !== 2) {
      alert('格式不正确，请使用 ~ 分隔开始和结束日期');
      return;
    }
    const start = new Date(parts[0].trim());
    const end = new Date(parts[1].trim());
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      alert('日期格式不正确');
      return;
    }
    if (!confirm(`确定要取消 ${parts[0]} 到 ${parts[1]} 期间的所有课程吗？`)) return;
    const count = await cancelDateRange(start, end);
    alert(`已取消 ${count} 节课`);
  }

  async function handleSync() {
    const result = await syncWithServer();
    alert(`同步完成：成功 ${result.success} 条，失败 ${result.failed} 条`);
  }

  async function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
      await logout();
    }
  }
</script>

<header class="top-bar">
  <div class="brand">
    <svg class="whale-icon" viewBox="0 0 40 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 22c0-8 6-16 16-16s16 8 16 16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M4 22c0 4 6 8 16 8s16-4 16-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="14" cy="18" r="1.8" fill="currentColor"/>
      <path d="M22 14c2-4 6-6 8-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M6 26c-2 3-1 5 1 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <div class="brand-text">
      <span class="brand-title">蓝鲸游泳</span>
      <span class="brand-subtitle">排课管理系统</span>
    </div>
  </div>

  <nav class="nav-tabs">
    <button
      class="nav-tab"
      class:active={$viewMode === 'schedule'}
      on:click={() => ($viewMode = 'schedule')}
    >
      📅 排课看板
    </button>
    <button
      class="nav-tab"
      class:active={$viewMode === 'students'}
      on:click={() => ($viewMode = 'students')}
    >
      👦 学员进度
    </button>
    {#if user.role !== 'coach'}
      <button
        class="nav-tab"
        class:active={$viewMode === 'reports'}
        on:click={() => ($viewMode = 'reports')}
      >
        📊 数据报表
      </button>
    {/if}
  </nav>

  <div class="actions">
    {#if user.role === 'headquarters'}
      <div class="branch-selector">
        <label>分馆：</label>
        <select bind:value={$selectedBranchId}>
          {#each branches as branch}
            <option value={branch.id}>{branch.name}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if hasPermission(user.role, 'batch_copy')}
      <div class="action-btns">
        <button class="ghost-btn" on:click={handleCopyWeek} title="复制本周课程到下周">
          📋 复制周课表
        </button>
        <button class="ghost-btn ghost-btn--danger" on:click={handleHolidayCancel} title="节假日批量停课">
          🎉 节假日停课
        </button>
      </div>
    {/if}

    <button class="ghost-btn ghost-btn--sync" on:click={handleSync} title="与服务端同步数据">
      🔄 同步
    </button>

    <div class="user-pill">
      <span class="user-icon">{getRoleIcon(user.role)}</span>
      <div class="user-details">
        <span class="user-name">{user.name}</span>
        <span class="user-role">{getRoleLabel(user.role)}</span>
      </div>
      <button class="logout-btn" on:click={handleLogout} title="退出登录">
        ⎋
      </button>
    </div>
  </div>
</header>

<style>
  .top-bar {
    height: 56px;
    background: var(--ocean-800);
    display: flex;
    align-items: center;
    padding: 0 20px;
    gap: 20px;
    box-shadow: var(--shadow-md);
    flex-shrink: 0;
    position: relative;
    z-index: 100;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .whale-icon {
    width: 32px;
    height: 26px;
    color: var(--teal-400);
    filter: drop-shadow(0 0 6px rgba(0, 191, 165, 0.3));
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .brand-title {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 700;
    color: var(--text-inverse);
    letter-spacing: 0.5px;
  }

  .brand-subtitle {
    font-size: 10px;
    color: var(--ocean-300);
    letter-spacing: 1px;
  }

  .nav-tabs {
    display: flex;
    gap: 4px;
    flex: 1;
    justify-content: center;
    background: rgba(255, 255, 255, 0.06);
    border-radius: var(--radius-full);
    padding: 3px;
    align-self: center;
  }

  .nav-tab {
    padding: 6px 18px;
    border: none;
    background: transparent;
    border-radius: var(--radius-full);
    font-size: 13px;
    font-weight: 500;
    color: var(--ocean-200);
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
    white-space: nowrap;
  }

  .nav-tab:hover {
    color: var(--text-inverse);
    background: rgba(255, 255, 255, 0.08);
  }

  .nav-tab.active {
    background: var(--teal-500);
    color: var(--text-inverse);
    box-shadow: 0 2px 8px rgba(0, 191, 165, 0.35);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .branch-selector {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--ocean-200);
  }

  .branch-selector select {
    padding: 4px 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: var(--radius-sm);
    font-size: 12px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-inverse);
    max-width: 160px;
    transition: all 0.2s var(--ease-out);
  }

  .branch-selector select:focus {
    outline: none;
    border-color: var(--teal-500);
    background: rgba(255, 255, 255, 0.12);
  }

  .action-btns {
    display: flex;
    gap: 6px;
  }

  .ghost-btn {
    padding: 5px 12px;
    background: transparent;
    color: var(--ocean-200);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
    white-space: nowrap;
  }

  .ghost-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.3);
    color: var(--text-inverse);
  }

  .ghost-btn--danger {
    color: var(--coral-300);
    border-color: rgba(255, 107, 107, 0.25);
  }

  .ghost-btn--danger:hover {
    background: rgba(255, 107, 107, 0.12);
    border-color: var(--coral-500);
    color: var(--coral-400);
  }

  .ghost-btn--sync {
    color: var(--teal-300);
    border-color: rgba(0, 191, 165, 0.25);
  }

  .ghost-btn--sync:hover {
    background: rgba(0, 191, 165, 0.12);
    border-color: var(--teal-500);
    color: var(--teal-400);
  }

  .user-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px 4px 10px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-full);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .user-icon {
    font-size: 16px;
  }

  .user-details {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .user-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-inverse);
  }

  .user-role {
    font-size: 9px;
    color: var(--ocean-300);
  }

  .logout-btn {
    width: 26px;
    height: 26px;
    border: none;
    background: rgba(255, 255, 255, 0.06);
    border-radius: var(--radius-full);
    cursor: pointer;
    font-size: 13px;
    color: var(--ocean-200);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s var(--ease-out);
  }

  .logout-btn:hover {
    background: var(--coral-500);
    color: var(--text-inverse);
    box-shadow: var(--shadow-glow-coral);
  }
</style>
