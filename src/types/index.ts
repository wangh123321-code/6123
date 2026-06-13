export type UserRole = 'coach' | 'reception' | 'headquarters';

export interface Branch {
  id: string;
  name: string;
  address: string;
  lanes: number;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  branchId?: string;
  phone?: string;
  avatar?: string;
}

export interface Coach extends User {
  role: 'coach';
  specialties: string[];
  color: string;
}

export type SkillLevel =
  | 'breaststroke_beginner'
  | 'breaststroke_intermediate'
  | 'freestyle_beginner'
  | 'freestyle_advanced'
  | 'backstroke_beginner'
  | 'butterfly_beginner';

export interface SkillPoint {
  id: string;
  name: string;
  description: string;
}

export interface SkillLevelConfig {
  level: SkillLevel;
  name: string;
  skills: SkillPoint[];
}

export interface Student {
  id: string;
  name: string;
  parentName: string;
  parentPhone: string;
  branchId: string;
  currentLevel: SkillLevel;
  skillProgress: Record<string, {
    completed: boolean;
    completedAt?: string;
    coachId?: string;
    failedAttempts: number;
  }>;
  enrolledAt: string;
  notes?: string;
}

export interface Course {
  id: string;
  title: string;
  level: SkillLevel;
  branchId: string;
  coachId: string;
  lane: number;
  startTime: string;
  endTime: string;
  date: string;
  studentIds: string[];
  status: 'scheduled' | 'completed' | 'cancelled';
  skillPointsCovered?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseDraft extends Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'status'> {
  id?: string;
  status?: Course['status'];
}

export interface TimeSlotSuggestion {
  date: string;
  startTime: string;
  endTime: string;
}

export interface ConflictInfo {
  type: 'coach' | 'lane' | 'student';
  message: string;
  conflictingCourseId?: string;
  conflictingCourseTitle?: string;
  suggestion?: {
    date?: string;
    startTime?: string;
    lane?: number;
    coachId?: string;
    coachName?: string;
  };
  suggestedTimeSlots?: TimeSlotSuggestion[];
  suggestedCoaches?: { id: string; name: string; color: string }[];
  suggestedLanes?: number[];
}

export interface OperationLog {
  id: string;
  type: 'create' | 'update' | 'delete' | 'batch_create';
  entityType: 'course';
  timestamp: string;
  description: string;
  beforeState: Course | Course[] | null;
  afterState: Course | Course[] | null;
}

export interface BatchScheduleConfig {
  coachIds: string[];
  studentIds: string[];
  totalSessions: number;
  startDate: string;
  endDate: string;
  title: string;
  level: SkillLevel;
  durationMinutes: number;
  preferredStartTime?: string;
  avoidWeekends?: boolean;
}

export interface CoachDailyStats {
  coachId: string;
  date: string;
  totalMinutes: number;
  courseCount: number;
  saturation: number;
}

export interface CoachMonthlyReport {
  coachId: string;
  coachName: string;
  branchId: string;
  month: string;
  totalHours: number;
  totalCourses: number;
  studentCount: number;
}

export interface PromotionReport {
  branchId: string;
  branchName: string;
  month: string;
  totalStudents: number;
  promotedStudents: number;
  promotionRate: number;
  byLevel: Record<SkillLevel, { total: number; promoted: number }>;
}

export interface SyncRecord {
  entityType: 'course' | 'student' | 'coach' | 'branch';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: string;
  synced: boolean;
}

export type DraggableItemType = 'coach' | 'course';

export interface DragPayload {
  type: DraggableItemType;
  coachId?: string;
  courseId?: string;
}

export const LANE_COUNT = 8;
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 22;
export const TIME_SLOT_MINUTES = 30;
export const MAX_DAILY_HOURS = 8;
export const BUFFER_MINUTES = 15;
export const MAX_CONSECUTIVE_COURSES = 4;
export const MAX_DAILY_STUDENT_COURSES = 1;

export const SKILL_LEVELS: SkillLevelConfig[] = [
  {
    level: 'breaststroke_beginner',
    name: '蛙泳入门',
    skills: [
      { id: 'bb1', name: '水中憋气', description: '能在水中憋气10秒以上' },
      { id: 'bb2', name: '漂浮练习', description: '能借助浮板漂浮5秒' },
      { id: 'bb3', name: '腿部动作', description: '掌握蛙泳蹬腿基本动作' },
      { id: 'bb4', name: '手臂动作', description: '掌握蛙泳划手基本动作' },
      { id: 'bb5', name: '手脚配合', description: '能手脚配合游5米' },
      { id: 'bb6', name: '换气技巧', description: '掌握抬头换气动作' },
    ],
  },
  {
    level: 'breaststroke_intermediate',
    name: '蛙泳进阶',
    skills: [
      { id: 'bi1', name: '连贯游进', description: '能连贯游25米' },
      { id: 'bi2', name: '蹬腿发力', description: '蹬腿有力，推进效果好' },
      { id: 'bi3', name: '划手效率', description: '划手动作标准高效' },
      { id: 'bi4', name: '节奏控制', description: '掌握换气节奏，不慌乱' },
      { id: 'bi5', name: '转身技巧', description: '掌握池边转身动作' },
      { id: 'bi6', name: '耐力提升', description: '能连续游50米' },
    ],
  },
  {
    level: 'freestyle_beginner',
    name: '自由泳入门',
    skills: [
      { id: 'fb1', name: '打腿基础', description: '掌握自由泳打腿动作' },
      { id: 'fb2', name: '侧身呼吸', description: '掌握侧身转头换气' },
      { id: 'fb3', name: '划手动作', description: '掌握自由泳划手动作' },
      { id: 'fb4', name: '身体平直', description: '保持身体水平流线型' },
      { id: 'fb5', name: '手脚配合', description: '手脚协调配合游进' },
      { id: 'fb6', name: '连续游进', description: '能连续游15米' },
    ],
  },
  {
    level: 'freestyle_advanced',
    name: '自由泳进阶',
    skills: [
      { id: 'fa1', name: '高肘划水', description: '掌握高肘划水技术' },
      { id: 'fa2', name: '鞭状打腿', description: '打腿有力且有节奏' },
      { id: 'fa3', name: '双侧换气', description: '能双侧交替换气' },
      { id: 'fa4', name: '翻滚转身', description: '掌握翻滚转身技术' },
      { id: 'fa5', name: '节奏耐力', description: '能连续游100米' },
      { id: 'fa6', name: '速度提升', description: '25米速度达标' },
      { id: 'fa7', name: '出发技术', description: '掌握出发台出发动作' },
    ],
  },
  {
    level: 'backstroke_beginner',
    name: '仰泳入门',
    skills: [
      { id: 'bk1', name: '仰卧漂浮', description: '能稳定仰卧漂浮' },
      { id: 'bk2', name: '仰泳打腿', description: '掌握仰泳打腿动作' },
      { id: 'bk3', name: '划手动作', description: '掌握仰泳划手动作' },
      { id: 'bk4', name: '配合游进', description: '手脚配合游进10米' },
      { id: 'bk5', name: '节奏控制', description: '保持稳定节奏' },
    ],
  },
  {
    level: 'butterfly_beginner',
    name: '蝶泳入门',
    skills: [
      { id: 'bf1', name: '海豚腿', description: '掌握海豚腰腹发力' },
      { id: 'bf2', name: '划手动作', description: '掌握蝶泳划手动作' },
      { id: 'bf3', name: '出水换气', description: '掌握出水换气时机' },
      { id: 'bf4', name: '配合节奏', description: '一次划手两次打腿' },
      { id: 'bf5', name: '连贯游进', description: '能连续游15米' },
      { id: 'bf6', name: '力量耐力', description: '动作连贯有力' },
      { id: 'bf7', name: '出发技术', description: '掌握蝶泳出发动作' },
      { id: 'bf8', name: '转身技术', description: '掌握蝶泳转身动作' },
    ],
  },
];

export function getSkillLevelName(level: SkillLevel): string {
  const found = SKILL_LEVELS.find((l) => l.level === level);
  return found ? found.name : level;
}

export function getSkillPointsForLevel(level: SkillLevel): SkillPoint[] {
  const found = SKILL_LEVELS.find((l) => l.level === level);
  return found ? found.skills : [];
}
