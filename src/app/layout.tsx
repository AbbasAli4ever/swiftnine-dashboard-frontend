import { Toaster } from "@/components/ui/toast/Toaster";
import { SidebarProvider } from "@/context/SidebarContext";
import { TaskProvider } from "@/context/TaskContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { ProjectProvider } from "@/context/ProjectContext";
import { Outfit } from "next/font/google";
import "./globals.css";
import "flatpickr/dist/flatpickr.css";

const outfit = Outfit({
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <ProjectProvider>
                <SidebarProvider>
                  <TaskProvider>{children}</TaskProvider>
                </SidebarProvider>
              </ProjectProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
