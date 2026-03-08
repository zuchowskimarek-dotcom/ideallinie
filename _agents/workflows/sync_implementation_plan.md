---
description: Sync an Implementation Plan to Notion (XQDB)
---

# Sync Implementation Plan to Notion

Whenever an Implementation Plan (or Master IPP) is created or updated locally and approved by the user, it MUST be synchronized to the XQDB Notion "Implementation Plans" database, as it is the Single Source of Truth. Local Markdown copies should not be kept permanently.

## Workflow Steps

1. **Read Local Plan**: Use `view_file` to read the completed and approved Implementation Plan from the local workspace.
2. **Locate Notion Page**: Use `mcp_notion_API-post-search` with the plan's exact title (e.g., "Implementation Plan — Track Viewer") to see if it already exists in Notion.
3. **Format Changes**: Convert the Markdown sections into a high-level summary or basic Notion Text Blocks. (For long documents, summarize the architectural changes into paragraph blocks or code blocks).
4. **Request Explicit Approval**: 
   - **MANDATORY**: Adhere strictly to the *NOTION WRITE RULE*.
   - Present a clear summary of the proposed changes to the user.
   - Use `notify_user` (`BlockedOnUser: true`) to request explicit permission to execute the Notion write operations.
5. **Sync to Notion**: 
   - If **New**: Call `mcp_notion_API-post-page` to create a new page in the "Implementation Plans" database with the generated blocks.
   - If **Existing**: Call `mcp_notion_API-patch-block-children` to append the updated sections to the existing page, or use appropriate update/delete tools.
6. **Trigger XQDB Sync**:
   - Use the `xq-docbase` MCP server to trigger synchronization (e.g., calling its sync endpoint or tool) so that XQ-DocBase indexing is up-to-date with your recent changes. Do not try to run an arbitrary terminal command if the MCP server provides this functionality.
7. **Cleanup Local Files**:
// turbo
   - Run a terminal command to delete the local Implementation Plan (e.g., `rm docs/implementation_plan_*.md`) to avoid keeping stale local copies and ensure XQDB remains the single source of truth.
