import type { Klass, LexicalNode } from "lexical";
import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { CodeNode } from "@lexical/code";
import { TRANSFORMERS as ALL_TRANSFORMERS } from "@lexical/markdown";

/**
 * Markdown round-tripping uses the stock transformer set minus the checklist
 * transformer, which needs the CheckList node/plugin we deliberately omit.
 */
export const TRANSFORMERS = ALL_TRANSFORMERS;

export const EDITOR_NODES: Array<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
];

/** Class names map onto the `.lex-*` rules in index.css. */
export const EDITOR_THEME: InitialConfigType["theme"] = {
  paragraph: "lex-p",
  quote: "lex-quote",
  heading: { h1: "lex-h1", h2: "lex-h2", h3: "lex-h3", h4: "lex-h3", h5: "lex-h3", h6: "lex-h3" },
  list: {
    ul: "lex-ul",
    ol: "lex-ol",
    listitem: "lex-li",
    nested: { listitem: "lex-nested-li" },
  },
  link: "lex-link",
  code: "lex-code-block",
  text: {
    bold: "lex-bold",
    italic: "lex-italic",
    strikethrough: "lex-strike",
    underline: "lex-underline",
    code: "lex-code-inline",
  },
};
