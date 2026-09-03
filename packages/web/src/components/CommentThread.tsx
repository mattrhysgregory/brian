import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Comment } from "@brian/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownView } from "./MarkdownView";
import { absoluteTime, relativeTime } from "@/lib/time";

function CommentRow({ comment, onDelete }: { comment: Comment; onDelete: () => void }) {
  return (
    <li className="group relative rounded-md border border-border bg-card px-2.5 py-2">
      <div className="flex items-baseline gap-2 text-[11px] text-muted">
        <span className="font-medium text-fg">{comment.author}</span>
        <span title={absoluteTime(comment.created_at)}>{relativeTime(comment.created_at)}</span>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete comment by ${comment.author}`}
          className="ml-auto rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="mt-1">
        <MarkdownView markdown={comment.body} />
      </div>
    </li>
  );
}

export function CommentThread({
  comments,
  onAdd,
  onDelete,
  pending,
}: {
  comments: Comment[];
  onAdd: (body: string) => void;
  onDelete: (id: number) => void;
  pending?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    onAdd(body);
    setDraft("");
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        Comments{comments.length > 0 && ` (${comments.length})`}
      </h3>

      {comments.length === 0 ? (
        <p className="text-[12px] text-muted">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {comments.map((c) => (
            <CommentRow key={c.id} comment={c} onDelete={() => onDelete(c.id)} />
          ))}
        </ul>
      )}

      <div className="mt-1 flex flex-col items-end gap-1.5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add a comment… (markdown, ⌘↵ to send)"
          aria-label="Add a comment"
        />
        <Button size="sm" onClick={submit} disabled={!draft.trim() || pending}>
          Comment
        </Button>
      </div>
    </section>
  );
}
