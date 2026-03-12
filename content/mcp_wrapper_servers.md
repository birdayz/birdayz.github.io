---
title: "DO write wrapper MCP servers"
date: 2026-01-18T14:00:00+01:00
draft: true
tags: [mcp,llm,agents,ai]
---

There's advice floating around LinkedIn: don't create MCP servers that are just API wrappers. Instead, bake multi-call workflows into your MCP tools.

For example, [this post](https://www.linkedin.com/posts/ruchirpjha_i-see-two-types-of-mcp-servers-out-there-activity-7386409852178374656-ln9l) distinguishes between "API Wrappers" (called "the halfway point between the old world and the new") and "Workflow Wrappers" (called "the ushers of the new world"). The implication: API wrappers are the inferior, transitional approach.

Like most LinkedIn wisdom, this comes from people who've never actually built and operated a system in production. It sounds smart in a post, gets engagement, and is wrong.

## The problem they're solving is real

Yes, tool descriptions matter. You want control over your agent's capabilities, hand-picking tools with good descriptions. Fine.

And yes, sequential tool calls are slow and expensive. LLM calls tool A, waits for response, calls tool B with that data, waits again. Token waste, latency, context bloat. These are real problems.

So they say: bake the workflow into the tool. One call, done.

## But the solution is completely backwards

MCP servers are **tools**, not workflow engines. That's the whole point. They expose capabilities. The workflow belongs to the LLM.

We **want** the LLM to own the workflow, because:
1. It can adapt when requirements change
2. It improves over time (free lunch from smarter models - yes, i know the No Free Lunch theorem says you can't have a general solution that beats specialized ones, but here we DO want a free lunch, and we're getting it)
3. It understands the actual problem better than your pre-baked workflow anticipated

And if you DO need hard constraints on workflows - loops, approval gates, whatever - you impose them at the **agent level**, not the MCP server. The agent orchestrates. The MCP server just exposes tools. Mixing these concerns is bad architecture.

Think about it: coding agents are software engineers now. What does a software engineer need? Access to the API. Not some intermediary that pre-chews their food based on assumptions about what they're trying to do.

A human engineer doesn't want your "helpful" abstraction layer. They want the API docs and raw access. Then they write the glue code themselves, because they understand the actual problem better than you anticipated.

LLM agents are the same now. Claude, GPT-4 - they read API specs, generate orchestration code on the fly, handle edge cases, retry logic, error handling. In milliseconds. The code generation cost is negligible. They're smart enough to quickly generate whatever code is needed.

The workflow-baking crowd is treating the LLM like a dumb dispatcher that can only pick from a menu. That was maybe true in 2023. It's not true anymore. But i guess the LinkedIn thought leaders haven't actually tried it.

## The actual solution

The token waste problem is real. But there's already an answer: a tool that lets the LLM write code to invoke tool chains.

Anthropic published exactly this: [Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp). Results: 98.7% reduction in token usage (150K down to 2K), 60% faster execution.

Instead of LLM calling tools one by one with roundtrips, it writes code that orchestrates tools A, B, C in one go. The code executes in a runtime. Only the final result returns to context.

The LLM keeps full agency. It decides the orchestration. But intermediate data never bloats the context.

Implementation isn't hard - embed a JS interpreter (goja, quickjs, whatever) and expose your tools as callable functions. The LLM writes the glue.

<!-- TODO: add goja code example -->

And generally, we don't even need MCP for this. The tool can just work with other tools directly. It's somewhat SDK dependent, but fine.

A note on MCP: there's probably MCP maximalists who think MCP can do more. Maybe it can. But i see MCP as just one way to expose tools. Lots of agents don't even use MCP - they use function calling that bridges to OpenAPI or protobuf, or just... normal functions. Functions that do stuff. MCP is a tool interface, nothing more. Treat it as such.

## Don't gatekeep

It's important to give all the power to the LLM to decide. Don't gatekeep. Don't be like IT departments who think they know how you're supposed to work. The same applies to you and the LLM. Yes, you oversee, but you don't block it - because blocking loses some of its intelligence.

The irony is that workflow-baking creates more work for you. Now you maintain N bespoke workflow tools instead of 1 thin wrapper + code execution. Every time requirements change, you're back editing MCP server code. Meanwhile, the agent could have just adapted.

Let them do their job.
