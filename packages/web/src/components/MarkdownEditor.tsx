import { useCallback, useEffect, useRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { BLUR_COMMAND, COMMAND_PRIORITY_LOW } from "lexical";
import { EDITOR_NODES, EDITOR_THEME, TRANSFORMERS } from "@/lib/lexical";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 800;

/** Flushes the editor's markdown on blur, so nothing is lost when the sheet closes. */
function BlurSavePlugin({ onFlush }: { onFlush: () => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          onFlush();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor, onFlush],
  );
  return null;
}

export interface MarkdownEditorProps {
  /** Initial markdown. Changes are ignored after mount — remount via `key` to reset. */
  initialMarkdown: string;
  onSave: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Rich-text editor that reads and writes markdown. Saves are debounced 800ms
 * after the last keystroke and flushed immediately on blur.
 */
export function MarkdownEditor({
  initialMarkdown,
  onSave,
  placeholder = "Add a description…",
  className,
  ariaLabel = "Description",
}: MarkdownEditorProps) {
  const latest = useRef(initialMarkdown);
  const saved = useRef(initialMarkdown);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (latest.current === saved.current) return;
    saved.current = latest.current;
    onSaveRef.current(latest.current);
  }, []);

  // A pending debounce must not be dropped when the sheet unmounts.
  useEffect(() => flush, [flush]);

  const handleChange = useCallback(
    (_state: unknown, editor: import("lexical").LexicalEditor) => {
      editor.read(() => {
        latest.current = $convertToMarkdownString(TRANSFORMERS);
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, DEBOUNCE_MS);
    },
    [flush],
  );

  return (
    <LexicalComposer
      initialConfig={{
        namespace: "brain-description",
        theme: EDITOR_THEME,
        nodes: EDITOR_NODES,
        onError: (error) => console.error(error),
        editorState: () => $convertFromMarkdownString(initialMarkdown, TRANSFORMERS),
      }}
    >
      <div
        className={cn(
          "relative rounded-md border border-border bg-card px-2.5 py-2 focus-within:border-ring",
          className,
        )}
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="lex-root min-h-24"
              aria-label={ariaLabel}
              aria-placeholder={placeholder}
              placeholder={
                <div className="pointer-events-none absolute left-2.5 top-2 select-none text-[13px] text-muted">
                  {placeholder}
                </div>
              }
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <TabIndentationPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <OnChangePlugin ignoreSelectionChange onChange={handleChange} />
      <BlurSavePlugin onFlush={flush} />
    </LexicalComposer>
  );
}
