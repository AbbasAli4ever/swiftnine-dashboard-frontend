import { Toaster } from "@/components/ui/toast/Toaster";
import { SidebarProvider } from "@/context/SidebarContext";
import { TaskProvider } from "@/context/TaskContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { ProjectProvider } from "@/context/ProjectContext";
import { TaskListProvider } from "@/context/TaskListContext";
import { DocsProvider } from "@/context/DocsContext";
import { QueryProvider } from "@/app/providers/QueryProvider";
import "./globals.css";
import "flatpickr/dist/flatpickr.css";

const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem('theme');
    if (!theme) {
      theme = 'light';
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-white dark:bg-gray-900" suppressHydrationWarning>
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              <WorkspaceProvider>
                <ProjectProvider>
                  <TaskListProvider>
                    <DocsProvider>
                      <SidebarProvider>
                        <TaskProvider>{children}</TaskProvider>
                      </SidebarProvider>
                    </DocsProvider>
                  </TaskListProvider>
                </ProjectProvider>
              </WorkspaceProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
