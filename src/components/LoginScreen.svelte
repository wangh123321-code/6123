<script lang="ts">
  import type { User } from '../types';
  import { COACHES, BRANCHES } from '../lib/mockData';
  import { setCurrentUser } from '../lib/stores';

  type DemoRole = 'coach' | 'reception' | 'headquarters';

  let selectedRole: DemoRole = 'headquarters';
  let selectedCoachId = COACHES[0].id;
  let selectedBranchId = BRANCHES[0].id;

  async function handleLogin() {
    let user: User;

    if (selectedRole === 'headquarters') {
      user = {
        id: 'hq-user',
        name: '总部管理员',
        role: 'headquarters',
        phone: '10000000000',
      };
    } else if (selectedRole === 'reception') {
      const branch = BRANCHES.find((b) => b.id === selectedBranchId) || BRANCHES[0];
      user = {
        id: `reception-${branch.id}`,
        name: `${branch.name.slice(0, 6)}前台`,
        role: 'reception',
        branchId: branch.id,
        phone: '10000000001',
      };
    } else {
      const coach = COACHES.find((c) => c.id === selectedCoachId) || COACHES[0];
      user = coach;
    }

    await setCurrentUser(user);
  }

  function quickLogin(role: DemoRole) {
    selectedRole = role;
    setTimeout(handleLogin, 0);
  }
</script>

