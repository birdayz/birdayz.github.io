---
title: "Replace buf Remote Plugins with local, vendored plugins"
date: 2024-12-05T21:23:00+02:00
draft: false
tags: [proto,protobuf,go,bun,buf]
---

Buf is the best tool to manage protobufs. We love buf. One of the biggest pain points of protobuf was the management of protoc plugins. You need to manage them, and make them available to other engineers within the team. Versions need to be centrally managed, code generation must produce the same result, no matter if it happens on an engineer A or B's machine, or in CI.

This becomes even more challenging, as protoc plugins are written in different programming languages. Go protoc plugins are written in Go, and are therefore compiling to a single binary without dependencies. Easy.

However, other plugins are more problematic. Typescript plugins like [protoc-gen-es](https://github.com/bufbuild/protobuf-es) are written in Typescript, and therefore do not compile to a single binary.

## Remote Plugins to the rescue?

Buf solves this problem with [Remote Plugins](https://buf.build/plugins). Instead of running the plugin on your computer, buf transmits the proto descriptors to buf's servers, and receives generated code in return.
There are a few problems with remote plugins though. 

- You'll send your descriptors to buf's servers, and you may not want to do this.
- Buf introduced [Rate Limits to Remote Plugins](https://buf.build/docs/bsr/rate-limits/). 
- It's slower than local execution

Therefore, Remote Execution is out of the question for me. I find it also pretty wasteful spend of resources, to call a remote server to generate my code, where i could just do it locally.

## Local go plugins

Go plugins are easy to vendor, buf even has an example in their [configuration reference](https://buf.build/docs/configuration/v2/buf-gen-yaml/?h=go+run). We can simple use go run to automatically download, install and run a specific plugin version. This works with all go applications.

```yaml

```
