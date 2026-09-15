import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ResultIndicator, TestRunHistoryPoint } from '../../generated/hateoas';
import { statusClass, toDate } from './metrics-utils';

type CalendarDay = {
  key: string;
  date: Date;
  title: string;
  total: number;
  successful: number;
  partial: number;
  failed: number;
  indicator: ResultIndicator | null;
  intensity: number;
};

type CalendarWeek = {
  key: string;
  days: CalendarDay[];
};

type CalendarMonth = {
  key: string;
  label: string;
  span: number;
};

type CalendarModel = {
  months: CalendarMonth[];
  weeks: CalendarWeek[];
  activeDays: number;
  rangeLabel: string;
};

const CALENDAR_DAYS = 365;
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EMPTY_CALENDAR_DAY: Omit<CalendarDay, 'key' | 'date' | 'title'> = {
  total: 0,
  successful: 0,
  partial: 0,
  failed: 0,
  indicator: null,
  intensity: 0,
};

@Component({
  selector: 'app-metrics-calendar-panel',
  template: `
    <section class="calendar-panel" aria-labelledby="calendar-title">
      <div class="chart-header">
        <div>
          <h2 id="calendar-title">Daily run calendar</h2>
          <p>{{ calendar().rangeLabel }} &middot; {{ calendar().activeDays }} active days</p>
        </div>
        <div class="calendar-legend" aria-label="Daily run calendar legend">
          <span>No runs</span>
          <span class="calendar-swatch is-empty"></span>
          <span class="calendar-swatch status-success intensity-1"></span>
          <span class="calendar-swatch status-success intensity-2"></span>
          <span class="calendar-swatch status-success intensity-3"></span>
          <span class="calendar-swatch status-success intensity-4"></span>
          <span>More</span>
        </div>
      </div>

      @if (runs().length > 0) {
        <div
          class="calendar-shell"
          role="img"
          aria-label="Daily test run result calendar"
          [style.--calendar-weeks]="calendar().weeks.length"
        >
          <div class="calendar-months" aria-hidden="true">
            <span></span>
            @for (month of calendar().months; track month.key) {
              <span [style.grid-column]="'span ' + month.span">{{ month.label }}</span>
            }
          </div>

          <div class="calendar-body">
            <div class="calendar-weekdays" aria-hidden="true">
              @for (weekday of weekdayLabels; track weekday) {
                <span>{{ weekday }}</span>
              }
            </div>

            <div class="calendar-weeks">
              @for (week of calendar().weeks; track week.key) {
                <div class="calendar-week">
                  @for (day of week.days; track day.key) {
                    <span
                      [class]="calendarDayClass(day)"
                      [attr.aria-label]="day.title"
                      [title]="day.title"
                    ></span>
                  }
                </div>
              }
            </div>
          </div>

          <div class="calendar-result-legend" aria-label="Calendar result colors">
            <span class="legend-item status-success">Success</span>
            <span class="legend-item status-partial">Partial</span>
            <span class="legend-item status-failure">Failure</span>
          </div>
        </div>
      } @else {
        <div class="empty-state compact">No daily run calendar available.</div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsCalendarPanelComponent {
  readonly runs = input<TestRunHistoryPoint[]>([]);

  protected readonly weekdayLabels = WEEKDAY_LABELS;
  protected readonly calendar = computed(() => this.buildCalendar(this.runs()));
  private readonly calendarDateFormat = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  private readonly calendarMonthFormat = new Intl.DateTimeFormat(undefined, {
    month: 'short',
  });

  protected calendarDayClass(day: CalendarDay): string {
    if (!day.indicator || day.intensity === 0) {
      return 'calendar-day is-empty';
    }

    return `calendar-day ${statusClass(day.indicator)} intensity-${day.intensity}`;
  }

  private buildCalendar(runs: TestRunHistoryPoint[]): CalendarModel {
    const datedRuns = runs
      .map((run) => ({ run, date: toDate(run.timestamp) }))
      .filter((item): item is { run: TestRunHistoryPoint; date: Date } => item.date !== null);
    const latestRunDate =
      datedRuns.length > 0
        ? new Date(Math.max(...datedRuns.map((item) => item.date.getTime())))
        : new Date();
    const endDate = this.endOfWeek(this.startOfDay(latestRunDate));
    const startDate = this.startOfWeek(this.addDays(endDate, -(CALENDAR_DAYS - 1)));
    const dayCounts = new Map<string, Omit<CalendarDay, 'key' | 'date' | 'title'>>();

    for (const { run, date } of datedRuns) {
      const day = this.startOfDay(date);
      if (day < startDate || day > endDate) {
        continue;
      }

      const key = this.dayKey(day);
      const counts = dayCounts.get(key) ?? { ...EMPTY_CALENDAR_DAY };
      counts.total++;

      switch (run.indicator) {
        case 'SUCCESS':
          counts.successful++;
          break;
        case 'PARTIAL_SUCCESS':
          counts.partial++;
          break;
        case 'FAILURE':
          counts.failed++;
          break;
      }

      dayCounts.set(key, counts);
    }

    const weeks: CalendarWeek[] = [];
    let cursor = new Date(startDate);

    while (cursor <= endDate) {
      const weekStart = new Date(cursor);
      const days: CalendarDay[] = [];

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const date = this.addDays(weekStart, dayIndex);
        const key = this.dayKey(date);
        const counts = dayCounts.get(key) ?? EMPTY_CALENDAR_DAY;
        const indicator = this.calendarIndicator(counts.successful, counts.partial, counts.failed);
        const dominantCount = this.calendarDominantCount(indicator, counts);

        days.push({
          key,
          date,
          title: this.calendarDayTitle(date, counts),
          total: counts.total,
          successful: counts.successful,
          partial: counts.partial,
          failed: counts.failed,
          indicator,
          intensity: this.calendarIntensity(dominantCount),
        });
      }

      weeks.push({
        key: this.dayKey(weekStart),
        days,
      });
      cursor = this.addDays(cursor, 7);
    }

    const activeDays = [...dayCounts.values()].filter((day) => day.total > 0).length;

    return {
      months: this.calendarMonths(weeks),
      weeks,
      activeDays,
      rangeLabel: `${this.calendarDateLabel(startDate)} to ${this.calendarDateLabel(endDate)}`,
    };
  }

  private calendarIndicator(
    successful: number,
    partial: number,
    failed: number,
  ): ResultIndicator | null {
    if (successful === 0 && partial === 0 && failed === 0) {
      return null;
    }

    if (failed >= partial && failed >= successful) {
      return 'FAILURE';
    }

    if (partial >= successful) {
      return 'PARTIAL_SUCCESS';
    }

    return 'SUCCESS';
  }

  private calendarDominantCount(
    indicator: ResultIndicator | null,
    counts: Omit<CalendarDay, 'key' | 'date' | 'title'>,
  ): number {
    switch (indicator) {
      case 'SUCCESS':
        return counts.successful;
      case 'PARTIAL_SUCCESS':
        return counts.partial;
      case 'FAILURE':
        return counts.failed;
      default:
        return 0;
    }
  }

  private calendarIntensity(count: number): number {
    if (count <= 0) {
      return 0;
    }

    if (count === 1) {
      return 1;
    }

    if (count <= 3) {
      return 2;
    }

    if (count <= 6) {
      return 3;
    }

    return 4;
  }

  private calendarMonths(weeks: CalendarWeek[]): CalendarMonth[] {
    const months: CalendarMonth[] = [];

    for (const week of weeks) {
      const anchorDay = week.days.find((day) => day.date.getDate() <= 7) ?? week.days[0];
      const key = `${anchorDay.date.getFullYear()}-${anchorDay.date.getMonth()}`;
      const currentMonth = months[months.length - 1];

      if (currentMonth?.key === key) {
        currentMonth.span++;
        continue;
      }

      months.push({
        key,
        label: this.monthLabel(anchorDay.date),
        span: 1,
      });
    }

    return months;
  }

  private calendarDayTitle(
    date: Date,
    counts: Omit<CalendarDay, 'key' | 'date' | 'title'>,
  ): string {
    if (counts.total === 0) {
      return `${this.calendarDateLabel(date)}: no runs`;
    }

    return (
      `${this.calendarDateLabel(date)}: ${counts.total} run${counts.total === 1 ? '' : 's'}` +
      `, ${counts.successful} successful` +
      `, ${counts.partial} partial` +
      `, ${counts.failed} failed`
    );
  }

  private calendarDateLabel(date: Date): string {
    return this.calendarDateFormat.format(date);
  }

  private monthLabel(date: Date): string {
    return this.calendarMonthFormat.format(date);
  }

  private dayKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private startOfWeek(date: Date): Date {
    const dayOffset = (date.getDay() + 6) % 7;
    return this.addDays(this.startOfDay(date), -dayOffset);
  }

  private endOfWeek(date: Date): Date {
    return this.addDays(this.startOfWeek(date), 6);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
