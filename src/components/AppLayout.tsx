"use client";

import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import AppFooter from "./AppFooter";
import { ToastContainer } from "@/components/ToastContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-canvas font-sans antialiased text-foreground">
      <ToastContainer />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          {children}
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
