import { describe, expect, test } from "bun:test";
import { extractGitHubRefs } from "./github";

describe("extractGitHubRefs", () => {
  test("returns nothing for empty input", () => {
    expect(extractGitHubRefs(null)).toEqual([]);
    expect(extractGitHubRefs("")).toEqual([]);
    expect(extractGitHubRefs("no links here")).toEqual([]);
  });

  test("parses a bare pull request URL", () => {
    expect(extractGitHubRefs("shipped in https://github.com/acme/widgets/pull/12")).toEqual([
      {
        url: "https://github.com/acme/widgets/pull/12",
        owner: "acme",
        repo: "widgets",
        kind: "pull",
        number: 12,
      },
    ]);
  });

  test("parses a markdown link", () => {
    const refs = extractGitHubRefs("see [the issue](https://github.com/acme/widgets/issues/7).");
    expect(refs).toEqual([
      {
        url: "https://github.com/acme/widgets/issues/7",
        owner: "acme",
        repo: "widgets",
        kind: "issue",
        number: 7,
      },
    ]);
  });

  test("ignores non-GitHub links but keeps subdomains", () => {
    const refs = extractGitHubRefs(
      "https://example.com/acme/widgets/pull/1 and https://gist.github.com/acme/abc123",
    );
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ owner: "acme", repo: "abc123", kind: "other" });
    expect(refs[0]!.number).toBeUndefined();
  });

  test("classifies repo and tree links as other", () => {
    const refs = extractGitHubRefs("https://github.com/acme/widgets");
    expect(refs).toEqual([
      { url: "https://github.com/acme/widgets", owner: "acme", repo: "widgets", kind: "other" },
    ]);
  });

  test("de-duplicates the same pull referenced twice", () => {
    const refs = extractGitHubRefs(
      "[#12](https://github.com/acme/widgets/pull/12) — https://github.com/acme/widgets/pull/12",
    );
    expect(refs).toHaveLength(1);
  });

  test("keeps distinct pulls in order", () => {
    const refs = extractGitHubRefs(
      "https://github.com/acme/widgets/pull/12\nhttps://github.com/acme/widgets/pull/13\nhttps://github.com/other/repo/pull/12",
    );
    expect(refs.map((r) => `${r.repo}#${r.number}`)).toEqual([
      "widgets#12",
      "widgets#13",
      "repo#12",
    ]);
  });

  test("strips trailing sentence punctuation", () => {
    const refs = extractGitHubRefs("done: https://github.com/acme/widgets/pull/4.");
    expect(refs[0]!.url).toBe("https://github.com/acme/widgets/pull/4");
  });

  test("ignores malformed github paths", () => {
    expect(extractGitHubRefs("https://github.com/acme")).toEqual([]);
    expect(extractGitHubRefs("https://github.com/")).toEqual([]);
  });
});
