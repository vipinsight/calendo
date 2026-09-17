import { describe, expect, it } from "vitest";
import {
  endOfTomorrow,
  eventInIconLead,
  eventInUpcomingHorizon,
  eventPassesFilters,
  eventQualifiesForIcon,
  eventStatus,
  eventTimeRange,
  trayEventText,
  trayIconEvent,
  upcomingFetchEnd,
  upcomingHorizonEmpty,
  upcomingHorizonEnd,
  visibleUpcomingEvents,
  type EventFilters,
  type UpcomingEvent,
} from "../src/shared/events";
import { ICON_LEAD_ALWAYS, ICON_LEAD_AT_START } from "../src/shared/settings";

const event: UpcomingEvent = {
  id: "event-1",
  title: "Design sync",
  startAt: Date.UTC(2026, 8, 9, 10, 30),
  endAt: Date.UTC(2026, 8, 9, 11, 0),
  calendar: "Work",
  location: null,
  joinUrl: null,
  response: "accepted",
  kind: "event",
  allDay: false,
  hasParticipants: true,
};

/** Every include switch on, so a test says which one it is exercising. */
const included: EventFilters = {
  includeAllDayEvents: true,
  includeEventsWithoutParticipants: true,
  includeEventsWithoutLocation: true,
};

describe("event status", () => {
  it("counts down to an upcoming event", () => {
    expect(eventStatus(event, Date.UTC(2026, 8, 9, 10, 0)).label).toBe("in 30m");
  });

  it("reads as now for the first ten minutes in progress", () => {
    expect(eventStatus(event, Date.UTC(2026, 8, 9, 10, 30)).label).toBe("now");
    expect(eventStatus(event, Date.UTC(2026, 8, 9, 10, 39, 59)).label).toBe("now");
    expect(eventStatus(event, Date.UTC(2026, 8, 9, 10, 30)).timing).toBe("ongoing");
  });

  it("counts down an event in progress", () => {
    expect(eventStatus(event, Date.UTC(2026, 8, 9, 10, 40)).label).toBe("20m left");
    expect(eventStatus(event, Date.UTC(2026, 8, 9, 10, 56)).label).toBe("4m left");
  });

  it("keeps short durations readable", () => {
    expect(eventStatus(event, Date.UTC(2026, 8, 9, 10, 29, 59)).label).toBe("in 1m");
  });

  it("uses hours for longer countdowns", () => {
    expect(eventStatus(event, Date.UTC(2026, 8, 9, 8, 7)).label).toBe("in 2h 23m");
  });
});

describe("event time range", () => {
  it("formats a compact local time range", () => {
    expect(eventTimeRange(event, "en-US")).toMatch(/\d+:\d{2}.*\d+:\d{2}/);
  });
});

describe("today and tomorrow window", () => {
  it("ends at the local midnight that closes tomorrow", () => {
    const boundary = new Date(endOfTomorrow(new Date(2026, 8, 9, 23, 30)));
    expect(boundary.getFullYear()).toBe(2026);
    expect(boundary.getMonth()).toBe(8);
    expect(boundary.getDate()).toBe(11);
    expect(boundary.getHours()).toBe(0);
    expect(boundary.getMinutes()).toBe(0);
  });

  it("covers the rest of today from early morning", () => {
    const now = new Date(2026, 8, 9, 0, 5);
    expect(endOfTomorrow(now) - now.getTime()).toBeGreaterThan(47 * 3_600_000);
  });

  it("crosses a month boundary", () => {
    const boundary = new Date(endOfTomorrow(new Date(2026, 8, 30, 18, 0)));
    expect(boundary.getMonth()).toBe(9);
    expect(boundary.getDate()).toBe(2);
  });
});

