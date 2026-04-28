import { LuCircleCheck } from "react-icons/lu";

export default function MyTasksPage() {
  return (
    <div className="flex w-full h-full flex-col items-center justify-center gap-4 text-center px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800">
        <LuCircleCheck className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">My Tasks</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Coming Soon</p>
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 max-w-xs">
          All tasks assigned to you across every space and list, in one focused view. This feature is on its way.
        </p>
      </div>
    </div>
  );
}
