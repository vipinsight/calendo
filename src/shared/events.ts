import { ICON_LEAD_ALWAYS, ICON_LEAD_AT_START, type AppSettings } from "./settings";

/** How the user answered the invitation; "confirmed" means no invitation. */
export type EventResponse =
  | "confirmed"
  | "accepted"
  | "tentative"
  | "declined"
  | "pending";

export type EventKind = "event" | "reminder";

export type UpcomingEvent = {
  id: string;
  title: string;
  startAt: number;
  endAt: number;
  calendar: string | null;
  location: string | null;
  joinUrl: string | null;
  response: EventResponse;
  kind: EventKind;
  allDay: boolean;
  /** Whether anyone else was invited. Reminders and solo blocks are false. */
  hasParticipants: boolean;
};

/** Local midnight that closes the day `days - 1` days after today. */
export function endOfDay(now: number, days: number): number {
  const boundary = new Date(now);
  boundary.setHours(0, 0, 0, 0);
  boundary.setDate(boundary.getDate() + Math.max(1, Math.trunc(days)));
  return boundary.getTime();
}

/** Local midnight that closes today. */
export function endOfToday(now = new Date()): number {
  return endOfDay(now.getTime(), 1);
}

/** Local midnight that ends the "today and tomorrow" window. */
export function endOfTomorrow(now = new Date()): number {
  return endOfDay(now.getTime(), 2);
}

/** When the event-list look-ahead ends. */
export function upcomingHorizonEnd(now: number, days: number): number {
  return endOfDay(now, days);
}

/**
 * Ongoing events stay visible. Future ones only appear when they start
 * within the look-ahead, so a meeting tomorrow night does not occupy the
 * menu bar all day.
 */
export function eventInUpcomingHorizon(
  event: Pick<UpcomingEvent, "startAt" | "endAt">,
  now: number,
  days: number,
): boolean {
  if (event.endAt <= now) return false;
  return event.startAt <= upcomingHorizonEnd(now, days);
}

/** The include-events switches, as the popover and the tray picker read them. */
export type EventFilters = Pick<
  AppSettings,
  | "includeAllDayEvents"
  | "includeEventsWithoutParticipants"
  | "includeEventsWithoutLocation"
>;

export type FilterableEvent = Pick<
  UpcomingEvent,
  "allDay" | "hasParticipants" | "location" | "joinUrl" | "response"
>;

/**
 * Whether an event survives the include filters. Declined invitations are a
 * hard rule rather than a switch: they never reach the list or the menu bar.
 */
export function eventPassesFilters(
  event: FilterableEvent,
  filters: EventFilters,
): boolean {
  if (event.response === "declined") return false;
  if (event.allDay && !filters.includeAllDayEvents) return false;
  if (!event.hasParticipants && !filters.includeEventsWithoutParticipants) {
    return false;
  }
  const placed = Boolean(event.joinUrl) || Boolean(event.location);
  if (!placed && !filters.includeEventsWithoutLocation) return false;
  return true;
}

/** The popover list: inside the window, past the filters, in start order. */
export function visibleUpcomingEvents(
  events: readonly UpcomingEvent[],
  now: number,
  days: number,
  filters: EventFilters,
): UpcomingEvent[] {
  return events.filter(
    (event) =>
      eventInUpcomingHorizon(event, now, days) && eventPassesFilters(event, filters),
  );
}

const MINUTE_MS = 60_000;

/**
 * Timed options show from that lead until the event ends. The at-start
 * sentinel holds the item back until the event is running.
 */
export function eventInIconLead(
  event: Pick<UpcomingEvent, "startAt" | "endAt">,
  now: number,
  minutes: number,
): boolean {
  if (event.endAt <= now) return false;
  if (minutes === ICON_LEAD_AT_START) return event.startAt <= now;
  return event.startAt <= now + minutes * MINUTE_MS;
}

/** How far ahead of now the host must fetch to satisfy the window and lead. */
export function upcomingFetchEnd(
  now: number,
  days: number,
  leadMinutes: number,
): number {
  const lead = leadMinutes > ICON_LEAD_AT_START ? now + leadMinutes * MINUTE_MS : now;
  return Math.max(upcomingHorizonEnd(now, days), lead);
}

export type DismissedOccurrence = {
  id: string;
  endAt: number;
};