describe("upcoming look-ahead", () => {
  const now = new Date(2026, 8, 9, 10, 0).getTime();
  const today = {
    ...event,
    startAt: new Date(2026, 8, 9, 16, 0).getTime(),
    endAt: new Date(2026, 8, 9, 17, 0).getTime(),
  };
  const inFourDays = {
    ...event,
    id: "event-4d",
    startAt: new Date(2026, 8, 13, 9, 0).getTime(),
    endAt: new Date(2026, 8, 13, 10, 0).getTime(),
  };

  it("keeps an event later the same day", () => {
    expect(eventInUpcomingHorizon(today, now, 1)).toBe(true);
  });

  it("keeps a meeting that has already started", () => {
    expect(
      eventInUpcomingHorizon(today, new Date(2026, 8, 9, 16, 40).getTime(), 1),
    ).toBe(true);
  });

  it("drops an event beyond the window and keeps it once the window grows", () => {
    expect(eventInUpcomingHorizon(inFourDays, now, 2)).toBe(false);
    expect(eventInUpcomingHorizon(inFourDays, now, 5)).toBe(true);
  });

  it("drops an event that has already ended", () => {
    expect(
      eventInUpcomingHorizon(today, new Date(2026, 8, 9, 18, 0).getTime(), 7),
    ).toBe(false);
  });

  it("names the empty list from the window", () => {
    expect(upcomingHorizonEmpty(1)).toBe("Nothing in the rest of today.");
    expect(upcomingHorizonEmpty(2)).toBe("Nothing in the next two days.");
    expect(upcomingHorizonEmpty(4)).toBe("Nothing in the next 4 days.");
    expect(upcomingHorizonEmpty(7)).toBe("Nothing in the next week.");
    expect(upcomingHorizonEmpty(14)).toBe("Nothing in the next two weeks.");
    expect(upcomingHorizonEmpty(30)).toBe("Nothing in the next month.");
  });

  it("treats one day as through midnight tonight", () => {
    const late = new Date(2026, 8, 9, 22, 0).getTime();
    const boundary = new Date(upcomingHorizonEnd(late, 1));
    expect(boundary.getFullYear()).toBe(2026);
    expect(boundary.getMonth()).toBe(8);
    expect(boundary.getDate()).toBe(10);
    expect(boundary.getHours()).toBe(0);
  });

  it("treats two days as through the end of tomorrow, not 48 clock hours", () => {
    const late = new Date(2026, 8, 9, 22, 0).getTime();
    const end = upcomingHorizonEnd(late, 2);
    const boundary = new Date(end);
    expect(boundary.getDate()).toBe(11);
    expect(boundary.getHours()).toBe(0);
    expect(end - late).toBeLessThan(48 * 3_600_000);
  });

  it("runs a month of look-ahead through the thirtieth local midnight", () => {
    const boundary = new Date(upcomingHorizonEnd(now, 30));
    expect(boundary.getMonth()).toBe(9);
    expect(boundary.getDate()).toBe(9);
    expect(boundary.getHours()).toBe(0);
  });

  it("keeps an all-day reminder on its due day", () => {
    const reminder = {
      ...event,
      kind: "reminder" as const,
      allDay: true,
      startAt: new Date(2026, 8, 9, 0, 0).getTime(),
      endAt: new Date(2026, 8, 10, 0, 0).getTime(),
    };
    expect(
      eventInUpcomingHorizon(reminder, new Date(2026, 8, 9, 15, 0).getTime(), 2),
    ).toBe(true);
    expect(eventTimeRange(reminder, "en-US")).toBe("All day");
  });

  it("fetches far enough ahead for the window or the lead, whichever is longer", () => {
    expect(upcomingFetchEnd(now, 1, ICON_LEAD_ALWAYS)).toBe(upcomingHorizonEnd(now, 1));
    expect(upcomingFetchEnd(now, 1, 1440)).toBe(now + 1440 * 60_000);
    expect(upcomingFetchEnd(now, 30, 1440)).toBe(upcomingHorizonEnd(now, 30));
    // The at-start sentinel is a marker, not a minute count.
    expect(upcomingFetchEnd(now, 1, ICON_LEAD_AT_START)).toBe(
      upcomingHorizonEnd(now, 1),
    );
  });
});

