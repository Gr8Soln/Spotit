import { Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/brand";
import { SettingsDialog } from "@/features/settings/SettingsDialog";

export function Logo() {
  return (
    <Link to="/" className="group inline-flex items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
      <span className="grid h-9 w-9 -rotate-6 place-items-center rounded-xl bg-primary font-display text-lg font-extrabold text-primary-foreground shadow-pop transition-transform group-hover:rotate-0">
        7
      </span>
      <span className="font-display text-xl font-extrabold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <Logo />
      <div className="flex items-center gap-2">
        {children}
        <SettingsDialog />
      </div>
    </header>
  );
}
