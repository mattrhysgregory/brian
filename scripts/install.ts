#!/usr/bin/env bun
/**
 * Installs brain locally:
 *  - builds the web bundle (unless --no-build)
 *  - symlinks .claude/skills/brain -> ~/.claude/skills/brain
 *  - links the `brain` CLI globally via `bun link`
 *  - installs + (re)loads a launchd LaunchAgent that runs the server at login
 *
 * Usage: bun run scripts/install.ts [--dry-run] [--no-build]
 */
import { existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const HOME = homedir();
const BUN_BIN = Bun.which("bun") ?? join(HOME, ".bun", "bin", "bun");
const BUN_BIN_DIR = dirname(BUN_BIN);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const noBuild = args.includes("--no-build");

function log(action: string) {
  console.log(dryRun ? `[dry-run] ${action}` : action);
}

async function run(cmd: string[], opts: { cwd?: string } = {}) {
  log(`run: ${cmd.join(" ")}${opts.cwd ? ` (cwd=${opts.cwd})` : ""}`);
  if (dryRun) return;
  const proc = Bun.spawn(cmd, { cwd: opts.cwd, stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`command failed (${code}): ${cmd.join(" ")}`);
  }
}

// --- 1. build web ---
async function buildWeb() {
  if (noBuild) {
    log("skip web build (--no-build)");
    return;
  }
  await run([BUN_BIN, "run", "--filter", "@brain/web", "build"], { cwd: REPO_ROOT });
}

// --- 2. symlink skill ---
function linkSkill() {
  const src = join(REPO_ROOT, ".claude", "skills", "brain");
  const destDir = join(HOME, ".claude", "skills");
  const dest = join(destDir, "brain");

  if (existsSync(dest) || lstatExists(dest)) {
    const st = lstatSync(dest);
    if (st.isSymlink()) {
      log(`remove existing symlink ${dest} -> ${safeReadlink(dest)}`);
      if (!dryRun) unlinkSync(dest);
    } else if (st.isDirectory()) {
      throw new Error(
        `refusing to overwrite real directory at ${dest} (not a symlink). Remove it manually if it should be replaced.`,
      );
    } else {
      log(`remove existing file ${dest}`);
      if (!dryRun) unlinkSync(dest);
    }
  }

  log(`mkdir -p ${destDir}`);
  if (!dryRun) mkdirSync(destDir, { recursive: true });

  log(`symlink ${dest} -> ${src}`);
  if (!dryRun) symlinkSync(src, dest, "dir");
}

function lstatExists(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function safeReadlink(p: string): string {
  try {
    return readlinkSync(p);
  } catch {
    return "?";
  }
}

// --- 3. link CLI globally ---
async function linkCli() {
  const cliDir = join(REPO_ROOT, "packages", "cli");
  await run([BUN_BIN, "link"], { cwd: cliDir });
  await run([BUN_BIN, "link", "@brain/cli"], { cwd: REPO_ROOT });

  log("verify: brain --help");
  if (!dryRun) {
    const proc = Bun.spawn([join(BUN_BIN_DIR, "brain"), "--help"], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, PATH: `${BUN_BIN_DIR}:${process.env.PATH ?? ""}` },
    });
    const code = await proc.exited;
    if (code !== 0) {
      const err = await new Response(proc.stderr).text();
      throw new Error(`\`brain --help\` failed after linking:\n${err}`);
    }
    console.log("brain --help OK");
  }
}

// --- 4. launchd plist ---
const PLIST_LABEL = "com.brain.server";
const PLIST_PATH = join(HOME, "Library", "LaunchAgents", `${PLIST_LABEL}.plist`);
const LOG_DIR = join(HOME, ".brain", "logs");

function plistContents(): string {
  const serverEntry = join(REPO_ROOT, "packages", "server", "src", "index.ts");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${BUN_BIN}</string>
    <string>run</string>
    <string>${serverEntry}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${join(LOG_DIR, "server.out.log")}</string>
  <key>StandardErrorPath</key>
  <string>${join(LOG_DIR, "server.err.log")}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${BUN_BIN_DIR}:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
`;
}

async function installLaunchAgent() {
  log(`mkdir -p ${LOG_DIR}`);
  if (!dryRun) mkdirSync(LOG_DIR, { recursive: true });

  log(`write ${PLIST_PATH}`);
  if (!dryRun) writeFileSync(PLIST_PATH, plistContents(), "utf-8");

  const uid = process.getuid?.() ?? 501;
  const domain = `gui/${uid}`;

  // bootout is expected to fail/no-op if not currently loaded; ignore its exit code.
  log(`launchctl bootout ${domain}/${PLIST_LABEL} (best-effort)`);
  if (!dryRun) {
    const proc = Bun.spawn(["launchctl", "bootout", `${domain}/${PLIST_LABEL}`], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
  }

  await run(["launchctl", "bootstrap", domain, PLIST_PATH]);

  await waitForHealth();
}

async function waitForHealth() {
  const base = process.env.BRAIN_URL ?? `http://localhost:${process.env.BRAIN_PORT ?? "4400"}`;
  const url = `${base}/api/health`;
  log(`wait for ${url}`);
  if (dryRun) return;

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`server healthy at ${base}`);
        return;
      }
    } catch {
      // not up yet
    }
    await Bun.sleep(500);
  }
  throw new Error(`server did not become healthy at ${url} within 15s (check ${LOG_DIR})`);
}

async function main() {
  console.log(`brain install${dryRun ? " (dry run)" : ""}`);
  await buildWeb();
  linkSkill();
  await linkCli();
  await installLaunchAgent();
  console.log("done.");
}

main().catch((err) => {
  console.error(`install failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
