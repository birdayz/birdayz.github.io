---
title: "Replace Buf Remote Plugins with local vendored plugins"
date: 2024-12-08T22:34:00+01:00
draft: false
tags: [proto,protobuf,go,bun,buf]
---

Buf is the best tool to manage protobufs. One of the biggest pain points of protobuf is the management of protoc plugins. You need to manage them, and make them available to other engineers working on the same repository/project. Versions need to be centrally managed, code generation must produce the same result, no matter if it happens on an engineer A or B's machine, or in CI.

This becomes even more challenging, as protoc plugins are written in different programming languages. Go protoc plugins are written in Go, and are therefore compiling to a single binary without dependencies. Easy. However, other plugins are more difficult to manage. Typescript plugins like [protoc-gen-es](https://github.com/bufbuild/protobuf-es) are written in Typescript, and therefore do not compile to a single binary.

## Remote Plugins to the rescue?

Buf solves this problem with [Remote Plugins](https://buf.build/plugins). Instead of running the plugin on your computer, Buf transmits the proto descriptors to Buf's servers, and receives generated code in return.
There are a few problems with remote plugins though. 

- You'll send your descriptors to Buf's servers, and you may not want to do this.
- Buf introduced [Rate Limits to Remote Plugins](https://buf.build/docs/bsr/rate-limits/). 
- It's slower than local execution.

Therefore, Remote Execution is out of the question for me. I find it also to be pretty wasteful usage of resources, calling a remote server to generate my code, where i could just do it locally.

## Local Go plugins

Go plugins are easy to vendor, Buf even has an example in their [configuration reference](https://buf.build/docs/configuration/v2/buf-gen-yaml/?h=go+run). We can simple use go run to automatically download, install and run a specific plugin version. This works with all go applications.

```yaml
version: v2
managed:
  enabled: true
  override:
    - file_option: go_package_prefix
      value: github.com/birdayz/buf-local-plugin-vendoring/proto/gen/go
plugins:
  - local:
      - go
      - run
      - google.golang.org/protobuf/cmd/protoc-gen-go@v1.35.2
    out: proto/gen/go
    opt: paths=source_relative
```

Go run will just download, compile and run it in a single command - it behaves like running the executable.
This approach is also great if you have protoc plugins in your repository, and want to "just" use them, without the hassle of versioning or releasing them separately (e.g. monorepo setups).

## Local Javascript plugins

Most Javascript plugins are also written in Javascript. This makes it a bit harder to do the same.
We will use `protoc-gen-es` as example.

Install via npm:

```shell
npm install @bufbuild/protoc-gen-es@2.2.2
```

This installs the plugin into the `node_modules` folder, just like ordinary dependencies managed by node.
The application can be executed like this:
```shell
./node_modules/@bufbuild/protoc-gen-es/bin/protoc-gen-es --version
```

It can be used in buf.gen.yaml:

```yaml
...
plugins:
  - local: ./node_modules/@bufbuild/protoc-gen-es/bin/protoc-gen-es
    out: proto/gen/ts
    opt: paths=source_relative
```

It's also possible to just add `./node_modules/@bufbuild/protoc-gen-es/bin` to PATH, but it's not as good as in go. Go puts all installed binaries into `$GOPATH/bin`, however `npm` installs every module into a different directory. To make matters even worse, the path for executables is not standardized. Some apps place their executable(s) into the module's `bin/` folder, some others just place it directly in `./` (within node_modules, e.g. `./node_modules/@bufbuild/protoc-gen-es/bin`. This makes it annoying to manage, you'll need to add all these to PATH.

To make it simpler, i've started exploring usage of the package manager directly to run the app. `npm` can't do it, but `npx` can (it's part of npm).

```yaml
  - local:
      - "npx"
      - "@bufbuild/protoc-gen-es@2.2.2"
    out: proto/gen/ts
```

This works. However, i had issues with concurrent invocations of `npx`. The cache directory in `$NPM_CACHR_DIR/_npx` got corrupted by concurrent invocations of `npx` - buf may do that.

I've tried out another package manager that is on the rise, `bun`. While i am not a fan of jumping at new runtimes quickly, i find it acceptable to use it for packaging and running tools.

```yaml
  - local:
      - "bun"
      - "x"
      - "@bufbuild/protoc-gen-es@2.2.2"
    out: proto/gen/ts
```

This works really well, and gives us the same experience as go plugins.

You can find the complete example on [GitHub](https://github.com/birdayz/buf-local-plugin-vendoring).
