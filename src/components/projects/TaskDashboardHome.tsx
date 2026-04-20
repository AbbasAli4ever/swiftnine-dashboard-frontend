"use client";

import { useMemo, useState } from "react";
import { Task } from "@/types/task";
import { TaskList } from "@/services/task-list.service";
import {
  LuBookmark,
  LuCalendarDays,
  LuFileText,
  LuFilter,
  LuFlag,
  LuList,
  LuRefreshCw,
  LuSettings,
  LuUser,
  LuX,
} from "react-icons/lu";

interface TaskDashboardHomeProps {
  projectName: string;
  lists: TaskList[];
  tasks: Task[];
  onCreateList?: () => void;
}

type ListRow = {
  list: TaskList;
  total: number;
  done: number;
};

export default function TaskDashboardHome({
  projectName,
  lists,
  tasks,
  onCreateList,
}: TaskDashboardHomeProps) {
  const [showTip, setShowTip] = useState(true);

  const listRows = useMemo<ListRow[]>(() => {
    return lists.map((list) => {
      const listTasks = tasks.filter((task) => task.listId === list.id);
      return {
        list,
        total: listTasks.length,
        done: listTasks.filter((task) => task.status === "done").length,
      };
    });
  }, [lists, tasks]);

  const recentItems = useMemo(
    () => listRows.slice(0, 3).map((row) => row.list.name),
    [listRows]
  );

  return (
    <div className="space-y-4">
      {showTip && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          <p className="w-full text-center">
            Get the most out of your Overview! Add, reorder, and resize cards to customize this space.{" "}
            <button
              type="button"
              className="font-normal text-gray-700 underline dark:text-gray-200"
            >
              Get Started
            </button>
          </p>
          <button
            type="button"
            onClick={() => setShowTip(false)}
            className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close hint"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-normal text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <LuFilter className="h-4 w-4" />
          Filters
        </button>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-gray-400">
            <LuRefreshCw className="h-3.5 w-3.5" />
            Refreshed: just now
          </span>
          <button
            type="button"
            className="rounded-full border border-gray-200 bg-white px-3 py-1 font-normal text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            Auto refresh: On
          </button>
          <button
            type="button"
            className="font-normal text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Customize
          </button>
          <button
            type="button"
            onClick={onCreateList}
            className="rounded-lg bg-gray-900 px-3.5 py-1.5 font-normal text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Create List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-base font-normal text-gray-800 dark:text-white">Recent</h3>
          <div className="space-y-2">
            {(recentItems.length > 0 ? recentItems : ["No lists yet"]).map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <LuList className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-normal text-gray-700 dark:text-gray-200">{item}</span>
                <span className="text-gray-400">in {projectName}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-6 text-base font-normal text-gray-800 dark:text-white">Docs</h3>
          <div className="flex min-h-[132px] flex-col items-center justify-center text-center">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
              <LuFileText className="h-5 w-5" />
            </span>
            <p className="mb-3 text-sm text-gray-400">There are no Docs in this location yet.</p>
            <button
              type="button"
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-normal text-white dark:bg-white dark:text-gray-900"
            >
              Add a Doc
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-6 text-base font-normal text-gray-800 dark:text-white">Bookmarks</h3>
          <div className="flex min-h-[132px] flex-col items-center justify-center text-center">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
              <LuBookmark className="h-5 w-5" />
            </span>
            <p className="mb-3 max-w-[240px] text-sm text-gray-400">
              Bookmarks make it easy to save ClickUp items or any URL from around the web.
            </p>
            <button
              type="button"
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-normal text-white dark:bg-white dark:text-gray-900"
            >
              Add Bookmark
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-base font-normal text-gray-800 dark:text-white">Lists</h3>
          <button
            type="button"
            onClick={onCreateList}
            className="text-sm font-normal text-brand-500 hover:text-brand-600"
          >
            Create List
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/40">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 font-normal">Name</th>
                <th className="px-4 py-2 font-normal">Progress</th>
                <th className="px-4 py-2 font-normal">Start</th>
                <th className="px-4 py-2 font-normal">End</th>
                <th className="px-4 py-2 font-normal">Priority</th>
                <th className="px-4 py-2 font-normal">Owner</th>
                <th className="px-4 py-2 font-normal">
                  <LuSettings className="h-3.5 w-3.5" />
                </th>
              </tr>
            </thead>
            <tbody>
              {listRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    No lists yet in {projectName}.
                  </td>
                </tr>
              ) : (
                listRows.map((row) => {
                  const pct = row.total ? Math.round((row.done / row.total) * 100) : 0;
                  return (
                    <tr key={row.list.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <LuList className="h-3.5 w-3.5 text-gray-400" />
                          <span className="font-normal text-gray-700 dark:text-gray-200">
                            {row.list.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className="h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-normal text-gray-400">
                            {row.done}/{row.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        <LuCalendarDays className="h-4 w-4" />
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        <LuCalendarDays className="h-4 w-4" />
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        <LuFlag className="h-4 w-4" />
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700">
                          <LuUser className="h-3.5 w-3.5" />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300"> </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
