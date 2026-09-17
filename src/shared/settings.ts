export type WeekStartsOn = Weekday;
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Theme = "system" | "light" | "dark";
export type MenuBarIconStyle = "filled" | "framed" | "calendar" | "none";
/** Look-ahead lengths, counted in whole local days through midnight. */
export const UPCOMING_HORIZON_DAYS = [1, 2, 3, 4, 5, 6, 7, 14, 30] as const;
export type UpcomingHorizonDays = (typeof UPCOMING_HORIZON_DAYS)[number];

/** Hour look-aheads written before the day-based window. */
export const ONE_DAY_HORIZON_HOURS = 24;
export const TWO_DAYS_HORIZON_HOURS = 48;

/** 0 means the events item follows the upcoming list window. */
export const ICON_LEAD_ALWAYS = 0;
/** 1 is a sentinel: hold the events item back until the event starts. */
export const ICON_LEAD_AT_START = 1;
export const UPCOMING_ICON_LEAD_MINUTES = [
  ICON_LEAD_AT_START, 15, 30, 60, 240, 480, 720, 1440, ICON_LEAD_ALWAYS,
] as const;
export type UpcomingIconLeadMinutes = (typeof UPCOMING_ICON_LEAD_MINUTES)[number];

/** Leads that no longer exist, mapped to the nearest one that does. */
const RETIRED_ICON_LEADS: Record<number, UpcomingIconLeadMinutes> = {
  10: 15,
  120: 60,
};

export function upcomingHorizonLabel(days: UpcomingHorizonDays): string {
  if (days === 1) return "Today";
  if (days === 2) return "Today and tomorrow";
  if (days === 7) return "1 week";
  if (days === 14) return "2 weeks";
  if (days === 30) return "1 month";
  return `${days} days`;
}

export function upcomingIconLeadLabel(minutes: UpcomingIconLeadMinutes): string {
  if (minutes === ICON_LEAD_ALWAYS) return "Always show";
  if (minutes === ICON_LEAD_AT_START) return "At start of event";
  if (minutes < 60) return `${minutes} minutes before`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour before" : `${hours} hours before`;
}

export type AppSettings = {
  menuBarIcon: MenuBarIconStyle;
  showWeekday: boolean;
  showMonth: boolean;
  weekStartsOn: WeekStartsOn;
  showWeekNumbers: boolean;
  highlightWeekdays: Weekday[];
  launchAtLogin: boolean;
  beepOnTheHour: boolean;
  showUpcomingEvent: boolean;
  /** Days of look-ahead for the popover list, counted through local midnight. */
  upcomingHorizonDays: UpcomingHorizonDays;
  /**
   * Minutes before start to show the events item. 0 follows the list window,
   * 1 holds it back until the event starts.
   */
  upcomingIconLeadMinutes: UpcomingIconLeadMinutes;
  /** All-day events and reminders in the list and on the events item. */
  includeAllDayEvents: boolean;
  /** Solo blocks: events nobody else was invited to. */
  includeEventsWithoutParticipants: boolean;
  /** Events with neither a meeting link nor a place. */
  includeEventsWithoutLocation: boolean;
  /** Event name beside the countdown glyph. */
  showEventTitleInMenuBar: boolean;
  /** Start time, or the time left, beside the countdown glyph. */
  showEventTimeInMenuBar: boolean;
  /** System-wide chord that toggles the month popover. Empty is unset. */
  toggleCalendarShortcut: string;
  /** System-wide chord that opens the previewed meeting link. Empty is unset. */
  joinMeetingShortcut: string;
  /** EventKit identifiers the upcoming-event list should ignore. Empty shows every calendar. */
  hiddenCalendarIds: string[];
  autoUpdate: boolean;
  theme: Theme;
};

export type CalendarKind = "event" | "reminder";

export type CalendarInfo = {
  id: string;
  title: string;
  source: string | null;
  color: string | null;
  kind?: CalendarKind;
};

export type MenuBarPart = "weekday" | "day" | "month";

export const MENU_BAR_ICONS: { id: MenuBarIconStyle; label: string }[] = [
  { id: "filled", label: "Calendar with date" },
  { id: "calendar", label: "Dotted calendar" },
  { id: "framed", label: "Cutout date" },
  { id: "none", label: "Date only" },
];

const PART_OPTIONS: Record<MenuBarPart, Intl.DateTimeFormatOptions> = {
  weekday: { weekday: "short" },
  day: { day: "numeric" },
  month: { month: "short" },
};

