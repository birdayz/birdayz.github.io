---
title: "Go linting with nogo in Bazel"
date: 2026-03-11T22:31:00+01:00
draft: false
tags: [go,bazel,nogo,staticcheck,linting]
---

i use nogo instead of golangci-lint for Go linting in Bazel. nogo is a [rules_go](https://github.com/bazelbuild/rules_go) feature that compiles Go analyzers into the build. Lint errors become build errors. Bazel caches results per package, so incremental builds only re-lint what changed. golangci-lint has its own cache, but it doesn't share between CI and local, so you duplicate work.

## Setup

You enable nogo in `MODULE.bazel` by pointing `go_sdk.nogo` at a `nogo()` target:

```starlark
go_sdk = use_extension("@rules_go//go:extensions.bzl", "go_sdk")
go_sdk.from_file(go_mod = "//:go.mod")
go_sdk.nogo(nogo = "//:nogo")
```

`go_sdk.from_file` reads the Go version from your `go.mod`, so you don't duplicate it. You can also use `go_sdk.download(version = "1.24.5")` if you want to pin it explicitly.

The `nogo()` rule itself goes in your root `BUILD.bazel`. This applies to all Go targets in the workspace. There's no per-package opt-in, so if you need to roll it out incrementally, `exclude_files` in the config is your only lever. The [official docs](https://github.com/bazelbuild/rules_go/blob/master/go/nogo.rst) cover the basics. Below is what i had to figure out myself.

## Config

### The `_base` key

Most nogo guides show a config where you repeat `only_files` or `exclude_files` for every single analyzer:

```json
{
  "nilness": {
    "only_files": {
      "github\\.com/myorg/myrepo/": ""
    }
  },
  "shadow": {
    "only_files": {
      "github\\.com/myorg/myrepo/": ""
    }
  }
}
```

With 128 analyzers, that's a lot of identical blocks. nogo supports a `_base` key that applies as a default to all analyzers:

```json
{
  "_base": {
    "exclude_files": {
      "external/": "third-party dependencies"
    }
  }
}
```

Per-analyzer entries override `_base`. If you set `only_files` on a specific analyzer, it replaces `_base`'s `only_files` for that analyzer. There's no merging.

The values in `only_files` and `exclude_files` are **regular expressions**, not substring matches. `"external/"` works because `/` isn't special in regex, but if you need precision you can anchor it: `"^external/"`. The `"_test\\.go$"` example later uses an anchor and escaped dot, that's intentional.

This is [documented](https://github.com/bazelbuild/rules_go/blob/master/go/nogo.rst), but most examples i found online still show the per-analyzer duplication.

### Path matching pitfall

The file paths nogo matches against are sandbox-relative paths as seen by the Go compiler, so for your own code that's something like `pkg/mypackage/foo.go`. Third-party deps live under `external/`.

So `exclude_files` with `"external/"` works fine to skip dependencies. But if you try `only_files` with your Go import path like `"github\\.com/myorg/myrepo/"`, it silently matches nothing. All findings get suppressed. No error, no warning. You think everything is clean, but the config is just filtering out all the results.

If you want to verify your setup actually catches things, add a file with a deliberate violation:

```go
package smoketest

func broken() bool {
    x := 1
    return x == x // SA4000: identical expressions
}
```

If the build doesn't fail, your config is wrong.

If you have generated code (proto stubs etc.) under your source tree, add those paths to `exclude_files` too.

## Analyzers

nogo works with any Go analyzer that exports `var Analyzer *analysis.Analyzer`. The stdlib `x/tools` analyzers (`nilness`, `errorsas`, `shadow`, etc.) work out of the box. You can list them with `go list golang.org/x/tools/go/analysis/passes/...`. You add them as deps in your `nogo()` rule:

```starlark
nogo(
    name = "nogo",
    config = "nogo_config.json",
    visibility = ["//visibility:public"],
    deps = [
        # stdlib analyzers (need :go_default_library suffix)
        "@org_golang_x_tools//go/analysis/passes/nilness:go_default_library",
        "@org_golang_x_tools//go/analysis/passes/errorsas:go_default_library",
        # ...
    ],
)
```

Ordering doesn't matter, nogo resolves transitive analyzer dependencies automatically. Gazelle won't touch your `nogo()` rule, it only manages `go_library`/`go_test`/`go_binary` targets.

## Adding staticcheck

There's a community project ([nogo-analyzer](https://github.com/sluongng/nogo-analyzer)) that wraps staticcheck for nogo, but you don't actually need it. Each staticcheck SA package already exports `var Analyzer *analysis.Analyzer`, and nogo's [codegen template](https://github.com/bazel-contrib/rules_go/blob/master/go/tools/builders/generate_nogo_main.go) expects exactly that. It does `{{$import.Name}}.Analyzer` for each dep. So you can reference the SA packages directly, alongside the stdlib analyzers:

```starlark
deps = [
    # stdlib analyzers
    "@org_golang_x_tools//go/analysis/passes/nilness:go_default_library",
    "@org_golang_x_tools//go/analysis/passes/errorsas:go_default_library",
    # ...

    # staticcheck SA analyzers (bare label works)
    "@co_honnef_go_tools//staticcheck/sa1000",
    "@co_honnef_go_tools//staticcheck/sa1001",
    # ... all 95 ...
    "@co_honnef_go_tools//staticcheck/sa9009",
],
```

The `:go_default_library` vs bare label difference is just how gazelle generates BUILD files for each module. The `co_honnef_go_tools` repo name is what gazelle generates from the Go module path `honnef.co/go/tools`, replacing dots and slashes with underscores.

### Getting the deps into Bazel

To make this work with bzlmod:

1. Add `honnef.co/go/tools` to your `go.mod`. Since nothing in your source code actually imports it, `go mod tidy` will drop it. The standard workaround is a `tools.go` with a build tag:

```go
//go:build tools

package tools

import _ "honnef.co/go/tools/staticcheck"
```

The `tools` build tag means this file is never compiled normally, but `go mod tidy` sees the import and keeps the module in `go.mod`.

2. Run `go mod tidy`, then `bazel mod tidy`. The latter updates `use_repo` in `MODULE.bazel`:

```starlark
go_deps = use_extension("@gazelle//:extensions.bzl", "go_deps")
go_deps.from_file(go_mod = "//:go.mod")
use_repo(
    go_deps,
    "co_honnef_go_tools",   # ← added by bazel mod tidy
    # ... your other deps
)
```

No special overrides needed, the module comes in from the `go.mod` entry.

3. Build.

To get the full list of SA packages so you can generate the deps:

```sh
go list honnef.co/go/tools/staticcheck/sa...
```

You can pipe that into sed to generate the Bazel labels:

```sh
go list honnef.co/go/tools/staticcheck/sa... | sed 's|.*/|        "@co_honnef_go_tools//staticcheck/|;s|$|",|'
```

### Version compatibility

staticcheck v0.7.0 requires Go 1.25. If your `go_sdk.download` pins an older version, use v0.6.1 which needs Go 1.23.

### Why a wrapper package doesn't work

My first attempt was a wrapper that exports `var Analyzers []*analysis.Analyzer` (plural), so i'd get one dep and one config entry. It doesn't work because nogo's codegen hard-codes `{{$import.Name}}.Analyzer` (singular). Each dep must export exactly one `*analysis.Analyzer`.

So you end up with 95 dep lines in BUILD.bazel. The `_base` config key keeps the JSON side clean at least.

## Analyzers worth disabling

The first two below are stdlib analyzers from `x/tools`, the rest are staticcheck. They all live in the same `deps` list and config.

**`shadow`** (`x/tools`): flags `err` shadowing in `:=` blocks. In practice this is idiomatic Go and the false positive rate is very high.

**`loopclosure`** (`x/tools`): detects loop variable capture in goroutines. Go 1.22 changed loop variables to per-iteration scoping, so if your module targets 1.22+ this is obsolete.

**`SA1019`**: flags deprecated API usage. Generally useful, but i need to exclude some files that intentionally use deprecated proto fields for wire compatibility.

**`SA5011`**: nil pointer dereference checks. It doesn't understand that `t.Fatal()` terminates the test. `t.Fatal` calls `runtime.Goexit()`, which static analyzers can't track. So after `if x == nil { t.Fatal(...) }`, it still thinks `x` might be nil. i exclude `_test.go` files for this one. (nogo runs analyzers on test files by default.)

The full config looks like this:

```json
{
  "_base": {
    "exclude_files": { "external/": "" }
  },
  "shadow": {
    "only_files": { "DISABLED": "" }
  },
  "loopclosure": {
    "only_files": { "DISABLED": "" }
  },
  "SA1019": {
    "exclude_files": { "metadata_proto": "" }
  },
  "SA5011": {
    "exclude_files": { "_test\\.go$": "" }
  }
}
```

The JSON key must match the analyzer's `Name` field. For staticcheck that's the uppercase code (`SA1019`, `SA5011`), for stdlib analyzers it's the lowercase package name (`nilness`, `shadow`). If the key doesn't match, nogo silently ignores it.

The `"only_files": { "DISABLED": "" }` pattern is a hack. No file path matches "DISABLED", so the analyzer never runs. There's no official disable mechanism in nogo config. The cleaner alternative is removing the analyzer from `deps` entirely, but then you can't re-enable it by just editing the JSON.

## No inline suppression

If you're coming from golangci-lint: there is no `//nolint:SA4006` equivalent. nogo doesn't support inline suppression comments. Your only options are `exclude_files` for that file, removing the analyzer from `deps` entirely, or restructuring the code so the analyzer doesn't fire.

## Lint errors as build errors

nogo makes lint errors into build errors. On my codebase, adding 95 staticcheck analyzers on top of 33 stdlib ones added about 7 seconds to a ~45 second clean build. Incremental builds saw no difference because Bazel only re-analyzes changed packages.

The downside is that every intermediate state of your code must be lint-clean. You can't iterate on something that has warnings. i prefer this, it prevents lint debt from piling up.

If you want linter caching without the "lint = build failure" model, [Aspect's rules_lint](https://github.com/aspect-build/rules_lint) runs them as separate actions.