<div class="login-container">
  <div class="bubble bubble-1"></div>
  <div class="bubble bubble-2"></div>
  <div class="bubble bubble-3"></div>
  <div class="bubble bubble-4"></div>
  <div class="bubble bubble-5"></div>
  <div class="bubble bubble-6"></div>
  <div class="light-ray ray-1"></div>
  <div class="light-ray ray-2"></div>
  <div class="light-ray ray-3"></div>

  <div class="login-card">
    <div class="brand">
      <div class="logo-wrap">
        <svg class="logo-svg" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 55C20 40 35 30 50 35C65 40 60 55 75 50C90 45 95 35 110 40" stroke="rgba(255,255,255,0.3)" stroke-width="3" stroke-linecap="round" fill="none"/>
          <path d="M5 62C18 48 38 38 55 43C72 48 68 62 85 57C102 52 100 42 115 47" stroke="rgba(255,255,255,0.15)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <ellipse cx="60" cy="28" rx="28" ry="18" fill="rgba(255,255,255,0.9)"/>
          <ellipse cx="60" cy="30" rx="26" ry="15" fill="rgba(255,255,255,0.7)"/>
          <path d="M50 22C52 18 56 16 60 18C64 16 68 18 70 22" stroke="var(--teal-500)" stroke-width="2" stroke-linecap="round" fill="none"/>
          <circle cx="52" cy="27" r="2.5" fill="var(--ocean-800)"/>
          <circle cx="53" cy="26.5" r="0.8" fill="white"/>
          <circle cx="68" cy="27" r="2.5" fill="var(--ocean-800)"/>
          <circle cx="69" cy="26.5" r="0.8" fill="white"/>
          <path d="M57 32C58 34 62 34 63 32" stroke="var(--ocean-400)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
          <path d="M38 28C32 22 34 14 40 16" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round" fill="none"/>
          <path d="M82 28C88 22 86 14 80 16" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round" fill="none"/>
        </svg>
      </div>
      <h1>蓝鲸游泳</h1>
      <p class="subtitle">智能排课与学员管理系统</p>
    </div>

    <div class="login-form">
      <h2>选择身份登录</h2>

      <div class="role-tabs">
        <div class="role-tab-bg" class:pos-0={selectedRole === 'headquarters'} class:pos-1={selectedRole === 'reception'} class:pos-2={selectedRole === 'coach'}></div>
        <button
          class="role-tab"
          class:active={selectedRole === 'headquarters'}
          on:click={() => (selectedRole = 'headquarters')}
        >
          🏢 总部
        </button>
        <button
          class="role-tab"
          class:active={selectedRole === 'reception'}
          on:click={() => (selectedRole = 'reception')}
        >
          📋 前台
        </button>
        <button
          class="role-tab"
          class:active={selectedRole === 'coach'}
          on:click={() => (selectedRole = 'coach')}
        >
          👨‍🏫 教练
        </button>
      </div>

      {#if selectedRole === 'coach'}
        <div class="form-group">
          <label>选择教练</label>
          <select bind:value={selectedCoachId}>
            {#each COACHES as coach}
              <option value={coach.id}>{coach.name}</option>
            {/each}
          </select>
        </div>
      {:else if selectedRole === 'reception'}
        <div class="form-group">
          <label>选择分馆</label>
          <select bind:value={selectedBranchId}>
            {#each BRANCHES as branch}
              <option value={branch.id}>{branch.name}</option>
            {/each}
          </select>
        </div>
      {/if}

      <button class="login-btn" on:click={handleLogin}>
        <span class="btn-text">登 录</span>
        <span class="btn-icon">→</span>
      </button>

      <div class="quick-login">
        <p>快速体验</p>
        <div class="quick-btns">
          <button class="quick-btn" on:click={() => quickLogin('headquarters')}>
            总部账号
          </button>
          <button class="quick-btn" on:click={() => quickLogin('reception')}>
            前台账号
          </button>
          <button class="quick-btn" on:click={() => quickLogin('coach')}>
            教练账号
          </button>
        </div>
      </div>
    </div>

    <div class="tips">
      <p>💡 演示提示：不同身份有不同的数据权限</p>
      <ul>
        <li><strong>总部</strong>：查看所有分馆全部数据</li>
        <li><strong>前台</strong>：管理本馆排课和学员</li>
        <li><strong>教练</strong>：查看自己课表和学员</li>
      </ul>
    </div>
  </div>
</div>

<style>
  .login-container {
    min-height: 100vh;
    background: linear-gradient(
      135deg,
      var(--ocean-900) 0%,
      var(--ocean-800) 20%,
      var(--ocean-700) 40%,
      var(--ocean-600) 60%,
      var(--ocean-500) 80%,
      var(--teal-500) 100%
    );
    background-size: 300% 300%;
    animation: wave-shift 12s ease-in-out infinite;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
    overflow: hidden;
  }

  .bubble {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
    border: 1px solid rgba(255,255,255,0.06);
    pointer-events: none;
  }

  .bubble-1 {
    width: 320px; height: 320px;
    top: -80px; left: -60px;
    animation: bubble-float-1 8s ease-in-out infinite;
  }
  .bubble-2 {
    width: 200px; height: 200px;
    top: 60%; right: -40px;
    animation: bubble-float-2 10s ease-in-out infinite;
  }
  .bubble-3 {
    width: 140px; height: 140px;
    bottom: 10%; left: 15%;
    animation: bubble-float-3 7s ease-in-out infinite;
  }
  .bubble-4 {
    width: 80px; height: 80px;
    top: 20%; right: 20%;
    animation: bubble-float-4 9s ease-in-out infinite;
  }
  .bubble-5 {
    width: 60px; height: 60px;
    bottom: 30%; right: 35%;
    animation: bubble-float-2 6s ease-in-out infinite;
  }
  .bubble-6 {
    width: 100px; height: 100px;
    top: 35%; left: 8%;
    animation: bubble-float-1 11s ease-in-out infinite;
  }

  .light-ray {
    position: absolute;
    width: 2px;
    background: linear-gradient(to bottom, rgba(255,255,255,0.12), transparent);
    pointer-events: none;
    transform-origin: top center;
  }
  .ray-1 {
    height: 240px; top: -20px; left: 25%;
    transform: rotate(15deg);
    animation: ray-shimmer 6s ease-in-out infinite;
  }
  .ray-2 {
    height: 180px; top: 10px; left: 55%;
    transform: rotate(8deg);
    animation: ray-shimmer 8s ease-in-out 2s infinite;
  }
  .ray-3 {
    height: 200px; top: -10px; left: 75%;
    transform: rotate(20deg);
    animation: ray-shimmer 7s ease-in-out 4s infinite;
  }

  .login-card {
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(24px) saturate(1.4);
    -webkit-backdrop-filter: blur(24px) saturate(1.4);
    border-radius: var(--radius-xl);
    box-shadow:
      0 24px 64px rgba(10, 22, 40, 0.25),
      0 0 0 1px rgba(255, 255, 255, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
    width: 100%;
    max-width: 420px;
    overflow: hidden;
    animation: slide-up 0.7s var(--ease-spring) both;
    position: relative;
    z-index: 1;
  }

  .brand {
    padding: 36px 32px 20px;
    text-align: center;
    background: linear-gradient(135deg, var(--ocean-800), var(--ocean-700), var(--ocean-600));
    position: relative;
    overflow: hidden;
  }

  .brand::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 24px;
    background: linear-gradient(to top, rgba(255,255,255,0.88), transparent);
    pointer-events: none;
  }

  .logo-wrap {
    width: 100px;
    height: 68px;
    margin: 0 auto 10px;
    animation: scale-in 0.5s var(--ease-spring) 0.2s both;
  }

  .logo-svg {
    width: 100%;
    height: 100%;
  }

  .brand h1 {
    margin: 0;
    font-size: 26px;
    font-weight: 700;
    font-family: var(--font-display);
    color: white;
    letter-spacing: 1px;
  }

  .subtitle {
    margin: 4px 0 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: 0.5px;
  }

  .login-form {
    padding: 28px 32px 20px;
  }

  .login-form h2 {
    margin: 0 0 20px;
    font-size: 17px;
    font-weight: 600;
    color: var(--ocean-800);
    text-align: center;
    font-family: var(--font-display);
  }

  .role-tabs {
    display: flex;
    background: var(--surface-100);
    border-radius: var(--radius-full);
    padding: 4px;
    margin-bottom: 22px;
    position: relative;
  }

  .role-tab-bg {
    position: absolute;
    top: 4px;
    left: 4px;
    width: calc(33.333% - 2.67px);
    height: calc(100% - 8px);
    background: white;
    border-radius: var(--radius-full);
    box-shadow: 0 2px 8px rgba(10, 22, 40, 0.1);
    transition: transform 0.35s var(--ease-spring);
  }

  .role-tab-bg.pos-0 { transform: translateX(0); }
  .role-tab-bg.pos-1 { transform: translateX(100%); }
  .role-tab-bg.pos-2 { transform: translateX(200%); }

  .role-tab {
    flex: 1;
    padding: 10px 8px;
    border: none;
    background: transparent;
    border-radius: var(--radius-full);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 0.25s var(--ease-out);
    position: relative;
    z-index: 1;
  }

  .role-tab.active {
    color: var(--ocean-800);
    font-weight: 600;
  }

  .form-group {
    margin-bottom: 20px;
    animation: slide-up 0.3s var(--ease-out) both;
  }

  .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--ocean-700);
    margin-bottom: 8px;
  }

  .form-group select {
    width: 100%;
    padding: 12px 16px;
    border: 1.5px solid var(--surface-200);
    border-radius: var(--radius-md);
    font-size: 14px;
    background: white;
    box-sizing: border-box;
    color: var(--ocean-800);
    transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23475569' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
  }

  .form-group select:focus {
    outline: none;
    border-color: var(--teal-500);
    box-shadow: 0 0 0 4px rgba(0, 191, 165, 0.12);
  }

  .login-btn {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, var(--teal-500), var(--ocean-500));
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s var(--ease-spring);
    letter-spacing: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 16px rgba(0, 191, 165, 0.3);
  }

  .login-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(0, 191, 165, 0.4);
  }

  .login-btn:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(0, 191, 165, 0.3);
  }

  .btn-icon {
    transition: transform 0.3s var(--ease-spring);
    font-size: 18px;
  }

  .login-btn:hover .btn-icon {
    transform: translateX(4px);
  }

  .quick-login {
    margin-top: 22px;
    padding-top: 18px;
    border-top: 1px solid var(--surface-200);
  }

  .quick-login p {
    margin: 0 0 12px;
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
    letter-spacing: 0.5px;
  }

  .quick-btns {
    display: flex;
    gap: 8px;
  }

  .quick-btn {
    flex: 1;
    padding: 9px 8px;
    background: transparent;
    color: var(--ocean-400);
    border: 1.5px solid var(--ocean-200);
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.25s var(--ease-out);
  }

  .quick-btn:hover {
    background: var(--ocean-50);
    border-color: var(--teal-300);
    color: var(--teal-500);
  }

  .tips {
    padding: 16px 32px 24px;
    background: linear-gradient(to bottom, var(--surface-50), rgba(248, 250, 252, 0.6));
    border-top: 1px solid var(--surface-100);
  }

  .tips > p {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--teal-500);
    font-weight: 500;
  }

  .tips ul {
    margin: 0;
    padding-left: 18px;
  }

  .tips li {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 3px;
    line-height: 1.6;
  }

  .tips strong {
    color: var(--ocean-700);
  }

  @keyframes bubble-float-1 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
    33% { transform: translate(20px, -30px) scale(1.05); opacity: 0.8; }
    66% { transform: translate(-10px, 15px) scale(0.95); opacity: 0.5; }
  }

  @keyframes bubble-float-2 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
    50% { transform: translate(-20px, -25px) scale(1.08); opacity: 0.7; }
  }

  @keyframes bubble-float-3 {
    0%, 100% { transform: translate(0, 0); opacity: 0.4; }
    40% { transform: translate(15px, -20px); opacity: 0.65; }
    80% { transform: translate(-8px, 10px); opacity: 0.35; }
  }

  @keyframes bubble-float-4 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.45; }
    50% { transform: translate(-12px, -18px) scale(1.1); opacity: 0.65; }
  }

  @keyframes ray-shimmer {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
</style>
