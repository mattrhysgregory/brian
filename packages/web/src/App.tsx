import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Issue, Status } from "@brain/shared";
import { ATTENTION_STATUSES, STATUSES } from "@brain/shared";
import { api, queryKeys } from "@/lib/api";
import { useEvents } from "@/lib/useEvents";
import { useAppBadge } from "@/lib/useAppBadge";
import { Board } from "@/components/Board";
import { ErrorToast } from "@/components/ErrorToast";
import { NewIssueDialog, type NewIssueValues } from "@/components/NewIssueDialog";
import { ALL_PROJECTS, TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";

// The detail sheet pulls in Lexical; keep it out of the initial board bundle.
const IssueSheet = lazy(() =>
  import("@/components/IssueSheet").then((m) => ({ default: m.IssueSheet })),
);

const ISSUES_KEY = queryKeys.issues();

export default function App() {
  const qc = useQueryClient();
  useEvents();

  const [project, setProject] = useState<string>(ALL_PROJECTS);
  const [openIssueId, setOpenIssueId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: issues, isPending, error, refetch } = useQuery({
    queryKey: ISSUES_KEY,
    queryFn: () => api.listIssues(),
  });

  const projects = useMemo(() => {
    const set = new Set<string>();
    for (const issue of issues ?? []) if (issue.project) set.add(issue.project);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [issues]);

  // A project only exists while some issue carries it; once the last one is
  // renamed or deleted the filter would hide the whole board.
  useEffect(() => {
    if (!issues) return;
    if (project !== ALL_PROJECTS && !projects.includes(project)) setProject(ALL_PROJECTS);
  }, [issues, projects, project]);

  const visible = useMemo(
    () =>
      project === ALL_PROJECTS ? (issues ?? []) : (issues ?? []).filter((i) => i.project === project),
    [issues, project],
  );

  // Clearing a column and the attention badge both ignore the project filter:
  // the endpoint deletes a whole status, and the badge is a global signal.
  const totalCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
    for (const i of issues ?? []) counts[i.status] += 1;
    return counts;
  }, [issues]);

  const attentionCount = ATTENTION_STATUSES.reduce((n, s) => n + totalCounts[s], 0);
  useAppBadge(attentionCount);

  const commentCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const i of issues ?? []) counts[i.id] = i.comment_count;
    return counts;
  }, [issues]);

  const move = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Status }) =>
      api.updateIssue(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ISSUES_KEY });
      const previous = qc.getQueryData<Issue[]>(ISSUES_KEY);
      qc.setQueryData<Issue[]>(ISSUES_KEY, (old) =>
        old?.map((i) => (i.id === id ? { ...i, status } : i)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(ISSUES_KEY, context.previous);
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: ["issues"] });
      void qc.invalidateQueries({ queryKey: queryKeys.issue(vars.id) });
    },
  });

  const clear = useMutation({
    mutationFn: (status: Status) => api.clearIssues(status),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: ISSUES_KEY });
      const previous = qc.getQueryData<Issue[]>(ISSUES_KEY);
      qc.setQueryData<Issue[]>(ISSUES_KEY, (old) => old?.filter((i) => i.status !== status));
      return { previous };
    },
    onError: (err, _status, context) => {
      if (context?.previous) qc.setQueryData(ISSUES_KEY, context.previous);
      setActionError(err instanceof Error ? err.message : "Could not clear the column.");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["issues"] });
      void qc.invalidateQueries({ queryKey: ["issue"] });
    },
  });

  const create = useMutation({
    mutationFn: (values: NewIssueValues) =>
      api.createIssue({ ...values, created_by: "me" }),
    onSuccess: (issue) => {
      setCreating(false);
      void qc.invalidateQueries({ queryKey: ["issues"] });
      setOpenIssueId(issue.id);
    },
  });

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        projects={projects}
        project={project}
        onProjectChange={setProject}
        onNew={() => setCreating(true)}
      />

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-[13px] text-muted">
            {error instanceof Error ? error.message : "Something went wrong."}
          </p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : isPending ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[12px] text-muted">Loading…</p>
        </div>
      ) : (issues ?? []).length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-[13px] text-muted">No issues yet.</p>
          <Button size="sm" onClick={() => setCreating(true)}>
            Create the first one
          </Button>
        </div>
      ) : (
        <Board
          issues={visible}
          commentCounts={commentCounts}
          onOpenIssue={setOpenIssueId}
          totalCounts={totalCounts}
          onMove={(id, status) => move.mutate({ id, status })}
          onClear={(status) => clear.mutate(status)}
          clearingStatus={clear.isPending ? clear.variables : null}
        />
      )}

      <NewIssueDialog
        open={creating}
        onOpenChange={setCreating}
        defaultProject={project === ALL_PROJECTS ? null : project}
        pending={create.isPending}
        onCreate={(values) => create.mutate(values)}
      />

      {actionError && (
        <ErrorToast message={actionError} onDismiss={() => setActionError(null)} />
      )}

      <Suspense fallback={null}>
        <IssueSheet issueId={openIssueId} onClose={() => setOpenIssueId(null)} />
      </Suspense>
    </div>
  );
}
