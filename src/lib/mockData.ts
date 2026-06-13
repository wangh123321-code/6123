import type { Branch, Coach, Course, Student } from '../types';
import type { SkillLevel } from '../types';
import { formatDate, generateId } from './utils';

export const BRANCHES: Branch[] = [
  { id: 'branch-1', name: '蓝鲸游泳·总店', address: '北京市朝阳区建国路88号', lanes: 8 },
  { id: 'branch-2', name: '蓝鲸游泳·海淀分馆', address: '北京市海淀区中关村大街1号', lanes: 6 },
  { id: 'branch-3', name: '蓝鲸游泳·西城分馆', address: '北京市西城区金融街18号', lanes: 5 },
  { id: 'branch-4', name: '蓝鲸游泳·东城分馆', address: '北京市东城区王府井大街99号', lanes: 6 },
  { id: 'branch-5', name: '蓝鲸游泳·丰台分馆', address: '北京市丰台区丰台北路50号', lanes: 5 },
  { id: 'branch-6', name: '蓝鲸游泳·通州分馆', address: '北京市通州区新华大街120号', lanes: 6 },
  { id: 'branch-7', name: '蓝鲸游泳·昌平分馆', address: '北京市昌平区回龙观西大街30号', lanes: 5 },
  { id: 'branch-8', name: '蓝鲸游泳·朝阳公园分馆', address: '北京市朝阳区朝阳公园南路8号', lanes: 8 },
  { id: 'branch-9', name: '蓝鲸游泳·望京分馆', address: '北京市朝阳区望京街9号', lanes: 6 },
  { id: 'branch-10', name: '蓝鲸游泳·亦庄分馆', address: '北京市大兴区亦庄荣华中路10号', lanes: 6 },
  { id: 'branch-11', name: '蓝鲸游泳·石景山分馆', address: '北京市石景山区石景山路20号', lanes: 5 },
  { id: 'branch-12', name: '蓝鲸游泳·顺义分馆', address: '北京市顺义区府前中街15号', lanes: 6 },
];

const coachColors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7',
];

const coachNames = [
  '张伟', '李娜', '王强', '刘洋', '陈静', '杨帆',
  '赵敏', '黄磊', '周婷', '吴刚', '郑洁', '孙浩',
  '马琳', '朱鹏', '胡雪', '郭涛',
];

export const COACHES: Coach[] = coachNames.map((name, i) => ({
  id: `coach-${i + 1}`,
  name,
  role: 'coach' as const,
  branchId: BRANCHES[i % BRANCHES.length].id,
  specialties: ['蛙泳', '自由泳', '仰泳', '蝶泳'].slice(0, (i % 3) + 1),
  color: coachColors[i % coachColors.length],
  phone: `138${String(10000000 + i * 7).padStart(8, '0')}`,
}));

const studentNames = [
  '小明', '小红', '小华', '小丽', '小强', '小芳',
  '小军', '小燕', '小龙', '小凤', '小虎', '小英',
  '小牛', '小梅', '小伟', '小娟',
];

const levels: SkillLevel[] = [
  'breaststroke_beginner', 'breaststroke_intermediate',
  'freestyle_beginner', 'freestyle_advanced',
  'backstroke_beginner', 'butterfly_beginner',
];

export function generateStudents(branchId: string, count: number): Student[] {
  const result: Student[] = [];
  for (let i = 0; i < count; i++) {
    const level = levels[i % levels.length];
    const skills: Student['skillProgress'] = {};
    result.push({
      id: `student-${branchId}-${i + 1}`,
      name: `${studentNames[i % studentNames.length]}${i + 1}号`,
      parentName: `${studentNames[i % studentNames.length]}家长`,
      parentPhone: `139${String(10000000 + ((i + 13) * 13) % 100000000).padStart(8, '0')}`,
      branchId,
      currentLevel: level,
      skillProgress: skills,
      enrolledAt: formatDate(new Date(Date.now() - (i + 1) * 30 * 24 * 3600 * 1000)),
    });
  }
  return result;
}

export const ALL_STUDENTS: Student[] = BRANCHES.flatMap((b, bi) =>
  generateStudents(b.id, 8 + (bi % 3) * 4)
);

export function generateInitialCourses(): Course[] {
  const courses: Course[] = [];
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);

  for (let weekOffset = -1; weekOffset <= 1; weekOffset++) {
    for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + weekOffset * 7 + dayIdx);
      const dateStr = formatDate(date);

      for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
        const startHour = 9 + slotIdx * 2 + (dayIdx % 2);
        if (startHour >= 21) continue;
        const startTime = `${String(startHour).padStart(2, '0')}:00`;
        const endTime = `${String(startHour + 1).padStart(2, '0')}:00`;

        const branchIdx = (dayIdx + slotIdx + weekOffset + 12) % BRANCHES.length;
        const branch = BRANCHES[branchIdx];
        const branchCoaches = COACHES.filter((c) => c.branchId === branch.id);
        if (branchCoaches.length === 0) continue;

        const coach = branchCoaches[slotIdx % branchCoaches.length];
        const lane = (slotIdx % branch.lanes) + 1;
        const level = levels[(dayIdx + slotIdx) % levels.length];
        const branchStudents = ALL_STUDENTS.filter((s) => s.branchId === branch.id && s.currentLevel === level);
        const studentIds = branchStudents.slice(0, Math.min(4, branchStudents.length)).map((s) => s.id);

        if (studentIds.length === 0) continue;

        courses.push({
          id: generateId(),
          title: `${level.includes('breaststroke') ? '蛙泳' : level.includes('freestyle') ? '自由泳' : level.includes('backstroke') ? '仰泳' : '蝶泳'}课`,
          level,
          branchId: branch.id,
          coachId: coach.id,
          lane,
          startTime,
          endTime,
          date: dateStr,
          studentIds,
          status: weekOffset < 0 ? 'completed' : 'scheduled',
          skillPointsCovered: [],
          createdAt: dateStr,
          updatedAt: dateStr,
        });
      }
    }
  }
  return courses;
}
