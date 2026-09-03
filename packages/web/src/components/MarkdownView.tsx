import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { $convertFromMarkdownString } from "@lexical/markdown";
import { EDITOR_NODES, EDITOR_THEME, TRANSFORMERS } from "@/lib/lexical";
import { cn } from "@/lib/utils";

/**
 * Read-only markdown rendering. Reuses the already-bundled Lexical runtime
 * rather than pulling in a second markdown parser.
 */
export function MarkdownView({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: "brian-view",
        theme: EDITOR_THEME,
        nodes: EDITOR_NODES,
        editable: false,
        onError: (error) => console.error(error),
        editorState: () => $convertFromMarkdownString(markdown, TRANSFORMERS),
      }}
    >
      <RichTextPlugin
        contentEditable={<ContentEditable className={cn("lex-root", className)} readOnly />}
        ErrorBoundary={LexicalErrorBoundary}
      />
    </LexicalComposer>
  );
}
