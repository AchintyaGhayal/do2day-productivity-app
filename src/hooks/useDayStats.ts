import { useMemo } from 'react';
import { useTasks } from '@/contexts/TasksContext';
import { format, isToday, isTomorrow, startOfDay, addDays } from 'date-fns';
import { WorkSlice } from '@/types/scheduling';
import { loadCompletedSlices, CompletedSlice } from '@/lib/focusSession';

export interface DayStats {
  // Focus time
  totalFocusMinutes: number;
  deepFocusMinutes: number;
  lightFocusMinutes: number;
  
  // Block counts
  completedBlocks: number;
  skippedBlocks: number;
  rescheduledCount: number;
  
  // Booleans
  isDayComplete: boolean;
  hasAnyWork: boolean;
}

export interface TomorrowPreview {
  firstBlock: WorkSlice | null;
  atRiskTasks: Array<{ title: string; reason: string }>;
  totalBlocks: number;
}

const DAY_REFLECTION_KEY = 'flowday_day_reflection';
const RESCHEDULED_COUNT_KEY = 'flowday_rescheduled_count';

export function loadDayReflection(): 'good' | 'heavy' | null {
  try {
    const stored = localStorage.getItem(DAY_REFLECTION_KEY);
    if (!stored) return null;
    const { date, feeling } = JSON.parse(stored);
    const today = format(new Date(), 'yyyy-MM-dd');
    if (date === today) {
      return feeling as 'good' | 'heavy';
    }
    return null;
  } catch {
    return null;
  }
}

export function saveDayReflection(feeling: 'good' | 'heavy'): void {
  const today = format(new Date(), 'yyyy-MM-dd');
  localStorage.setItem(DAY_REFLECTION_KEY, JSON.stringify({ date: today, feeling }));
}

export function loadRescheduledCount(): number {
  try {
    const stored = localStorage.getItem(RESCHEDULED_COUNT_KEY);
    if (!stored) return 0;
    const { date, count } = JSON.parse(stored);
    const today = format(new Date(), 'yyyy-MM-dd');
    if (date === today) {
      return count;
    }
    return 0;
  } catch {
    return 0;
  }
}

export function incrementRescheduledCount(): void {
  const today = format(new Date(), 'yyyy-MM-dd');
  const current = loadRescheduledCount();
  localStorage.setItem(RESCHEDULED_COUNT_KEY, JSON.stringify({ date: today, count: current + 1 }));
}

export function useDayStats(): DayStats {
  const { schedule, getSlicesForDay, completedSliceIds, tasks, atRiskTasks } = useTasks();
  
  return useMemo(() => {
    const today = new Date();
    const todaySlices = getSlicesForDay(today);
    const completedSlices = loadCompletedSlices();
    
    // Calculate completed blocks and focus time from completed slices
    let deepFocusMinutes = 0;
    let lightFocusMinutes = 0;
    let completedBlocks = 0;
    
    for (const completed of completedSlices) {
      completedBlocks++;
      const task = tasks.find(t => t.id === completed.taskId);
      if (task?.difficulty === 'deep') {
        deepFocusMinutes += completed.durationMinutes;
      } else {
        lightFocusMinutes += completed.durationMinutes;
      }
    }
    
    // Count skipped blocks
    const skippedBlocks = todaySlices.filter(s => s.sliceStatus === 'skipped').length;
    
    // Get rescheduled count from localStorage
    const rescheduledCount = loadRescheduledCount();
    
    // Determine if day is complete
    // Day is complete if: all blocks are done/skipped OR current time is past workday end
    const remainingBlocks = todaySlices.filter(
      s => s.sliceStatus !== 'skipped' && !completedSliceIds.has(s.id)
    );
    const isDayComplete = remainingBlocks.length === 0 || todaySlices.length === 0;
    
    return {
      totalFocusMinutes: deepFocusMinutes + lightFocusMinutes,
      deepFocusMinutes,
      lightFocusMinutes,
      completedBlocks,
      skippedBlocks,
      rescheduledCount,
      isDayComplete,
      hasAnyWork: todaySlices.length > 0 || completedBlocks > 0,
    };
  }, [schedule, getSlicesForDay, completedSliceIds, tasks]);
}

export function useTomorrowPreview(): TomorrowPreview {
  const { getSlicesForDay, atRiskTasks } = useTasks();
  
  return useMemo(() => {
    const tomorrow = addDays(startOfDay(new Date()), 1);
    const tomorrowSlices = getSlicesForDay(tomorrow);
    
    // Get the first block for tomorrow (non-skipped, non-completed)
    const firstBlock = tomorrowSlices.find(s => s.sliceStatus === 'planned') || null;
    
    // Get at-risk tasks due tomorrow
    const tomorrowAtRisk = atRiskTasks
      .filter(({ task }) => isTomorrow(task.dueDate))
      .slice(0, 2)
      .map(({ task, reason }) => ({ title: task.title, reason }));
    
    return {
      firstBlock,
      atRiskTasks: tomorrowAtRisk,
      totalBlocks: tomorrowSlices.filter(s => s.sliceStatus === 'planned').length,
    };
  }, [getSlicesForDay, atRiskTasks]);
}
