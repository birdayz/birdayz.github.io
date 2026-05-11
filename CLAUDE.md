# Blog - birdayz.github.io

Personal technical blog. Hugo site.

## Writing tone

No em-dashes (—), use commas, periods, or restructure. Direct, technical, not performative. State facts and opinions flatly. Don't announce what the post will cover. Don't summarize at the end. Don't hedge or qualify. Don't try to be punchy or quotable. Don't balance both sides diplomatically. Just explain the thing and move on.

The reader is a competent engineer. Don't hand-hold, don't reassure ("don't worry about X"), don't over-explain things they'd already know.

### Never use

- Em-dashes (—)
- "Worth noting:", "A note on:", "It's worth mentioning"
- "gotcha", "gotchas"
- "ergonomic", "negligible", "polarizing"
- "This post covers...", "In this post we'll..."
- "Let's dive in", "without further ado"
- Numbered lists for short alternatives (just write prose)
- Staccato punch lines ("One entry. Covers everything.", "Build. Delete. Done.")
- Dramatic closers trying to be quotable
- "The things nobody tells you", "what they don't tell you"
- Hedging: "probably", "arguably", "it could be said"

### Good examples

<good>
i recently added all of staticcheck's SA analyzers to my nogo setup in Bazel. A few things aren't well documented.
</good>

<good>
Therefore, Remote Execution is out of the question for me. I find it also to be pretty wasteful usage of resources, calling a remote server to generate my code, where i could just do it locally.
</good>

<good>
This works really well, and gives us the same experience as go plugins.
</good>

<good>
Like most LinkedIn wisdom, this comes from people who've never actually built and operated a system in production. It sounds smart in a post, gets engagement, and is wrong.
</good>

<good>
The downside is that every intermediate state of your code must be lint-clean. You can't iterate on something that has warnings. i prefer this, it prevents lint debt from piling up.
</good>

### Bad examples

<bad>
When i added staticcheck's 90 SA analyzers to nogo, i ran into three things the docs don't tell you: a config shorthand that eliminates all per-analyzer boilerplate, a path-matching gotcha that silently disables all your analyzers, and a dead-end i wasted time on before finding the right approach.
</bad>
Why: listicle teaser opener, uses "gotcha", announces structure, clickbait framing.

<bad>
One entry. Covers everything.
</bad>
Why: staccato punch line, performative, trying to sound dramatic.

<bad>
128 analyzers, zero CI overhead, and the next bug they catch is free. i'll take that trade.
</bad>
Why: trying to be quotable, constructed closer, LinkedIn energy.

<bad>
Here's the gotcha that cost me real time.
</bad>
Why: uses "gotcha", focuses on "cost me time" instead of explaining the problem.

<bad>
Worth noting: the values are regular expressions, not substring matches.
</bad>
Why: "Worth noting:" is an LLM connector. Just state the fact.

<bad>
nogo's model — lint errors are build errors — is polarizing.
</bad>
Why: em-dash, "polarizing" is abstract editorializing, author states his own position instead.

<bad>
This is probably the biggest ergonomic gap in nogo.
</bad>
Why: hedging with "probably", "ergonomic gap" is LLM vocabulary, author doesn't editorialize in conclusions.

## QA process for blog posts

After writing or editing a post, run tone QA iterations:

1. Launch a tone editor agent that reads the draft AND the author's existing posts (`content/mcp_wrapper_servers.md`, `content/replace_buf_remote_plugins.md`). The agent compares sentence structures, word choices, and patterns against the author's real voice. It returns specific lines that don't match with suggested fixes.

2. Apply the fixes. Then run another iteration on the updated draft.

3. Do 3 iterations. By iteration 3, the agent should find 0-2 issues at most.

Key things the tone agent should check:
- Em-dashes (author never uses them)
- LLM connectors ("Worth noting", "A note on", "It's important to")
- Hedging/qualifiers ("probably", "arguably")
- Summary openers ("This post covers...")
- Hand-holding ("don't worry about X")
- Staccato punch lines and dramatic closers
- Numbered lists where prose would work
- Abstract editorializing ("polarizing", "ergonomic gap")
- "gotcha"/"gotchas"

Optionally, before the tone iterations, run 5 parallel reviewer agents (different personas: SRE, platform eng, backend dev, tech writer, infra eng) to assess technical accuracy, practical value, completeness, writing quality, and originality on a 1-10 scale. Target 9+ on practical value and writing quality. Iterate on feedback until scores stabilize. Then do the tone iterations last.

## Content

Posts go in `content/`. Hugo frontmatter with title, date, draft, tags. Set `draft: true` until explicitly told to publish.

### Frontmatter

The YAML block at the top of each `.md` file:

```yaml
---
title: "Post title"
date: 2026-03-11T22:31:00+01:00
draft: false
tags: [go,bazel]
image: "/img/my-post-og.png"   # optional: OpenGraph preview image for social sharing
---
```

### OpenGraph images

When sharing posts on Reddit, Twitter, LinkedIn etc., the `og:image` meta tag controls the preview image. The theme reads it from the `image` frontmatter field. If not set, falls back to Gravatar (small, looks bad on Reddit).

For each new post, generate an OG preview image after the tone QA process completes.

#### Generation process

1. Take a headless screenshot of the blog homepage (`chromium --headless --screenshot`) as a style reference.

2. Create a generation folder at `static/img/og-gen/` with a prompt markdown file (`og-prompt.md`) and reference images. The prompt should specify:
   - 1200x630 (16:9) social card
   - Deep dark background (#0d1117), like GitHub dark mode
   - Post title as large, bold, centered white text (the dominant element)
   - "Johannes' blog" in readable light gray at the bottom center
   - Teal/cyan (#00d4aa) glowing accent line below the title
   - Background: ghostly, barely-visible code texture from the actual blog post (real code snippets, not hallucinated). Code must be EXTREMELY dim (watermark-level, ~10-15% brightness). The center where the title sits should be clean dark space. Code texture only in the periphery.
   - No logos, no icons, no clip art
   - Strong vignette on edges

3. Use `/generate-with-refs` with the blog screenshot as a reference image. Use `gemini-3-pro-image-preview` model, 2K size, 16:9 aspect.

4. Read the full blog post content and include actual code snippets from the post in the prompt, so the background code is authentic.

#### Review loop

After generation, run a reviewer agent to score the image 1-10 on: readability at thumbnail size, visual appeal, spelling accuracy, background quality (code properly dim, not competing), and overall impression for Reddit/HN. Target 9/10+.

Loop: review → adapt prompt based on feedback → regenerate → review again. Maximum 5 passes or until the reviewer scores 9+. Common issues to watch for:
- Gemini renders code too bright/readable — use extreme language in the prompt ("BARELY VISIBLE", "ALMOST INVISIBLE", "watermark", "ghost") and describe code as texture/atmosphere, not content
- Title not centered or competing with background elements
- Unbalanced composition (one side denser than the other)
- Spelling errors in the title (especially "rules_js" → "rules_jss")

#### Finalize

Copy the winning image to `static/img/<post-slug>-og.png` and add `image: "/img/<post-slug>-og.png"` to the post's frontmatter.
