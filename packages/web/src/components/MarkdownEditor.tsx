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
import { registerCodeHighlighting } from "@lexical/code";
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

/** Prism-based syntax highlighting for fenced code blocks. */
function CodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => registerCodeHighlighting(editor), [editor]);
  return null;
}

/**
 * Re-exports the freshly imported markdown once on mount. Import/export is not
 * byte-identical for all inputs, so this round-tripped string — not the raw
 * `initialMarkdown` — is the baseline an untouched document must compare equal
 * to, otherwise merely opening an issue would rewrite its description.
 */
function BaselinePlugin({ onBaseline }: { onBaseline: (markdown: string) => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.getEditorState().read(() => {
      onBaseline($convertToMarkdownString(TRANSFORMERS));
    });
  }, [editor, onBaseline]);
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
  // The round-tripped baseline; until it lands nothing counts as a change.
  const baseline = useRef<string | null>(null);
  // Only a real edit ever triggers a save, so open+close is a no-op.
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const handleBaseline = useCallback((markdown: string) => {
    baseline.current = markdown;
    latest.current = markdown;
    saved.current = markdown;
  }, []);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
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
      // Before the baseline exists there is nothing to compare against, and a
      // document still identical to it was never really edited. Once it has
      // diverged it stays dirty, so reverting an edit is itself saved.
      if (baseline.current === null) return;
      if (!dirty.current && latest.current === baseline.current) return;
      dirty.current = true;
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
      <CodeHighlightPlugin />
      <BaselinePlugin onBaseline={handleBaseline} />
      <OnChangePlugin ignoreSelectionChange onChange={handleChange} />
      <BlurSavePlugin onFlush={flush} />
    </LexicalComposer>
  );
}
