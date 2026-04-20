"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from "@fullcalendar/core";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { Task } from "@/types/task";
import styles from "./task-calendar-ui.module.css";

interface TaskCalendarViewProps {
  tasks: Task[];
  onView: (task: Task) => void;
}

type EventTone = "red" | "amber" | "blue" | "purple" | "slate";

type CalendarTaskEvent = EventInput & {
  id: string;
  title: string;
  start: string;
  allDay: true;
  extendedProps: {
    taskId: string;
    tone: EventTone;
  };
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function resolveEventTone(task: Task, index: number): EventTone {
  if (task.priority === "urgent") return "red";
  if (task.priority === "high") return "amber";
  if (task.status === "in-progress") return "blue";
  if (task.status === "review") return "purple";
  if (task.status === "done") return "slate";

  const fallbackTones: EventTone[] = ["red", "amber", "blue", "purple", "slate"];
  return fallbackTones[index % fallbackTones.length];
}

function renderEventContent(eventInfo: EventContentArg) {
  const tone = String(eventInfo.event.extendedProps.tone || "slate");
  return (
    <div className={`taskEvent taskEvent-${tone}`}>
      <span className="taskEventDot" />
      <span className="taskEventTitle">{eventInfo.event.title}</span>
    </div>
  );
}

export default function TaskCalendarView({ tasks, onView }: TaskCalendarViewProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(new Date()));

  const taskById = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const events = useMemo<CalendarTaskEvent[]>(
    () =>
      tasks.map((task, index) => ({
        id: `task-${task.id}`,
        title: task.title,
        start: task.dueDate,
        allDay: true,
        extendedProps: {
          taskId: task.id,
          tone: resolveEventTone(task, index),
        },
      })),
    [tasks]
  );

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let minYear = currentYear - 2;
    let maxYear = currentYear + 3;

    tasks.forEach((task) => {
      const taskYear = Number.parseInt(task.dueDate.slice(0, 4), 10);
      if (Number.isNaN(taskYear)) return;
      if (taskYear < minYear) minYear = taskYear;
      if (taskYear > maxYear) maxYear = taskYear;
    });

    const visibleYear = visibleMonth.getFullYear();
    if (visibleYear < minYear) minYear = visibleYear;
    if (visibleYear > maxYear) maxYear = visibleYear;

    return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
  }, [tasks, visibleMonth]);

  const syncVisibleMonth = (date: Date) => {
    setVisibleMonth(getMonthStart(date));
  };

  const moveMonth = (direction: "prev" | "next") => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    if (direction === "prev") api.prev();
    if (direction === "next") api.next();

    syncVisibleMonth(api.getDate());
  };

  const goToToday = () => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.today();
    syncVisibleMonth(api.getDate());
  };

  const handleMonthChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    const month = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(month)) return;

    const nextDate = new Date(visibleMonth.getFullYear(), month, 1);
    api.gotoDate(nextDate);
    syncVisibleMonth(nextDate);
  };

  const handleYearChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    const year = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(year)) return;

    const nextDate = new Date(year, visibleMonth.getMonth(), 1);
    api.gotoDate(nextDate);
    syncVisibleMonth(nextDate);
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    syncVisibleMonth(arg.view.currentStart);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const taskId = String(clickInfo.event.extendedProps.taskId || "");
    const task = taskById.get(taskId);
    if (task) onView(task);
  };

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => moveMonth("prev")}
            aria-label="Go to previous month"
          >
            <LuChevronLeft />
          </button>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => moveMonth("next")}
            aria-label="Go to next month"
          >
            <LuChevronRight />
          </button>
          <button type="button" className={styles.todayButton} onClick={goToToday}>
            Today
          </button>
        </div>

        <div className={styles.selection}>
          <select
            className={styles.selectControl}
            value={visibleMonth.getMonth()}
            onChange={handleMonthChange}
            aria-label="Select month"
          >
            {MONTH_NAMES.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>
          <select
            className={styles.selectControl}
            value={visibleMonth.getFullYear()}
            onChange={handleYearChange}
            aria-label="Select year"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="task-calendar-ui">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={false}
          events={events}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          dayMaxEventRows={2}
          fixedWeekCount={false}
          moreLinkClick="popover"
          showNonCurrentDates
          height="auto"
          displayEventTime={false}
        />
      </div>
    </div>
  );
}