describe("include filters", () => {
  const now = new Date(2026, 8, 9, 10, 0).getTime();
  const solo = { ...event, id: "solo", hasParticipants: false };
  const birthday = { ...event, id: "birthday", allDay: true };
  const placeless = { ...event, id: "placeless", location: null, joinUrl: null };
  const zoom = { ...event, id: "zoom", joinUrl: "https://zoom.us/j/1" };

  it("never lets a declined invitation through", () => {
    const declined = { ...event, response: "declined" as const };
    expect(eventPassesFilters(declined, included)).toBe(false);
  });

  it("hides all-day items unless they are included", () => {
    expect(eventPassesFilters(birthday, included)).toBe(true);
    expect(
      eventPassesFilters(birthday, { ...included, includeAllDayEvents: false }),
    ).toBe(false);
    expect(
      eventPassesFilters(event, { ...included, includeAllDayEvents: false }),
    ).toBe(true);
  });

  it("hides a solo block when participants are required", () => {
    const filters = { ...included, includeEventsWithoutParticipants: false };
    expect(eventPassesFilters(solo, filters)).toBe(false);
    expect(eventPassesFilters(event, filters)).toBe(true);
  });

  it("hides an item with neither a link nor a place", () => {
    const filters = { ...included, includeEventsWithoutLocation: false };
    expect(eventPassesFilters(placeless, filters)).toBe(false);
    expect(eventPassesFilters(zoom, filters)).toBe(true);
    expect(
      eventPassesFilters({ ...placeless, location: "Room 2" }, filters),
    ).toBe(true);
  });

  it("keeps the popover list to events inside the window and past the filters", () => {
    const soon = {
      ...solo,
      startAt: new Date(2026, 8, 9, 11, 0).getTime(),
      endAt: new Date(2026, 8, 9, 11, 30).getTime(),
    };
    const list = visibleUpcomingEvents([soon, zoom], now, 1, {
      ...included,
      includeEventsWithoutParticipants: false,
    });
    expect(list).toEqual([zoom]);
  });

  it("filters the menu bar candidate before the lead is considered", () => {
    const filters = { ...included, includeAllDayEvents: false };
    const birthdayNow = {
      ...birthday,
      startAt: new Date(2026, 8, 9, 0, 0).getTime(),
      endAt: new Date(2026, 8, 10, 0, 0).getTime(),
    };
    expect(
      trayIconEvent([birthdayNow, zoom], now, {
        upcomingHorizonDays: 1,
        upcomingIconLeadMinutes: ICON_LEAD_ALWAYS,
        filters,
      }),
    ).toBe(zoom);
  });
});

