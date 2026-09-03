import type { Klass, LexicalNode } from "lexical";
import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { LinkNode, AutoLinkNode, $isAutoLinkNode } from "@lexical/link";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { TRANSFORMERS as ALL_TRANSFORMERS, type TextMatchTransformer } from "@lexical/markdown";
import { createLinkMatcherWithRegExp } from "@lexical/react/LexicalAutoLinkPlugin";

/** Matches an http(s) URL sitting on its own in the text. */
const URL_REGEXP = /https?:\/\/[\w.-]+(?:\.[\w.-]+)*(?:[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?/;

/** Turns bare URLs that agents paste into real links (and so into icon carriers). */
export const AUTO_LINK_MATCHERS = [createLinkMatcherWithRegExp(URL_REGEXP)];

/**
 * A bare URL that AutoLinkPlugin linkified must round-trip back to bare text,
 * otherwise merely opening an issue would rewrite `https://…` to `[https://…](https://…)`.
 * Listed before the stock transformers so it wins for AutoLinkNodes.
 */
const AUTO_LINK_AS_TEXT: TextMatchTransformer = {
  dependencies: [AutoLinkNode],
  export: (node) => {
    if (!$isAutoLinkNode(node)) return null;
    const text = node.getTextContent();
    return text === node.getURL() ? text : null;
  },
  importRegExp: /(?!)/,
  regExp: /(?!)/,
  replace: () => {},
  trigger: "",
  type: "text-match",
};

export const TRANSFORMERS = [AUTO_LINK_AS_TEXT, ...ALL_TRANSFORMERS];

export const EDITOR_NODES: Array<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  // CodeNode's tokenizer/Tab handling creates CodeHighlightNodes, so the node
  // must be registered or editing inside a fenced block throws.
  CodeHighlightNode,
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
