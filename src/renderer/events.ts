import {
  eventStatus,
  trayIconEvent,
  upcomingFetchEnd,
  upcomingHorizonEmpty,
  visibleUpcomingEvents,
  type EventFilters,
  type EventResponse,
  type UpcomingEvent,
} from "../shared/events";
import { installTauriBridge } from "./host";
import { lucideIcon } from "./icons";
import { meetingBrand } from "../shared/meetings";
import { meetingIcon } from "./brand-icons";
import { markPopoverMaterial, popoverHeight } from "./popover-size";
import { EyeOff, MapPin } from "lucide";
import { DEFAULT_SETTINGS, type AppSettings } from "../shared/settings";

const api = installTauriBridge();
const list = document.getElementById("list")!;
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") void api.hideEvents();
});
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function dayLabel(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const iso = (value: Date) => value.toDateString();
  if (iso(date) === iso(today)) return "Today";
  if (iso(date) === iso(tomorrow)) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(date);
}

const RESPONSE_LABEL: Record<EventResponse, string> = {
  confirmed: "",
  accepted: "Accepted",
  tentative: "Maybe",
  declined: "Declined",
  pending: "Not responded",
};

function sectionLabel(text: string): HTMLElement {
  const heading = document.createElement("p");
  heading.className = "section-label";
  heading.textContent = text;
  return heading;
}

function openEvent(event: UpcomingEvent): void {
  void api.openEvent(event.id);
  void api.hideEvents();
}

function eventRow(event: UpcomingEvent): HTMLElement {
  const row = document.createElement("div");
  row.className = "event interactive";
  row.setAttribute("role", "button");
  row.addEventListener("click", () => openEvent(event));
  const dot = document.createElement("span");
  dot.className = `dot ${event.response}`;
  const title = document.createElement("span");
  title.className = "title";
  const when = event.allDay ? "All day" : timeFormat.format(new Date(event.startAt));
  title.textContent = `${when} · ${event.title}`;
  const response = RESPONSE_LABEL[event.response];
  row.title = response ? `${title.textContent} — ${response}` : title.textContent;
  row.append(dot, title);
  return row;
}

function detailRow(icon: Element | null, text: string, onClick?: () => void): HTMLElement {
  const row = document.createElement(onClick ? "button" : "div") as HTMLElement;
  row.className = onClick ? "detail-row interactive" : "detail-row muted";
  const glyph = document.createElement("span");
  glyph.className = "glyph";
  if (icon) glyph.append(icon);
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = text;
  row.title = text;
  row.append(glyph, label);
  if (onClick) row.addEventListener("click", onClick);
  return row;
}

function eventDetails(event: UpcomingEvent, includeLocation = false): HTMLElement | null {
  const details = document.createElement("div");
  details.className = "detail";
  if (event.joinUrl) {
    const url = event.joinUrl;
    const { brand, label } = meetingBrand(url);
    details.append(detailRow(meetingIcon(brand, 13), label, () => {
      void api.joinMeeting(url);
      void api.hideEvents();
    }));
  }
  if (includeLocation && event.location && !event.location.startsWith("http")) {
    details.append(detailRow(lucideIcon(MapPin, 15), event.location));
  }
  return details.childElementCount ? details : null;
}

function featuredEvent(
  event: UpcomingEvent,
  now: number,
  onDismiss?: () => void,
): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  const status = eventStatus(event, now);
  const heading = status.timing !== "ongoing"
    ? `Upcoming ${status.label}`
    : status.label === "now"
      ? "Happening now"
      : `Happening now, ${status.label}`;
  nodes.push(sectionLabel(heading));
  const row = eventRow(event);
  row.classList.add("featured");
  nodes.push(row);
  const details = eventDetails(event, true);
  if (details) nodes.push(details);
  if (onDismiss) {
    nodes.push(detailRow(lucideIcon(EyeOff, 15), "Dismiss this event", onDismiss));
  }
  return nodes;
}

function syncHeight(): void {
  const height = popoverHeight(list);
  if (height) void api.setEventsHeight(height);
}