describe("events icon lead", () => {
  const now = Date.UTC(2026, 8, 9, 10, 0);
  const later = {
    ...event,
    id: "event-2",
    title: "Wrap-up",
    startAt: Date.UTC(2026, 8, 9, 10, 20),
    endAt: Date.UTC(2026, 8, 9, 10, 50),
  };

  it("hides a meeting two hours out when the icon waits 15 minutes", () => {
    expect(eventInIconLead(event, Date.UTC(2026, 8, 9, 8, 30), 15)).toBe(false);
    expect(eventQualifiesForIcon(event, Date.UTC(2026, 8, 9, 8, 30), 1, 15)).toBe(false);
  });

  it("shows the icon 15 minutes before, through the meeting, then hides it", () => {
    expect(eventInIconLead(event, Date.UTC(2026, 8, 9, 10, 15), 15)).toBe(true);
    expect(eventInIconLead(event, Date.UTC(2026, 8, 9, 10, 40), 15)).toBe(true);
    expect(eventInIconLead(event, Date.UTC(2026, 8, 9, 11, 0), 15)).toBe(false);
  });

  it("waits four hours out and shows the item once the lead is reached", () => {
    expect(eventQualifiesForIcon(event, Date.UTC(2026, 8, 9, 4, 30), 1, 240)).toBe(false);
    expect(eventQualifiesForIcon(event, Date.UTC(2026, 8, 9, 6, 30), 1, 240)).toBe(true);
    // Once it is running the item stays until the event ends.
    expect(eventQualifiesForIcon(event, Date.UTC(2026, 8, 9, 10, 45), 1, 240)).toBe(true);
    expect(eventQualifiesForIcon(event, Date.UTC(2026, 8, 9, 11, 0), 1, 240)).toBe(false);
  });

  it("holds the item back until the event starts on the at-start sentinel", () => {
    const lead = ICON_LEAD_AT_START;
    expect(eventQualifiesForIcon(event, Date.UTC(2026, 8, 9, 10, 29), 1, lead)).toBe(false);
    expect(eventQualifiesForIcon(event, Date.UTC(2026, 8, 9, 10, 30), 1, lead)).toBe(true);
    expect(eventQualifiesForIcon(event, Date.UTC(2026, 8, 9, 10, 59), 1, lead)).toBe(true);
    expect(eventQualifiesForIcon(event, Date.UTC(2026, 8, 9, 11, 0), 1, lead)).toBe(false);
  });

  it("still shows anything in the list window when the icon is always on", () => {
    const today = {
      ...event,
      startAt: new Date(2026, 8, 9, 16, 0).getTime(),
      endAt: new Date(2026, 8, 9, 17, 0).getTime(),
    };
    const local = new Date(2026, 8, 9, 8, 30).getTime();
    expect(eventQualifiesForIcon(today, local, 1, ICON_LEAD_ALWAYS)).toBe(true);
    const tomorrow = {
      ...today,
      startAt: new Date(2026, 8, 10, 16, 0).getTime(),
      endAt: new Date(2026, 8, 10, 17, 0).getTime(),
    };
    expect(eventQualifiesForIcon(tomorrow, local, 1, ICON_LEAD_ALWAYS)).toBe(false);
    expect(eventQualifiesForIcon(tomorrow, local, 2, ICON_LEAD_ALWAYS)).toBe(true);
  });

  it("counts all-day reminders on the icon like timed events", () => {
    const reminder = {
      ...event,
      kind: "reminder" as const,
      allDay: true,
      startAt: Date.UTC(2026, 8, 9, 0, 0),
      endAt: Date.UTC(2026, 8, 9, 23, 0),
    };
    expect(eventQualifiesForIcon(reminder, now, 1, ICON_LEAD_ALWAYS)).toBe(true);
    expect(eventQualifiesForIcon(reminder, Date.UTC(2026, 8, 8, 10, 0), 1, 15)).toBe(false);
    expect(
      trayIconEvent([reminder, event], now, {
        upcomingHorizonDays: 1,
        upcomingIconLeadMinutes: ICON_LEAD_ALWAYS,
        filters: included,
      }),
    ).toBe(reminder);
  });

  it("counts down the next qualifying event after one is dismissed", () => {
    expect(
      trayIconEvent([event, later], now, {
        upcomingHorizonDays: 1,
        upcomingIconLeadMinutes: 30,
        filters: included,
      }),
    ).toBe(event);
    expect(
      trayIconEvent([event, later], now, {
        upcomingHorizonDays: 1,
        upcomingIconLeadMinutes: 30,
        filters: included,
        dismissed: [{ id: event.id, endAt: event.endAt }],
      }),
    ).toBe(later);
  });

  it("leaves the list window alone when the icon uses a shorter lead", () => {
    const far = {
      ...event,
      startAt: Date.UTC(2026, 8, 9, 12, 0),
      endAt: Date.UTC(2026, 8, 9, 12, 30),
    };
    expect(eventInUpcomingHorizon(far, now, 2)).toBe(true);
    expect(eventQualifiesForIcon(far, now, 2, 15)).toBe(false);
  });
});

describe("menu bar preview text", () => {
  // Local times, so the expected label does not move with the test machine.
  const standup = {
    ...event,
    title: "Design sync",
    startAt: new Date(2026, 8, 9, 15, 0).getTime(),
    endAt: new Date(2026, 8, 9, 16, 0).getTime(),
  };
  const before = standup.startAt - 600_000;

  it("keeps the item glyph-only when both switches are off", () => {
    expect(
      trayEventText(standup, before, { showTitle: false, showTime: false }),
    ).toBeNull();
  });

  it("shows the start time, then the title", () => {
    const text = trayEventText(
      standup,
      before,
      { showTitle: true, showTime: true },
      "en-US",
    );
    expect(text).toBe("3:00 PM  Design sync");
  });

  it("reads as now while the event is running", () => {
    expect(
      trayEventText(standup, standup.startAt, { showTitle: false, showTime: true }, "en-US"),
    ).toBe("now");
    expect(
      trayEventText(
        standup,
        standup.startAt + 15 * 60_000,
        { showTitle: false, showTime: true },
        "en-US",
      ),
    ).toBe("45m left");
  });

  it("shortens a title that would eat the menu bar", () => {
    const long = { ...standup, title: "Quarterly planning and roadmap review" };
    const text = trayEventText(long, before, { showTitle: true, showTime: false });
    expect(text).toBe("Quarterly planning and…");
    expect(text?.length).toBeLessThanOrEqual(24);
  });
});
