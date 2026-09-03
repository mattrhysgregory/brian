import { useEffect, useState } from "react";
import { STATUS_LABELS, STATUSES, type Status } from "@brain/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface NewIssueValues {
  title: string;
  project: string | null;
  status: Status;
}

export function NewIssueDialog({
  open,
  onOpenChange,
  defaultProject,
  pending,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProject?: string | null;
  pending?: boolean;
  onCreate: (values: NewIssueValues) => void;
}) {
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [status, setStatus] = useState<Status>("todo");

  useEffect(() => {
    if (open) {
      setTitle("");
      setProject(defaultProject ?? "");
      setStatus("todo");
    }
  }, [open, defaultProject]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate({ title: trimmed, project: project.trim() || null, status });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle className="text-[13px] font-semibold">New issue</DialogTitle>
        <DialogDescription className="sr-only">Create a new issue.</DialogDescription>

        <form onSubmit={submit} className="mt-3 flex flex-col gap-2.5">
          <Input
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            aria-label="Title"
          />
          <Input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="Project (optional)"
            aria-label="Project"
          />
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger aria-label="Column">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!title.trim() || pending}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
