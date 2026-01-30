#!/usr/bin/env bun
/**
 * Watch zig/src and zig/build.zig; on change, rebuild and restart the Zig server.
 * Gives HMR-like behavior for Zig when used with dev:all.
 * Zig stdout/stderr are teed to .zig-server.log so crash output is captured.
 */
import { watch } from "node:fs";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.env.ROOT ?? join(import.meta.dir, "..");
const ZIG_DIR = join(ROOT, "zig");
const ZIG_LOG = join(ROOT, ".zig-server.log");
const DEBOUNCE_MS = 400;

let child: ReturnType<typeof spawn> | null = null;
let logStream: ReturnType<typeof createWriteStream> | null = null;
let restartTimer: ReturnType<typeof setTimeout> | null = null;

function tee(
  source: NodeJS.ReadableStream,
  dest: NodeJS.WritableStream,
  log: NodeJS.WritableStream
) {
  source.on("data", (chunk: Buffer | string) => {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    dest.write(buf);
    log.write(buf);
  });
}

function runZig() {
  if (child) {
    child.kill("SIGTERM");
    child = null;
  }
  if (logStream) {
    logStream.end();
    logStream = null;
  }

  logStream = createWriteStream(ZIG_LOG, { flags: "w" });
  logStream.write(`=== zig build run @ ${new Date().toISOString()} ===\n\n`);

  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? join(ROOT, "sqlite.db"),
    SELFHOST_DEV: process.env.SELFHOST_DEV ?? "1", // dev tunnel etc. when running via watcher
  };
  child = spawn("zig", ["build", "run"], {
    cwd: ZIG_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });

  if (child.stdout) tee(child.stdout, process.stdout, logStream);
  if (child.stderr) tee(child.stderr, process.stderr, logStream);

  child.on("exit", (code, signal) => {
    if (logStream) {
      logStream.write(`\n=== exit code=${code} signal=${signal} ===\n`);
      logStream.end();
      logStream = null;
    }
    child = null;
    if (signal !== "SIGTERM" && code !== 0 && code != null) {
      console.error(`[watch-zig] Zig process exited with code ${code}. Fix errors and save to restart.`);
    }
  });
}

function scheduleRestart() {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    console.log("[watch-zig] Change detected, rebuilding and restarting Zig...");
    runZig();
  }, DEBOUNCE_MS);
}

function watchRecursive(dir: string) {
  try {
    watch(
      dir,
      { recursive: true },
      (event, filename) => {
        if (filename && (filename.endsWith(".zig") || filename.endsWith("build.zig"))) scheduleRestart();
      }
    );
  } catch (e) {
    console.warn("[watch-zig] Could not watch", dir, e);
  }
}

// Watch zig source and build file
watchRecursive(join(ZIG_DIR, "src"));
try {
  watch(join(ZIG_DIR, "build.zig"), () => scheduleRestart());
} catch {
  // build.zig might be in src in some setups; recursive watch on src is enough
}

// Listen for keyboard input (only when running interactively)
if (process.stdin.isTTY && process.stdin.setRawMode) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (key: string) => {
    if (key === "r" || key === "R") {
      console.log("[watch-zig] Manual restart triggered...");
      scheduleRestart();
    } else if (key === "\u0003") {
      // Ctrl+C
      process.exit(0);
    }
  });
  console.log("[watch-zig] Press 'r' to manually restart, Ctrl+C to exit.");
}

console.log("[watch-zig] Watching zig/src and zig/build.zig — Zig will restart on change.");
runZig();
