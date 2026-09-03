import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ALL_PROJECTS = "__all__";

export function TopBar({
  projects,
  project,
  onProjectChange,
  onNew,
}: {
  projects: string[];
  project: string;
  onProjectChange: (next: string) => void;
  onNew: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
      <h1 className="text-[13px] font-semibold tracking-tight">brian</h1>

      <div className="ml-auto flex items-center gap-2">
        <Select value={project} onValueChange={onProjectChange}>
          <SelectTrigger
            className="h-7 w-36 text-[12px]"
            aria-label="Filter by project"
            disabled={projects.length === 0}
          >
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" onClick={onNew}>
          <Plus className="size-3.5" />
          New
        </Button>
      </div>
    </header>
  );
}
