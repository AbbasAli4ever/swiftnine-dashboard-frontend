import { Toaster } from "@/components/ui/toast/Toaster";
import { SidebarProvider } from "@/context/SidebarContext";
import { TaskProvider } from "@/context/TaskContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { ProjectProvider } from "@/context/ProjectContext";
import { TaskListProvider } from "@/context/TaskListContext";
import "./globals.css";
import "flatpickr/dist/flatpickr.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="dark:bg-gray-900" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <ProjectProvider>
                <TaskListProvider>
                  <SidebarProvider>
                    <TaskProvider>{children}</TaskProvider>
                  </SidebarProvider>
                </TaskListProvider>
              </ProjectProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