let loadRevision = 0;
let horizonDays = DEFAULT_SETTINGS.upcomingHorizonDays;
let iconLeadMinutes = DEFAULT_SETTINGS.upcomingIconLeadMinutes;
let filters: EventFilters = {
  includeAllDayEvents: DEFAULT_SETTINGS.includeAllDayEvents,
  includeEventsWithoutParticipants: DEFAULT_SETTINGS.includeEventsWithoutParticipants,
  includeEventsWithoutLocation: DEFAULT_SETTINGS.includeEventsWithoutLocation,
};

function filterKey(current: EventFilters): string {
  return [
    current.includeAllDayEvents,
    current.includeEventsWithoutParticipants,
    current.includeEventsWithoutLocation,
  ].join("|");
}

function sameOccurrence(
  left: Pick<UpcomingEvent, "id" | "endAt">,
  right: Pick<UpcomingEvent, "id" | "endAt">,
): boolean {
  return left.id === right.id && left.endAt === right.endAt;
}

async function load(): Promise<void> {
  const revision = ++loadRevision;
  const now = Date.now();
  try {
    const rangeEnd = upcomingFetchEnd(now, horizonDays, iconLeadMinutes);
    const [events, dismissed] = await Promise.all([
      api.getCalendarEvents(now, rangeEnd),
      api.getDismissedEvents().catch(() => []),
    ]);
    if (revision !== loadRevision) return;
    const upcoming = visibleUpcomingEvents(events, now, horizonDays, filters);
    const featured = trayIconEvent(events, now, {
      upcomingHorizonDays: horizonDays,
      upcomingIconLeadMinutes: iconLeadMinutes,
      filters,
      dismissed,
    });
    if (!upcoming.length && !featured) {
      list.innerHTML = `<p class="empty">${upcomingHorizonEmpty(horizonDays)}</p>`;
      syncHeight();
      return;
    }
    const nodes: HTMLElement[] = featured
      ? featuredEvent(featured, now, () => {
          void api.dismissUpcomingEvent(featured.id, featured.endAt).then(() => void load());
        })
      : [];
    let currentDay = "";
    for (const event of upcoming) {
      if (featured && sameOccurrence(event, featured)) continue;
      const date = new Date(event.startAt);
      const key = date.toDateString();
      if (key !== currentDay) {
        currentDay = key;
        nodes.push(sectionLabel(dayLabel(date)));
      }
      nodes.push(eventRow(event));
      const details = eventDetails(event);
      if (details) nodes.push(details);
    }
    list.replaceChildren(...nodes);
    syncHeight();
  } catch (error) {
    if (revision !== loadRevision) return;
    const detail = error instanceof Error ? error.message : String(error);
    const message = document.createElement("p");
    message.className = "empty";
    message.textContent = detail || "Try again shortly.";
    list.replaceChildren(message);
    syncHeight();
  }
}
void markPopoverMaterial(() => api.getPopoverMaterial());
let hiddenCalendarKey = DEFAULT_SETTINGS.hiddenCalendarIds.join("\0");

function applyEventSettings(settings: AppSettings): void {
  const hiddenKey = (settings.hiddenCalendarIds ?? []).join("\0");
  const next: EventFilters = {
    includeAllDayEvents: settings.includeAllDayEvents,
    includeEventsWithoutParticipants: settings.includeEventsWithoutParticipants,
    includeEventsWithoutLocation: settings.includeEventsWithoutLocation,
  };
  const daysChanged = settings.upcomingHorizonDays !== horizonDays;
  const leadChanged = settings.upcomingIconLeadMinutes !== iconLeadMinutes;
  const hiddenChanged = hiddenKey !== hiddenCalendarKey;
  const filtersChanged = filterKey(next) !== filterKey(filters);
  horizonDays = settings.upcomingHorizonDays;
  iconLeadMinutes =
    settings.upcomingIconLeadMinutes ?? DEFAULT_SETTINGS.upcomingIconLeadMinutes;
  filters = next;
  hiddenCalendarKey = hiddenKey;
  if (daysChanged || leadChanged || hiddenChanged || filtersChanged) void load();
}

void api.getSettings().then(applyEventSettings);
api.onSettingsChanged(applyEventSettings);
api.onEventsShown(() => void load());
api.onClockTick(() => void load());
api.onEventDismissed(() => void load());
void load();
