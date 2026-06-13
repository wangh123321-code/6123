<script lang="ts">
  import { get } from 'svelte/store';
  import type { Branch, Coach, Course, Student } from '../types';
  import { getSkillLevelName } from '../types';
  import {
    generateCoachMonthlyReport,
    generatePromotionReport,
    exportCoachReportToExcel,
    exportPromotionReportToExcel,
    exportStudentProgressToExcel,
  } from '../lib/reports';

  export let branches: Branch[];
  export let coaches: Coach[];
  export let courses: Course[];
  export let students: Student[];

  const now = new Date();
  let reportType: 'coach' | 'promotion' = 'coach';
  let reportYear = now.getFullYear();
  let reportMonth = now.getMonth();

  $: coachReports = generateCoachMonthlyReport(coaches, courses, reportYear, reportMonth);
  $: promotionReports = generatePromotionReport(branches, students, courses, reportYear, reportMonth);

  const years = [now.getFullYear() - 1, now.getFullYear()];
  const months = Array.from({ length: 12 }, (_, i) => i);
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  function handleExportCoach() {
    exportCoachReportToExcel(coachReports, branches);
  }

  function handleExportPromotion() {
    exportPromotionReportToExcel(promotionReports);
  }

  function handleExportStudents() {
    exportStudentProgressToExcel(students);
  }
</script>