/** Styles that no longer exist, mapped to the nearest one that does. */
const RETIRED_ICONS: Record<string, MenuBarIconStyle> = {
  outline: "framed",
};

/**
 * Formats persisted before icon style and weekday/month toggles. Mapped to the
 * nearest equivalent so an existing settings file is not silently reset.
 */
const LEGACY_FORMATS: Record<
  string,
  Pick<AppSettings, "menuBarIcon" | "showWeekday" | "showMonth">
> = {
  iconOnly: { menuBarIcon: "filled", showWeekday: false, showMonth: false },
  iconDay: { menuBarIcon: "filled", showWeekday: false, showMonth: false },
  iconWeekdayDay: { menuBarIcon: "filled", showWeekday: true, showMonth: false },
  iconWeekdayDayMonth: { menuBarIcon: "filled", showWeekday: true, showMonth: true },
  dateOnly: { menuBarIcon: "none", showWeekday: true, showMonth: false },
  weekdayDay: { menuBarIcon: "filled", showWeekday: true, showMonth: false },
  monthDay: { menuBarIcon: "filled", showWeekday: false, showMonth: true },
  weekdayMonthDay: { menuBarIcon: "filled", showWeekday: true, showMonth: true },
  day: { menuBarIcon: "filled", showWeekday: false, showMonth: false },
  weekday: { menuBarIcon: "filled", showWeekday: true, showMonth: false },
  full: { menuBarIcon: "filled", showWeekday: true, showMonth: true },
};

export const WEEK_STARTS: { id: WeekStartsOn; label: string }[] = [
  { id: 0, label: "Sunday" },
  { id: 1, label: "Monday" },
  { id: 2, label: "Tuesday" },
  { id: 3, label: "Wednesday" },
  { id: 4, label: "Thursday" },
  { id: 5, label: "Friday" },
  { id: 6, label: "Saturday" },
];

/** Monday → Sunday, matching the Highlight picker. */
export const HIGHLIGHT_DAYS: { id: Weekday; name: string }[] = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
  { id: 0, name: "Sunday" },
];

export const DEFAULT_HIGHLIGHT_WEEKDAYS: Weekday[] = [0, 6];

export const DEFAULT_SETTINGS: AppSettings = {
  menuBarIcon: "filled",
  showWeekday: true,
  showMonth: false,
  weekStartsOn: 0,
  showWeekNumbers: false,
  highlightWeekdays: [...DEFAULT_HIGHLIGHT_WEEKDAYS],
  launchAtLogin: false,
  beepOnTheHour: false,
  showUpcomingEvent: false,
  upcomingHorizonDays: 1,
  upcomingIconLeadMinutes: ICON_LEAD_ALWAYS,
  includeAllDayEvents: false,
  includeEventsWithoutParticipants: true,
  includeEventsWithoutLocation: true,
  showEventTitleInMenuBar: false,
  showEventTimeInMenuBar: false,
  toggleCalendarShortcut: "Control+Command+K",
  joinMeetingShortcut: "",
  hiddenCalendarIds: [],
  autoUpdate: true,
  theme: "system",
};

const ICON_IDS = new Set(MENU_BAR_ICONS.map((item) => item.id));
const WEEK_START_IDS = new Set(WEEK_STARTS.map((item) => item.id));
const THEMES = new Set<Theme>(["system", "light", "dark"]);
const HORIZON_DAYS = new Set<number>(UPCOMING_HORIZON_DAYS);
const ICON_LEAD_MINUTES = new Set<number>(UPCOMING_ICON_LEAD_MINUTES);

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isWeekday(value: unknown): value is Weekday {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;
}

export function weekdayLetter(id: Weekday, locale?: string): string {
  // 5 January 2020 is a Sunday, so adding `id` lands on that weekday.
  return new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(
    new Date(2020, 0, 5 + id, 12),
  );
}
export function normalizeHighlightWeekdays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [...DEFAULT_HIGHLIGHT_WEEKDAYS];
  return [...new Set(value.filter(isWeekday))].sort((a, b) => a - b);
}

export function normalizeHiddenCalendarIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((item): item is string => typeof item === "string" && item.length > 0),
    ),
  ].sort();
}

export function calendarIsVisible(
  calendarId: string | null | undefined,
  hidden: readonly string[],
): boolean {
  if (!calendarId) return true;
  return !hidden.includes(calendarId);
}

