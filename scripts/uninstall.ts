#!/usr/bin/env bun
/**
 * Reverses `scripts/install.ts`:
 *  - unloads + removes the launchd LaunchAgent
 *  - unlinks the global `brain` CLI
 *  - removes the ~/.claude/skills/brain symlink (only if it points into this repo)
 *
 * Usage: bun run scripts/uninstall.ts [--dry-run]
 */
import { existsSync, lstatSync, readlinkSync, rmSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const HOME = homedir();
const BUN_BIN = Bun.which("bun") ?? join(HOME, ".bun", "bin", "bun");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

function log(action: string) {
  console.log(dryRun ? `[dry-run] ${action}` : action);
}

async function run(cmd: string[], opts: { cwd?: string; ignoreFailure?: boolean } = {}) {
  log(`run: ${cmd.join(" ")}${opts.cwd ? ` (cwd=${opts.cwd})` : ""}`);
  if (dryRun) return;
  const proc = Bun.spawn(cmd, { cwd: opts.cwd, stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0 && !opts.ignoreFailure) {
    throw new Error(`command failed (${code}): ${cmd.join(" ")}`);
  }
}

const PLIST_LABEL = "com.brain.server";
const PLIST_PATH = join(HOME, "Library", "LaunchAgents", `${PLIST_LABEL}.plist`);

async function removeLaunchAgent() {
  if (process.platform !== "darwin") {
    console.log(`skip: launchd is macOS-only (platform=${process.platform})`);
    return;
  }

  const uid = process.getuid?.() ?? 501;
  const domain = `gui/${uid}`;

  log(`launchctl bootout ${domain}/${PLIST_LABEL} (best-effort)`);
  if (!dryRun) {
    const proc = Bun.spawn(["launchctl", "bootout", `${domain}/${PLIST_LABEL}`], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
  }

  if (existsSync(PLIST_PATH)) {
    log(`remove ${PLIST_PATH}`);
    if (!dryRun) rmSync(PLIST_PATH);
  } else {
    log(`${PLIST_PATH} does not exist, skipping`);
  }
}

async function unlinkCli() {
  const cliDir = join(REPO_ROOT, "packages", "cli");
  await run([BUN_BIN, "unlink"], { cwd: cliDir, ignoreFailure: true });
}

function unlinkSkill() {
  const dest = join(HOME, ".claude", "skills", "brain");
  const expectedSrc = join(REPO_ROOT, ".claude", "skills", "brain");

  if (!existsSync(dest) && !lstatExists(dest)) {
    log(`${dest} does not exist, skipping`);
    return;
  }

  const st = lstatSync(dest);
  if (!st.isSymlink()) {
    console.warn(`skip: ${dest} is not a symlink (leaving it in place)`);
    return;
  }

  const target = readlinkSync(dest);
  if (target !== expectedSrc) {
    console.warn(`skip: ${dest} points to ${target}, not ${expectedSrc} (leaving it in place)`);
    return;
  }

  log(`remove symlink ${dest}`);
  if (!dryRun) unlinkSync(dest);
}

function lstatExists(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`brain uninstall${dryRun ? " (dry run)" : ""}`);
  await removeLaunchAgent();
  await unlinkCli();
  unlinkSkill();
  console.log("done.");
}

main().catch((err) => {
  console.error(`uninstall failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
