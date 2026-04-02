---
title: "Frontend builds in Bazel with Vite and rules_js"
date: 2026-03-28T22:00:00+01:00
draft: true
tags: [bazel,vite,react,javascript,rules_js,frontend,tsgo]
---

i moved my frontend from Next.js to Vite and brought it into the same Bazel workspace as my Go backend. `bazel build //...` now builds everything. The frontend is a React SPA, so the output is one JS file, one CSS file, and an index.html that can be served from anywhere.

## Why not Next.js

i was running Next.js 16 for a dashboard behind auth. Every page fetched data client-side via ConnectRPC. No server components, no API routes, no ISR, no middleware. The entire SSR machinery was unused.

Next.js also fights Bazel. It expects to own its output directory (`.next/`), writes temp files alongside sources, and its build internals change with every major release. There are contrib macros in rules_js for Next.js, but they work by generating a wrapper config that patches around these assumptions. Every Next.js upgrade risks breaking them.

Vite has none of these problems. `vite build` takes inputs, writes to `dist/`, done.

## The Bazel setup

[rules_js](https://github.com/aspect-build/rules_js) from Aspect Build is the only serious option for JavaScript in Bazel. It requires pnpm as the package manager (no npm, no yarn, no bun). The lockfile gets translated into individual Bazel repository rules per package, each integrity-hashed.

In `MODULE.bazel`:

```starlark
bazel_dep(name = "aspect_rules_js", version = "3.0.3")

npm = use_extension("@aspect_rules_js//npm:extensions.bzl", "npm")
npm.npm_translate_lock(
    name = "npm",
    npmrc = "//app:.npmrc",
    pnpm_lock = "//app:pnpm-lock.yaml",
)
use_repo(npm, "npm")
```

That's it. Just `rules_js`. No `rules_ts`, no `rules_swc`.

The `.npmrc` needs `hoist=false`. rules_js requires this because it mirrors pnpm's flat layout inside Bazel's output tree. Without it, packages resolve phantom dependencies that aren't declared in the lockfile, and builds break non-deterministically.

## Type-checking with tsgo

[tsgo](https://github.com/microsoft/typescript-go) is the TypeScript compiler rewritten in Go by the TypeScript team. It's a statically linked native binary, about 5x faster than tsc on my codebase (0.5s vs 2.5s).

i use it for type-checking only. It runs as a `js_test` target in Bazel:

```starlark
js_test(
    name = "typecheck",
    args = [
        "--noEmit",
        "--project",
        "app/tsconfig.json",
    ],
    data = _SRCS + [
        "vite-env.d.ts",
        "tsconfig.json",
        ":node_modules/@typescript/native-preview-linux-x64",
        ":node_modules",
    ],
    entry_point = "tsgo_wrapper.mjs",
)
```

The wrapper script is minimal. It resolves the native binary from the platform-specific npm package and executes it:

```javascript
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";

const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve(
  "@typescript/native-preview-linux-x64/package.json"
));
const exe = join(pkg, "lib", "tsgo");

try {
  execFileSync(exe, process.argv.slice(2), { stdio: "inherit" });
} catch (e) {
  process.exit(e.status ?? 1);
}
```

`rules_ts` has an open issue for tsgo support ([#777](https://github.com/aspect-build/rules_ts/issues/777)), but it's not merged. The main concern is that tsgo is a native binary that reads files directly from disk, bypassing Node.js's filesystem virtualization that `rules_ts` relies on. In practice this hasn't been an issue for me. tsgo is statically linked, so it doesn't escape Bazel's regular linux-sandbox to find system libraries. It reads source files from the runfiles tree Bazel provides.

The platform-specific package (`@typescript/native-preview-linux-x64`) is an optional dependency of `@typescript/native-preview`. pnpm with `hoist=false` doesn't always link optional deps where you'd expect, so i added the platform package as an explicit dev dependency. This makes it visible to Bazel's `npm_link_all_packages`.

tsgo is still a dev preview (all versions are `7.0.0-dev.*`). Type-checking is near-complete, but emit support and the compiler API are not. For this setup that doesn't matter, since tsgo only type-checks and Vite handles transpilation.

## Bundling with Vite

Vite uses esbuild internally for TS-to-JS transpilation. esbuild strips the type annotations and transpiles, but doesn't type-check. That's the division of labor: tsgo catches type errors, esbuild transpiles, Vite bundles. Both tsgo and esbuild are written in Go.

The Vite CLI is tricky to reference as a Bazel tool because of path conflicts between the npm-linked directory and the binary entry point. A wrapper that imports `vite` as a module avoids this:

```javascript
// vite_wrapper.mjs
import { build } from "vite";
if (process.argv[2] === "build") {
  await build();
}
```

```starlark
js_binary(
    name = "vite_bin",
    data = [
        ":node_modules/vite",
        ":node_modules/@vitejs/plugin-react",
        ":node_modules/@tailwindcss/vite",
        ":node_modules/tailwindcss",
    ],
    entry_point = "vite_wrapper.mjs",
)

js_run_binary(
    name = "bundle",
    srcs = _SRCS + [
        "index.html",
        "vite.config.ts",
        "vite-env.d.ts",
        "tsconfig.json",
        ":node_modules",
    ] + glob(["public/**"]),
    args = ["build"],
    chdir = package_name(),
    out_dirs = ["dist"],
    tool = ":vite_bin",
)
```

`js_run_binary` runs the Vite build inside Bazel's sandbox. Inputs are declared, outputs go to `dist/`. Bazel hashes the inputs and caches the result. If you change a React component, only the Vite build re-runs. If nothing changed, it's a cache hit.

## The dev server stays outside Bazel

For local development, i run `vite dev` directly via pnpm. Bazel's sandbox adds latency to the feedback loop. Vite gives sub-50ms HMR with native ESM.

Even large monorepos that use Bazel for CI don't route dev servers through it.

```
just frontend    # runs: cd app && pnpm dev
```

## What the build graph looks like

```
proto_library (*.proto)
  → buf generate → .pb.ts files (checked in, not in Bazel)

src/**/*.tsx + src/**/*.ts
  → tsgo (type-check, cached, native Go binary)
  → vite build (transpile + bundle via esbuild, cached) → dist/
```

Proto codegen is still `buf generate`, not a Bazel action. i could use the experimental `js_proto_toolchain` in rules_js to make proto changes automatically trigger frontend rebuilds, but it's marked unstable and `buf generate` works.

## The output

```
dist/
  index.html         0.5 KB
  assets/
    index-xxx.js   594 KB  (gzip: 195 KB)
    index-xxx.css   40 KB  (gzip: 8 KB)
```

One JS bundle, one CSS file. 594 KB for a 3-page dashboard with React, ConnectRPC, and protobuf runtime.

## Switching from Next.js

The migration was mechanical. Every React component transferred as-is. shadcn/ui, Tailwind v4, ConnectRPC, `@react-oauth/google` are all framework-agnostic. The actual changes:

- `next/image` → `<img>`. The images are YouTube thumbnails served by Google's CDN. Local optimization is pointless.
- `next/link` + `next/navigation` → `react-router-dom`. Three routes.
- `next-themes` → a React context that toggles a class on `<html>`. About 20 lines.
- `process.env.NEXT_PUBLIC_*` → `import.meta.env.VITE_*`.
- `"use client"` directives removed everywhere. Vite doesn't have server components.