export function calendarsOfKind(
  calendars: readonly CalendarInfo[],
  kind: CalendarKind,
): CalendarInfo[] {
  return calendars.filter((calendar) => (calendar.kind ?? "event") === kind);
}

/** Adjacent calendars from the same account, titles A–Z inside each group. */
export function groupCalendarsBySource(
  calendars: readonly CalendarInfo[],
): { source: string; calendars: CalendarInfo[] }[] {
  const groups = new Map<string, CalendarInfo[]>();
  for (const calendar of [...calendars].sort((a, b) =>
    a.title.localeCompare(b.title, "en", { sensitivity: "base" }),
  )) {
    const source = calendar.source?.trim() || "Other";
    const list = groups.get(source) ?? [];
    list.push(calendar);
    groups.set(source, list);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en", { sensitivity: "base" }))
    .map(([source, items]) => ({ source, calendars: items }));
}

/**
 * Adjacent highlighted columns, in the displayed week order. Saturday and
 * Sunday become one band when they sit next to each other.
 */
export function highlightedColumnRuns(
  weekStartsOn: WeekStartsOn,
  highlighted: readonly number[],
): { start: number; count: number }[] {
  const selected = new Set(highlighted);
  const active = Array.from({ length: 7 }, (_, index) =>
    selected.has((weekStartsOn + index) % 7),
  );
  const runs: { start: number; count: number }[] = [];
  for (let index = 0; index < 7; ) {
    if (!active[index]) {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < 7 && active[end]) end += 1;
    runs.push({ start: index, count: end - index });
    index = end;
  }
  return runs;
}

export function datedMenuBarIcon(style: MenuBarIconStyle): boolean {
  return style === "filled";
}

export function supportsDateParts(style: MenuBarIconStyle): boolean {
  return style === "framed" || style === "none";
}

export type MenuBarLabel = {
  /**
   * The date beside the clock. Null for the filled glyph, which carries the
   * date on its own. The dotted calendar also has no text. The framed style
   * cuts this text out of a filled background; the
   * date-only style shows it as plain text.
   */
  text: string | null;
  /** Day of the month when the glyph itself shows the date. */
  day: number | null;
  style: MenuBarIconStyle;
};

function formatPart(part: MenuBarPart, date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, PART_OPTIONS[part]).format(date);
}

/**
 * Calendar glyphs stand alone. Cutout and plain-text styles spell the date out.
 */
export function menuBarLabel(
  settings: Pick<AppSettings, "menuBarIcon" | "showWeekday" | "showMonth">,
  date: Date,
  locale?: string,
): MenuBarLabel {
  if (datedMenuBarIcon(settings.menuBarIcon)) {
    return { text: null, day: date.getDate(), style: settings.menuBarIcon };
  }
  if (!supportsDateParts(settings.menuBarIcon)) {
    return { text: null, day: null, style: settings.menuBarIcon };
  }
  const parts: string[] = [];
  if (settings.showWeekday) parts.push(formatPart("weekday", date, locale));
  parts.push(formatPart("day", date, locale));
  if (settings.showMonth) parts.push(formatPart("month", date, locale));
  return {
    text: parts.join(" "),
    day: null,
    style: settings.menuBarIcon,
  };
}

export function formatMenuBarDate(
  settings: Pick<AppSettings, "menuBarIcon" | "showWeekday" | "showMonth">,
  date: Date,
  locale?: string,
): string {
  return menuBarLabel(settings, date, locale).text ?? "";
}

/** Enough of the label to know the menu bar must be redrawn. */
export function trayLabelKey(label: MenuBarLabel): string {
  return `${label.text ?? ""}|${label.day ?? ""}|${label.style}`;
}

function migrateMenuBar(
  input: Record<string, unknown>,
): Pick<AppSettings, "menuBarIcon" | "showWeekday" | "showMonth"> {
  const storedIcon =
    typeof input.menuBarIcon === "string"
      ? RETIRED_ICONS[input.menuBarIcon] ?? input.menuBarIcon
      : input.menuBarIcon;
  if (ICON_IDS.has(storedIcon as MenuBarIconStyle)) {
    return {
      menuBarIcon: storedIcon as MenuBarIconStyle,
      showWeekday: asBoolean(input.showWeekday, DEFAULT_SETTINGS.showWeekday),
      showMonth: asBoolean(input.showMonth, DEFAULT_SETTINGS.showMonth),
    };
  }
  const storedFormat =
    typeof input.menuBarFormat === "string" ? input.menuBarFormat : "";
  return LEGACY_FORMATS[storedFormat] ?? {
    menuBarIcon: DEFAULT_SETTINGS.menuBarIcon,
    showWeekday: DEFAULT_SETTINGS.showWeekday,
    showMonth: DEFAULT_SETTINGS.showMonth,
  };
}

