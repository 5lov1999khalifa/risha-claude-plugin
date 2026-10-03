# Risha Screenwriting for Claude

[العربية](README.md)

A plugin by Risha Studio for drafting Arabic or English screenplays in Claude and preparing `.trf` projects for Risha Screenwriting. Start from an idea, format supplied text, validate a complete Risha project, or revise selected dialogue while preserving the rest of the project.

Claude writes the creative text. Risha's tools assemble, validate and return revised projects. Structural validation does not certify story quality or industry approval, and this package does not imply Anthropic directory approval.

## Install in Claude Code

You need **Claude Code** and **Node.js 22 or later** available to the application. The distributed server runs locally without inference keys, a Risha account or an npm installation script.

The plugin is available in [Risha's public GitHub repository](https://github.com/5lov1999khalifa/risha-claude-plugin). Installation from that repository and the tool connection have been verified in Claude Code:

```text
claude plugin marketplace add 5lov1999khalifa/risha-claude-plugin
claude plugin install risha-screenwriting@risha-studio
```

Start a new Claude Code session and use:

```text
/risha-screenwriting:screenplay
```

To try a local copy for one session, run `claude --plugin-dir .` from the plugin root. Installation downloads the source from GitHub. Some Claude Code versions may also install development dependencies from the npm registry because the source includes package files; the runtime ZIP omits those files, and the bundled server does not require those downloads to run. Screenplay tools themselves compute locally without contacting inference services or external accounts. [Official installation guide](https://code.claude.com/docs/en/discover-plugins).

## Use

- **Draft:** “Write a two-scene short film about a brother and sister reconciling. Use Arabic action and Emirati dialogue, and save a new .trf file.”
- **Format:** “Prepare a new Risha file from this supplied text, preserving its events and dialogue.”
- **Validate:** “Check this Risha project without modifying it and explain any errors.”
- **Revise:** “Open the Risha file I selected, revise only the dialogue in scene two and save a new copy.”

Supply the complete project or explicitly select its file. The plugin does not search your folders. Ask to save a new file and specify its destination when you want one; Claude uses its own file tools and permissions because Risha's tools do not write to disk.

## Platform support

| Surface | This package |
| --- | --- |
| Claude Code | Skill and bundled local server, with Node.js 22+ |
| Desktop Cowork | Local servers are supported when the session runs on your computer; this package still needs an actual Cowork test and Node in its execution environment |
| Claude web/mobile chat | The skill may load, but the local stdio server is ignored; Risha validation and file preparation are unavailable from this package alone |

The Claude UI offers **Customize → Plugins → Add → Add marketplace**, or **Add → Upload plugin** for a ZIP. A command-line Claude Code install remains on that machine; it does not install the plugin on your Claude account. Cowork and chat have not yet been verified for this package. Tool support in chat requires a public HTTPS MCP server and connection, which this local package does not include. [Official platform support](https://claude.com/docs/plugins/platform-support).

## Data and limits

Claude starts the bundled Node program and communicates over stdio. The tools process only the screenplay material sent in each call. They do not read project files, store projects, log their contents, fetch URLs or access Risha accounts. The plugin includes no hooks, usage telemetry or payments. Conversations and tool results remain subject to Claude's account settings and Anthropic policies; local tool processing does not make the Claude model or conversation storage local.

Tools require complete **TRF v1 JSON**. The package has no PDF, DOCX or Final Draft parser and does not reproduce exact printed pagination. Limits are 200 scenes, 10,000 blocks and 1 MiB of project JSON. Revisions change existing paragraph text and return a complete copy; insertion, deletion, reordering and locked production revisions belong in the Risha editor. The integration does not synchronize or publish projects.

## Directory submission

A public GitHub marketplace distributes this plugin independently. Anthropic directory listing is a separate submission, review and publication process. This package has not been submitted to or approved by that directory. [Submission preparation](docs/DIRECTORY-SUBMISSION-AR.md).

Verification: installation from GitHub and the MCP connection passed in an isolated Claude Code configuration; all eight bundled-server tests passed. This does not establish Cowork, chat, or directory approval. [Verification record in Arabic](docs/VERIFICATION-AR.md).

Website: [Risha Studio](https://rishastudio.com/).
