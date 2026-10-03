# Risha Claude plugin

This repository is the public Claude plugin integration. Preserve other Risha repositories and the original screenplay files.

- Claude writes creative content; the bundled local MCP assembles, validates and revises supplied TRF JSON.
- No filesystem reads/writes, external fetches, telemetry, inference calls or account access from MCP tools.
- Preserve IDs, unknown metadata and marks. Revisions return a new document; reject edits to locked production/revision or omitted material.
- Do not include credentials, workspace paths, real screenplay text, local artifacts, account configs, private policies or proprietary Risha application files in published Git files or ZIPs.
- Distribution includes the bundled MCP runtime and its third-party license notices. Users do not run npm installation scripts to use the plugin.
- Validate the Claude plugin manifest and marketplace, and test the actual bundled stdio lifecycle before release.
- GitHub publication is authorized by the owner. Official Anthropic directory submission and acceptance are separate; do not claim approval without evidence.