export function occurrenceIsDismissed(
  event: Pick<UpcomingEvent, "id" | "endAt">,
  dismissed: readonly DismissedOccurrence[],
  now: number,
): boolean {
  return dismissed.some(
    (item) => item.id === event.id && item.endAt === event.endAt && item.endAt > now,
  );
}

/**
 * Whether the events menu bar icon should count this item down.
 */
export function eventQualifiesForIcon(
  event: Pick<UpcomingEvent, "startAt" | "endAt">,
  now: number,
  days: number,
  leadMinutes: number,
): boolean {
  if (leadMinutes === ICON_LEAD_ALWAYS) return eventInUpcomingHorizon(event, now, days);
  return eventInIconLead(event, now, leadMinutes);
}

/** The include filters decide the candidates; the lead decides when to show. */
export function trayIconEvent(
  events: readonly UpcomingEvent[],
  now: number,
  options: {
    upcomingHorizonDays: number;
    upcomingIconLeadMinutes: number;
    filters: EventFilters;
    dismissed?: readonly DismissedOccurrence[];
  },
): UpcomingEvent | null {
  const dismissed = options.dismissed ?? [];
  for (const event of events) {
    if (!eventPassesFilters(event, options.filters)) continue;
    if (occurrenceIsDismissed(event, dismissed, now)) continue;
    if (
      eventQualifiesForIcon(
        event,
        now,
        options.upcomingHorizonDays,
        options.upcomingIconLeadMinutes,
      )
    ) {
      return event;
    }
  }
  return null;
}

export function upcomingHorizonEmpty(days: number): string {
  if (days === 1) return "Nothing in the rest of today.";
  if (days === 2) return "Nothing in the next two days.";
  if (days === 7) return "Nothing in the next week.";
  if (days === 14) return "Nothing in the next two weeks.";
  if (days === 30) return "Nothing in the next month.";
  return `Nothing in the next ${days} days.`;
}

export type EventTiming = "upcoming" | "ongoing";

function roundedMinutes(milliseconds: number): number {
  return Math.max(1, Math.ceil(milliseconds / 60_000));
}

/** An event that just started reads "now" rather than counting itself down. */
const NOW_WINDOW_MS = 10 * 60_000;

function relativeTime(milliseconds: number): string {
  const minutes = roundedMinutes(milliseconds);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function eventStatus(
  event: Pick<UpcomingEvent, "startAt" | "endAt">,
  now = Date.now(),
): { label: string; timing: EventTiming } {
  if (now >= event.endAt) {
    return {
      label: "No upcoming events",
      timing: "upcoming",
    };
  }
  if (now >= event.startAt && now < event.endAt) {
    if (now - event.startAt < NOW_WINDOW_MS) {
      return { label: "now", timing: "ongoing" };
    }
    return {
      label: `${relativeTime(event.endAt - now)} left`,
      timing: "ongoing",
    };
  }
  return {
    label: `in ${relativeTime(event.startAt - now)}`,
    timing: "upcoming",
  };
}

/** Longest event name the menu bar item carries before it is cut short. */
export const TRAY_TITLE_LIMIT = 24;

export function trayEventTitle(title: string, limit = TRAY_TITLE_LIMIT): string {
  const trimmed = title.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

/** The start time, or how the event reads once it is running. */
export function trayEventTime(
  event: Pick<UpcomingEvent, "startAt" | "endAt" | "allDay">,
  now: number,
  locale?: string,
): string {
  if (now >= event.startAt) return eventStatus(event, now).label;
  if (event.allDay) return "All day";
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.startAt));
}

/**
 * Native text beside the countdown glyph. Time leads, then the name. Null
 * when both switches are off, which keeps today's glyph-only item.
 */
export function trayEventText(
  event: Pick<UpcomingEvent, "startAt" | "endAt" | "allDay" | "title">,
  now: number,
  options: { showTitle: boolean; showTime: boolean },
  locale?: string,
): string | null {
  const parts: string[] = [];
  if (options.showTime) parts.push(trayEventTime(event, now, locale));
  if (options.showTitle) parts.push(trayEventTitle(event.title));
  const text = parts.filter((part) => part.length > 0).join("  ");
  return text.length ? text : null;
}

export function eventTimeRange(
  event: Pick<UpcomingEvent, "startAt" | "endAt" | "allDay">,
  locale?: string,
): string {
  if (event.allDay) return "All day";
  const format = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${format.format(new Date(event.startAt))} – ${format.format(
    new Date(event.endAt),
  )}`;
}
