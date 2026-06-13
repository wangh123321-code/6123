import * as XLSX from 'xlsx';
import type {
  Coach,
  Course,
  CoachMonthlyReport,
  PromotionReport,
  Branch,
  Student,
  SkillLevel,
} from '../types';
import {
  calculateDurationMinutes,
  formatDate,
  getNextLevel,
} from './utils';
import { getSkillPointsForLevel, getSkillLevelName } from '../types';

export function generateCoachMonthlyReport(
  coaches: Coach[],
  courses: Course[],
  year: number,
  month: number
): CoachMonthlyReport[] {
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const reports: CoachMonthlyReport[] = [];

  for (const coach of coaches) {
    const monthCourses = courses.filter((c) => {
      if (c.coachId !== coach.id) return false;
      if (c.status === 'cancelled') return false;
      const [cy, cm] = c.date.split('-').map(Number);
      return cy === year && cm === month + 1;
    });

    let totalMinutes = 0;
    const studentSet = new Set<string>();
    for (const c of monthCourses) {
      totalMinutes += calculateDurationMinutes(c.startTime, c.endTime);
      c.studentIds.forEach((s) => studentSet.add(s));
    }

    reports.push({
      coachId: coach.id,
      coachName: coach.name,
      branchId: coach.branchId || '',
      month: monthStr,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      totalCourses: monthCourses.length,
      studentCount: studentSet.size,
    });
  }

  return reports;
}

export function generatePromotionReport(
  branches: Branch[],
  students: Student[],
  courses: Course[],
  year: number,
  month: number
): PromotionReport[] {
  const reports: PromotionReport[] = [];
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const levelList: SkillLevel[] = [
    'breaststroke_beginner',
    'breaststroke_intermediate',
    'freestyle_beginner',
    'freestyle_advanced',
    'backstroke_beginner',
    'butterfly_beginner',
  ];

  for (const branch of branches) {
    const branchStudents = students.filter((s) => s.branchId === branch.id);

    const byLevel: PromotionReport['byLevel'] = {} as PromotionReport['byLevel'];
    let totalStudents = 0;
    let promotedStudents = 0;

    for (const level of levelList) {
      const levelStudents = branchStudents.filter((s) => s.currentLevel === level);
      const skills = getSkillPointsForLevel(level);
      const promotedInLevel = levelStudents.filter((s) => {
        if (skills.length === 0) return false;
        return skills.every((sk) => s.skillProgress[sk.id]?.completed);
      });

      byLevel[level] = {
        total: levelStudents.length,
        promoted: promotedInLevel.length,
      };
      totalStudents += levelStudents.length;
      promotedStudents += promotedInLevel.length;
    }

    reports.push({
      branchId: branch.id,
      branchName: branch.name,
      month: monthStr,
      totalStudents,
      promotedStudents,
      promotionRate: totalStudents > 0 ? Math.round((promotedStudents / totalStudents) * 100) : 0,
      byLevel,
    });
  }

  return reports;
}

export function exportCoachReportToExcel(reports: CoachMonthlyReport[], branches: Branch[]): void {
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const data = reports.map((r) => ({
    '月份': r.month,
    '分馆': branchMap.get(r.branchId) || '未知',
    '教练姓名': r.coachName,
    '课时数': r.totalCourses,
    '总课时(小时)': r.totalHours,
    '带教学员数': r.studentCount,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 10 }, { wch: 25 }, { wch: 12 },
    { wch: 10 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '教练课时统计');
  XLSX.writeFile(wb, `教练课时统计_${formatDate(new Date())}.xlsx`);
}

export function exportPromotionReportToExcel(reports: PromotionReport[]): void {
  const data: Record<string, string | number>[] = [];

  for (const r of reports) {
    data.push({
      月份: r.month,
      分馆: r.branchName,
      学员总数: r.totalStudents,
      达标晋级人数: r.promotedStudents,
      晋级率: `${r.promotionRate}%`,
    });
    for (const [level, info] of Object.entries(r.byLevel)) {
      data.push({
        月份: '',
        分馆: `  ${getSkillLevelName(level as SkillLevel)}`,
        学员总数: info.total,
        达标晋级人数: info.promoted,
        晋级率: info.total > 0 ? `${Math.round((info.promoted / info.total) * 100)}%` : '0%',
      });
    }
  }

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '学员晋级统计');
  XLSX.writeFile(wb, `学员晋级统计_${formatDate(new Date())}.xlsx`);
}

export function exportStudentProgressToExcel(students: Student[]): void {
  const data: Record<string, string | number>[] = [];

  for (const s of students) {
    const skills = getSkillPointsForLevel(s.currentLevel);
    const completed = skills.filter((sk) => s.skillProgress[sk.id]?.completed).length;
    const needsAttention = skills.some((sk) => (s.skillProgress[sk.id]?.failedAttempts || 0) >= 3);

    data.push({
      学员姓名: s.name,
      家长姓名: s.parentName,
      联系电话: s.parentPhone,
      当前级别: getSkillLevelName(s.currentLevel),
      已掌握技能: `${completed}/${skills.length}`,
      进度: skills.length > 0 ? `${Math.round((completed / skills.length) * 100)}%` : '0%',
      需关注: needsAttention ? '是' : '否',
    });
  }

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '学员进度一览');
  XLSX.writeFile(wb, `学员进度_${formatDate(new Date())}.xlsx`);
}