/**
 * Day windows replaced the 24 / 48 hour look-ahead. Older files carry the
 * hours, which stood for the same two windows.
 */
function normalizeHorizonDays(input: Record<string, unknown>): UpcomingHorizonDays {
  const days = input.upcomingHorizonDays;
  if (HORIZON_DAYS.has(days as number)) return days as UpcomingHorizonDays;
  const hours = input.upcomingHorizonHours;
  if (hours === TWO_DAYS_HORIZON_HOURS) return 2;
  if (hours === ONE_DAY_HORIZON_HOURS) return 1;
  return DEFAULT_SETTINGS.upcomingHorizonDays;
}

function normalizeIconLead(value: unknown): UpcomingIconLeadMinutes {
  if (ICON_LEAD_MINUTES.has(value as number)) return value as UpcomingIconLeadMinutes;
  const retired = RETIRED_ICON_LEADS[value as number];
  return retired ?? DEFAULT_SETTINGS.upcomingIconLeadMinutes;
}

/** A recorded chord, or the fallback when the file holds something else. */
function normalizeShortcut(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback;
}

export function normalizeSettings(raw: unknown): AppSettings {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const weekStartsOn = input.weekStartsOn;
  const theme = input.theme;
  const menuBar = migrateMenuBar(input);

  return {
    ...menuBar,
    weekStartsOn: WEEK_START_IDS.has(weekStartsOn as WeekStartsOn)
      ? (weekStartsOn as WeekStartsOn)
      : DEFAULT_SETTINGS.weekStartsOn,
    showWeekNumbers: asBoolean(
      input.showWeekNumbers,
      DEFAULT_SETTINGS.showWeekNumbers,
    ),
    highlightWeekdays:
      "highlightWeekdays" in input
        ? normalizeHighlightWeekdays(input.highlightWeekdays)
        : input.dimWeekends === false
          ? []
          : [...DEFAULT_HIGHLIGHT_WEEKDAYS],
    launchAtLogin: asBoolean(
      input.launchAtLogin,
      DEFAULT_SETTINGS.launchAtLogin,
    ),
    beepOnTheHour: asBoolean(input.beepOnTheHour, DEFAULT_SETTINGS.beepOnTheHour),
    showUpcomingEvent: asBoolean(
      input.showUpcomingEvent,
      DEFAULT_SETTINGS.showUpcomingEvent,
    ),
    upcomingHorizonDays: normalizeHorizonDays(input),
    upcomingIconLeadMinutes: normalizeIconLead(input.upcomingIconLeadMinutes),
    includeAllDayEvents: asBoolean(
      input.includeAllDayEvents,
      DEFAULT_SETTINGS.includeAllDayEvents,
    ),
    includeEventsWithoutParticipants: asBoolean(
      input.includeEventsWithoutParticipants,
      DEFAULT_SETTINGS.includeEventsWithoutParticipants,
    ),
    includeEventsWithoutLocation: asBoolean(
      input.includeEventsWithoutLocation,
      DEFAULT_SETTINGS.includeEventsWithoutLocation,
    ),
    showEventTitleInMenuBar: asBoolean(
      input.showEventTitleInMenuBar,
      DEFAULT_SETTINGS.showEventTitleInMenuBar,
    ),
    showEventTimeInMenuBar: asBoolean(
      input.showEventTimeInMenuBar,
      DEFAULT_SETTINGS.showEventTimeInMenuBar,
    ),
    toggleCalendarShortcut: normalizeShortcut(
      input.toggleCalendarShortcut,
      DEFAULT_SETTINGS.toggleCalendarShortcut,
    ),
    joinMeetingShortcut: normalizeShortcut(
      input.joinMeetingShortcut,
      DEFAULT_SETTINGS.joinMeetingShortcut,
    ),
    hiddenCalendarIds:
      "hiddenCalendarIds" in input
        ? normalizeHiddenCalendarIds(input.hiddenCalendarIds)
        : [...DEFAULT_SETTINGS.hiddenCalendarIds],
    autoUpdate: asBoolean(input.autoUpdate, DEFAULT_SETTINGS.autoUpdate),
    theme: THEMES.has(theme as Theme) ? (theme as Theme) : DEFAULT_SETTINGS.theme,
  };
}
