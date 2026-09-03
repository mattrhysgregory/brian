import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import { STATUS_LABELS, STATUSES, type Status, type UpdateIssue } from "@brain/shared";
import { api, queryKeys } from "@/lib/api";
import { absoluteTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownEditor } from "./MarkdownEditor";
import { CommentThread } from "./CommentThread";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

export function IssueSheet({
  issueId,
  onClose,
}: {
  issueId: number | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const open = issueId != null;

  const { data: issue, isLoading } = useQuery({
    queryKey: queryKeys.issue(issueId ?? -1),
    queryFn: () => api.getIssue(issueId!),
    enabled: open,
  });

  const [saveError, setSaveError] = useState<string | null>(null);

  const invalidate = (id: number) => {
    void qc.invalidateQueries({ queryKey: ["issues"] });
    void qc.invalidateQueries({ queryKey: queryKeys.issue(id) });
  };

  // The id travels in the mutation variables: the description editor flushes a
  // pending save while unmounting, which happens after `issueId` is already
  // null, and reading it here would PATCH /api/issues/null.
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: UpdateIssue }) =>
      api.updateIssue(id, patch),
    onSuccess: (_data, vars) => {
      setSaveError(null);
      invalidate(vars.id);
    },
    onError: (err) =>
      setSaveError(err instanceof Error ? err.message : "Could not save your changes."),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteIssue(issueId!),
    onSuccess: () => {
      onClose();
      void qc.invalidateQueries({ queryKey: ["issues"] });
    },
  });
  const addComment = useMutation({
    mutationFn: (body: string) => api.addComment(issueId!, { body, author: "me" }),
    onSuccess: () => issueId != null && invalidate(issueId),
  });
  const deleteComment = useMutation({
    mutationFn: (id: number) => api.deleteComment(id),
    onSuccess: () => issueId != null && invalidate(issueId),
  });

  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const loadedFor = useRef<number | null>(null);

  // Local field state is seeded once per issue so live SSE refetches never
  // yank text out from under the cursor.
  useEffect(() => {
    if (issue && loadedFor.current !== issue.id) {
      loadedFor.current = issue.id;
      setTitle(issue.title);
      setProject(issue.project ?? "");
      setConfirmingDelete(false);
    }
    if (!open) loadedFor.current = null;
  }, [issue, open]);

  const commitTitle = () => {
    const next = title.trim();
    if (!issue) return;
    if (!next) {
      setTitle(issue.title);
      return;
    }
    if (next !== issue.title) update.mutate({ id: issue.id, patch: { title: next } });
  };

  const commitProject = () => {
    if (!issue) return;
    const next = project.trim();
    if (next !== (issue.project ?? ""))
      update.mutate({ id: issue.id, patch: { project: next || null } });
  };

  return (
    <>
      {saveError && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md border border-danger bg-card px-3 py-2 text-[12px] shadow-lg"
        >
          <span>{saveError}</span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-muted hover:text-fg"
            aria-label="Dismiss error"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle className="sr-only">{issue?.title ?? "Issue"}</SheetTitle>
        <SheetDescription className="sr-only">Issue detail</SheetDescription>

        {isLoading || !issue ? (
          <p className="p-4 text-[12px] text-muted">Loading…</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                  if (e.key === "Escape") setTitle(issue.title);
                }}
                aria-label="Title"
                className="mr-8 w-[calc(100%-2rem)] rounded border border-transparent bg-transparent px-1 py-0.5 text-[15px] font-semibold leading-snug hover:border-border focus:border-border focus:outline-none"
              />

              <p className="mt-1 px-1 text-[11px] text-muted">
                #{issue.id} · opened by {issue.created_by} · updated{" "}
                <span title={absoluteTime(issue.updated_at)}>{absoluteTime(issue.updated_at)}</span>
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label="Status">
                  <Select
                    value={issue.status}
                    onValueChange={(v) => update.mutate({ id: issue.id, patch: { status: v as Status } })}
                  >
                    <SelectTrigger aria-label="Status">
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
                </Field>

                <Field label="Project">
                  <Input
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    onBlur={commitProject}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    placeholder="None"
                    aria-label="Project"
                  />
                </Field>
              </div>

              <div className="mt-4 flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Description
                </span>
                <MarkdownEditor
                  key={issue.id}
                  initialMarkdown={issue.description ?? ""}
                  onSave={(markdown) =>
                    update.mutate({ id: issue.id, patch: { description: markdown || null } })
                  }
                />
              </div>

              <div className="mt-6">
                <CommentThread
                  comments={issue.comments}
                  onAdd={(body) => addComment.mutate(body)}
                  onDelete={(id) => deleteComment.mutate(id)}
                  pending={addComment.isPending}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5">
              {confirmingDelete ? (
                <>
                  <span className="text-[12px] text-muted">Delete this issue?</span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => remove.mutate()}
                    disabled={remove.isPending}
                  >
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="danger" onClick={() => setConfirmingDelete(true)}>
                  <Trash2 className="size-3.5" />
                  Delete issue
                </Button>
              )}
            </div>
          </div>
        )}
        </SheetContent>
      </Sheet>
    </>
  );
}
