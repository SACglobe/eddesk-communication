export default function AppFooter() {
  return (
    <footer className="w-full border-t border-border/60 bg-muted/20 py-3.5 px-4 sm:px-6">
      <div className="mx-auto flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-center text-[12px] text-muted-foreground">
        <span className="font-medium">
          <strong className="font-bold text-foreground">EdDesk</strong> · Powered by{" "}
          <strong className="font-bold text-foreground">SAC Globe Tech ( V: 1.0.1 )</strong>
        </span>
        <span className="hidden sm:inline text-muted-foreground/40">·</span>
        <span>
          &copy; 2026 SAC Globe Tech. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
