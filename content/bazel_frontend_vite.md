---
title: "Frontend builds in Bazel with Vite and rules_js"
date: 2026-03-28T22:00:00+01:00
draft: false
tags: [bazel,vite,react,javascript,rules_js,frontend,tsgo,shadcn]
---

i build my frontends as SPAs with Vite inside a Bazel workspace alongside Go backends. `bazel build //...` builds everything. The output is one JS bundle, one CSS file, and an index.html. The Go server serves it as static files, with `index.html` returned for any path that doesn't match a file on disk (so client-side routing works on refresh).

i don't use Next.js or any SSR framework.

## Why Vite, not Next.js

The frontend runs in the browser. The browser runs JavaScript. So you write JavaScript for the browser and ship it as static files. The backend is Go, serving APIs over ConnectRPC or plain HTTP. Clean separation. The Go server serves the SPA as static files. Done.

Next.js blurs this line on purpose. Server components, server actions, API routes, middleware. It wants to run your React code on a Node.js server, so now you have two server runtimes in production: your actual backend and a Node.js process rendering HTML. The pitch is "better initial page load" and "SEO". For apps behind auth, neither matters. For dashboards, internal tools, AI chat UIs, none of it matters. You're adding a Node.js server to your production stack for nothing.

The whole SSR push is a business model. Vercel sells server compute. Server components need servers. The framework steers you toward their hosting. If you self-host or run on your own infra, SSR is pure overhead.

i write Go for the backend because it compiles to a single static binary, has no runtime dependencies, and handles concurrency well. i'm not going to add a Node.js process next to it so React can render on the server. The browser is perfectly capable of rendering a UI from a JS bundle.

Vite respects this. It's a bundler with no opinions about your app. You pick your router, your data fetching, your state management. It doesn't impose file-based routing or a server runtime. It's just the build step.

For Bazel, this matters. `vite build` reads source files, writes output to `dist/`, and doesn't touch anything else. No `.next/` cache directory, no temp files next to your sources, no build internals that change between major versions. It fits cleanly into Bazel's sandbox: declared inputs in, declared outputs out.

The dev server is fast. Vite serves native ESM and does HMR in under 50ms. Transpilation uses esbuild (a Go binary), so there's no slow TypeScript compiler in the hot path.

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

Vite uses esbuild internally for TS-to-JS transpilation. esbuild strips the type annotations and transpiles, but doesn't type-check. tsgo catches type errors, esbuild transpiles, Vite bundles. Both tsgo and esbuild are written in Go.

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

`js_run_binary` runs the Vite build inside Bazel's sandbox. Inputs are declared, outputs go to `dist/`.

## shadcn/ui with Bazel

### Initial setup

You need a `globals.css` with `@import "tailwindcss"` before running `shadcn init`. Without it, the CLI can't detect Tailwind and fails.

```
pnpm dlx shadcn@latest init --preset b38UEt78C --yes
```

The `--preset` flag applies a complete design system: style, base color, font, icon library, border radius. Preset codes come from [ui.shadcn.com](https://ui.shadcn.com) and are opaque. Never try to decode them manually. Use `pnpm dlx shadcn@latest preset decode <code>` to inspect what a preset configures.

The init command creates `components.json` (project config), installs base dependencies (`radix-ui`, `tailwind-merge`, `class-variance-authority`, etc.), and writes the full theme to `globals.css`. For Vite projects, pass `--template vite` if init doesn't auto-detect the framework.

After init, add components as needed:

```
pnpm dlx shadcn@latest add button card dialog
```

Components land in `src/components/ui/` as source files. Bazel treats them like any other `.tsx` file in the `_SRCS` glob.

### Presets

i use preset `b38UEt78C` which gives Lyra style, stone base color, cyan theme, JetBrains Mono font, phosphor icons, and sharp corners (`--radius: 0`). The preset writes CSS variables to `globals.css` and sets the full config in `components.json`. Both are regular source files that Bazel picks up.

To switch presets on an existing project, use `pnpm dlx shadcn@latest apply <code>`. To inspect the current preset, use `pnpm dlx shadcn@latest preset resolve`.

### Alias resolution

shadcn's `components.json` references paths like `@/components/ui` which resolve through the `@` → `src/` alias in `tsconfig.json` and `vite.config.ts`. This has nothing to do with Bazel. The alias is resolved at transpile time by Vite (dev) and esbuild (production build). Bazel just passes the raw source files to Vite.

### Dependencies

The shadcn CLI installs npm dependencies when you add components (e.g. `radix-ui`, `class-variance-authority`). After adding new components, run `pnpm install` to update the lockfile, then the next `bazel build` picks up the new deps via `npm_translate_lock`.

### The shadcn skill

shadcn has a [skill](https://ui.shadcn.com/docs/skills) for AI coding agents. Install it with:

```
npx skills add shadcn/ui
```

It drops rule files into `.agents/skills/shadcn/` that Claude Code (and other agents) load automatically. The rules enforce shadcn conventions: semantic color tokens instead of raw Tailwind colors, `gap-*` instead of `space-y-*`, `size-*` when width equals height, no manual `dark:` overrides, proper component composition patterns (items inside groups, `FieldGroup` for forms, `asChild` for triggers).

Without the skill, AI agents generate code that looks like shadcn but violates half the conventions. With it, the generated code follows the actual patterns from the shadcn docs. i consider it mandatory for any project using shadcn with AI-assisted development.

## AI Elements and Streamdown

[AI Elements](https://elements.ai-sdk.dev/) is a component registry for AI chat UIs, built on shadcn. Components like Conversation, Message, PromptInput, Tool, Reasoning, and ModelSelector install the same way as shadcn components:

```
pnpm dlx shadcn@latest add @ai-elements/conversation @ai-elements/message @ai-elements/prompt-input
```

They land in `src/components/ai-elements/` as source files. Bazel doesn't care, they're part of the `_SRCS` glob.

One annoyance: AI Elements components ship with `lucide-react` icon imports regardless of what `iconLibrary` is set in `components.json`. If you use phosphor (or tabler, or any other icon library), you need to manually replace the imports after every `shadcn add`. i do this immediately after installing each component.

[Streamdown](https://github.com/vercel/streamdown) renders streaming markdown from LLMs. It replaces `react-markdown` with incremental rendering that doesn't re-parse the entire document on every token. It has plugins for syntax highlighting (`@streamdown/code` via Shiki) and CJK text handling.

Streamdown and its plugins use Tailwind classes internally. For Tailwind's CSS purge to find them, add `@source` directives to your `globals.css`:

```css
@source "../node_modules/streamdown/dist/*.js";
@source "../node_modules/@streamdown/code/dist/*.js";
@source "../node_modules/@streamdown/cjk/dist/*.js";
```

Without these, Streamdown's styling breaks in production builds.

## The dev server stays outside Bazel

For local development, i run `vite dev` directly via pnpm. Bazel's sandbox makes it slow. Vite gives sub-50ms HMR with native ESM.

```
just frontend    # runs: cd app && pnpm dev
```

The Vite dev server proxies API requests to the Go backend:

```typescript
server: {
  port: 3000,
  proxy: {
    "/api": {
      target: "http://localhost:8080",
      changeOrigin: true,
    },
  },
},
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

One JS bundle, one CSS file. The Go server serves this with SPA fallback: hashed assets get `Cache-Control: immutable`, `index.html` gets `no-cache`.