<div class="report-panel">
  <div class="panel-header">
    <h3>数据报表</h3>
    <div class="header-actions">
      <button class="export-btn-student" on:click={handleExportStudents}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        导出学员进度
      </button>
    </div>
  </div>

  <div class="report-controls">
    <div class="tab-group">
      <button
        class="tab"
        class:active={reportType === 'coach'}
        on:click={() => (reportType = 'coach')}
      >
        教练课时统计
      </button>
      <button
        class="tab"
        class:active={reportType === 'promotion'}
        on:click={() => (reportType = 'promotion')}
      >
        学员晋级率
      </button>
    </div>

    <div class="date-selectors">
      <select bind:value={reportYear}>
        {#each years as y}
          <option value={y}>{y}年</option>
        {/each}
      </select>
      <select bind:value={reportMonth}>
        {#each months as m}
          <option value={m}>{monthNames[m]}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="report-content">
    {#if reportType === 'coach'}
      <div class="report-section">
        <div class="section-header">
          <h4>教练课时统计 — {reportYear}年{monthNames[reportMonth]}</h4>
          <button class="export-btn" on:click={handleExportCoach}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            导出Excel
          </button>
        </div>

        <div class="summary-cards">
          <div class="summary-card">
            <div class="card-label">总课时</div>
            <div class="card-value">
              {coachReports.reduce((sum, r) => sum + r.totalHours, 0).toFixed(1)}
              <span class="card-unit">小时</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="card-label">总课节数</div>
            <div class="card-value">
              {coachReports.reduce((sum, r) => sum + r.totalCourses, 0)}
              <span class="card-unit">节</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="card-label">人均课时</div>
            <div class="card-value">
              {coachReports.length > 0
                ? (coachReports.reduce((sum, r) => sum + r.totalHours, 0) / coachReports.length).toFixed(1)
                : 0}
              <span class="card-unit">小时</span>
            </div>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="report-table">
            <thead>
              <tr>
                <th>教练</th>
                <th>课时数</th>
                <th>总时长(小时)</th>
                <th>带教学员</th>
              </tr>
            </thead>
            <tbody>
              {#each coachReports.sort((a, b) => b.totalHours - a.totalHours) as report, i}
                <tr class:row-alt={i % 2 === 1}>
                  <td>
                    <strong>{report.coachName}</strong>
                  </td>
                  <td>{report.totalCourses}</td>
                  <td>{report.totalHours}</td>
                  <td>{report.studentCount}人</td>
                </tr>
              {/each}
              {#if coachReports.length === 0}
                <tr>
                  <td colspan="4" class="empty-cell">暂无数据</td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    {:else}
      <div class="report-section">
        <div class="section-header">
          <h4>学员晋级率统计 — {reportYear}年{monthNames[reportMonth]}</h4>
          <button class="export-btn" on:click={handleExportPromotion}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            导出Excel
          </button>
        </div>

        <div class="summary-cards">
          <div class="summary-card">
            <div class="card-label">学员总数</div>
            <div class="card-value">
              {promotionReports.reduce((sum, r) => sum + r.totalStudents, 0)}
              <span class="card-unit">人</span>
            </div>
          </div>
          <div class="summary-card card-promoted">
            <div class="card-label">达标晋级</div>
            <div class="card-value">
              {promotionReports.reduce((sum, r) => sum + r.promotedStudents, 0)}
              <span class="card-unit">人</span>
            </div>
          </div>
          <div class="summary-card card-rate">
            <div class="card-label">综合晋级率</div>
            <div class="card-value">
              {promotionReports.reduce((sum, r) => sum + r.totalStudents, 0) > 0
                ? Math.round(
                    (promotionReports.reduce((sum, r) => sum + r.promotedStudents, 0) /
                      promotionReports.reduce((sum, r) => sum + r.totalStudents, 0)) *
                      100
                  )
                : 0}
              <span class="card-unit">%</span>
            </div>
          </div>
        </div>

        <div class="branches-reports">
          {#each promotionReports as report}
            <div class="branch-report">
              <div class="branch-header">
                <h5>{report.branchName}</h5>
                <div class="branch-stats">
                  <span>共 {report.totalStudents} 人</span>
                  <span class="promoted">达标 {report.promotedStudents} 人</span>
                  <span class="rate">{report.promotionRate}%</span>
                </div>
              </div>
              <div class="level-breakdown">
                {#each Object.entries(report.byLevel) as [level, info]}
                  <div class="level-item">
                    <div class="level-name">{getSkillLevelName(level as any)}</div>
                    <div class="level-bar-wrapper">
                      <div class="level-bar">
                        <div
                          class="level-bar-fill"
                          style="width: {info.total > 0 ? (info.promoted / info.total) * 100 : 0}%"
                        ></div>
                      </div>
                      <span class="level-count">
                        {info.promoted}/{info.total}
                      </span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .report-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--surface-0);
    overflow: hidden;
  }

  .panel-header {
    padding: 16px 24px;
    background: var(--ocean-800);
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    font-family: var(--font-display);
    letter-spacing: 0.02em;
  }

  .export-btn-student {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--teal-500);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
  }

  .export-btn-student:hover {
    background: var(--teal-400);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .report-controls {
    padding: 12px 24px;
    border-bottom: 1px solid var(--surface-200);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--surface-50);
    flex-wrap: wrap;
    gap: 12px;
  }

  .tab-group {
    display: flex;
    background: var(--surface-200);
    border-radius: 999px;
    padding: 3px;
  }

  .tab {
    padding: 8px 20px;
    border: none;
    background: transparent;
    border-radius: 999px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    transition: all 0.2s var(--ease-out);
    font-family: var(--font-body);
  }

  .tab.active {
    background: var(--teal-500);
    color: white;
    box-shadow: var(--shadow-xs);
  }

  .tab:not(.active):hover {
    color: var(--text-secondary);
  }

  .date-selectors {
    display: flex;
    gap: 8px;
  }

  .date-selectors select {
    padding: 8px 12px;
    border: 1px solid var(--surface-200);
    border-radius: var(--radius-md);
    font-size: 13px;
    font-family: var(--font-body);
    color: var(--text-primary);
    background: var(--surface-0);
    transition: border-color 0.2s var(--ease-out);
  }

  .date-selectors select:focus {
    outline: none;
    border-color: var(--teal-500);
    box-shadow: 0 0 0 3px rgba(0, 191, 165, 0.15);
  }

  .report-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .report-section {
    max-width: 1000px;
    margin: 0 auto;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .section-header h4 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    font-family: var(--font-display);
  }

  .export-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--teal-500);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
  }

  .export-btn:hover {
    background: var(--teal-400);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .summary-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }

  .summary-card {
    padding: 20px;
    background: var(--surface-50);
    border-radius: var(--radius-lg);
    border: 1px solid var(--surface-200);
    transition: box-shadow 0.2s var(--ease-out);
  }

  .summary-card:hover {
    box-shadow: var(--shadow-sm);
  }

  .summary-card.card-promoted {
    background: var(--amber-100);
    border-color: var(--amber-300);
  }

  .summary-card.card-promoted .card-value {
    color: var(--amber-500);
  }

  .summary-card.card-rate {
    background: var(--teal-50);
    border-color: var(--teal-200);
  }

  .summary-card.card-rate .card-value {
    color: var(--teal-500);
  }

  .card-label {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: var(--font-body);
  }

  .card-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-display);
    line-height: 1.1;
  }

  .card-unit {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    margin-left: 4px;
    font-family: var(--font-body);
  }

  .table-wrapper {
    background: var(--surface-0);
    border: 1px solid var(--surface-200);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .report-table {
    width: 100%;
    border-collapse: collapse;
  }

  .report-table th {
    padding: 12px 16px;
    background: var(--surface-50);
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--surface-200);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-family: var(--font-body);
  }

  .report-table td {
    padding: 12px 16px;
    font-size: 14px;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--surface-100);
    font-family: var(--font-body);
    transition: background 0.15s var(--ease-out);
  }

  .report-table tr:last-child td {
    border-bottom: none;
  }

  .report-table tr.row-alt td {
    background: var(--surface-50);
  }

  .report-table tbody tr:hover td {
    background: var(--teal-50);
  }

  .report-table td strong {
    color: var(--text-primary);
    font-weight: 600;
  }

  .empty-cell {
    text-align: center;
    padding: 40px !important;
    color: var(--text-muted) !important;
    font-style: italic;
  }

  .branches-reports {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .branch-report {
    background: var(--surface-50);
    border: 1px solid var(--surface-200);
    border-radius: var(--radius-lg);
    padding: 20px 24px;
    transition: box-shadow 0.2s var(--ease-out);
  }

  .branch-report:hover {
    box-shadow: var(--shadow-sm);
  }

  .branch-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .branch-header h5 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    font-family: var(--font-display);
  }

  .branch-stats {
    display: flex;
    gap: 16px;
    align-items: center;
    font-size: 13px;
    color: var(--text-muted);
    font-family: var(--font-body);
  }

  .branch-stats .promoted {
    color: var(--teal-500);
    font-weight: 600;
  }

  .branch-stats .rate {
    padding: 4px 12px;
    background: var(--teal-500);
    color: white;
    border-radius: 999px;
    font-weight: 600;
    font-size: 12px;
  }

  .level-breakdown {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .level-item {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .level-name {
    width: 100px;
    font-size: 12px;
    color: var(--text-secondary);
    flex-shrink: 0;
    font-family: var(--font-body);
  }

  .level-bar-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .level-bar {
    flex: 1;
    height: 8px;
    background: var(--surface-200);
    border-radius: 999px;
    overflow: hidden;
  }

  .level-bar-fill {
    height: 100%;
    background: var(--teal-500);
    border-radius: 999px;
    transition: width 0.6s var(--ease-spring);
  }

  .level-count {
    font-size: 12px;
    color: var(--text-muted);
    min-width: 50px;
    text-align: right;
    font-family: var(--font-body);
  }
</style>
