#!/usr/bin/env bun
import { DEFAULT_BASE_URL } from "@brian/shared";
import { run } from "./cli";

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}

async function openUrl(url: string): Promise<void> {
  const proc = Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
  await proc.exited;
}

const code = await run(process.argv.slice(2), {
  baseUrl: process.env.BRIAN_URL ?? DEFAULT_BASE_URL,
  stdout: (s) => process.stdout.write(s + "\n"),
  stderr: (s) => process.stderr.write(s + "\n"),
  readStdin,
  openUrl,
});
process.exit(code);
