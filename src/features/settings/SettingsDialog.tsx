import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { usePreferences } from "./preferences";

export function SettingsDialog() {
  const { dark, muted, name, setDark, setMuted, setName } = usePreferences();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Settings" className="rounded-xl">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Settings</DialogTitle>
          <DialogDescription>Saved on this device only.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="pref-name">Player name</Label>
            <Input id="pref-name" value={name} maxLength={20} placeholder="Your name" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="pref-dark">Dark mode</Label>
            <Switch id="pref-dark" checked={dark} onCheckedChange={setDark} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="pref-sound">Sound effects</Label>
            <Switch id="pref-sound" checked={!muted} onCheckedChange={(v) => setMuted(!v)} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
