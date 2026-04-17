# Harness Desktop v2 - Changelog

## v2 Iteration - Three New Features

### 1. Sub Agent (子智能体)

**Files modified:**
- `src/services/subAgentManager.ts` (new) - SubAgent manager service
- `src/App.tsx` - Integration of sub-agent system
- `src/services/contextManager.ts` - Added `mergePointers()` for KV cache sharing
- `src/types/index.ts` - Added SubAgent types

**Features:**
- Main Agent creates sub-agents for complex multi-step tasks
- Sub-agents share KV Cache with parent (avoiding serial execution overhead)
- Task queue with dependency management
- Result aggregation on completion
- Parent-child task state isolation
- Memory eviction when KV Cache exceeds limit

**API:**
```typescript
// Create a sub-agent
const agent = subAgentManager.createAgent('task-name')

// Add tasks with tool calls
subAgentManager.addTask(agent.id, 'description', toolCalls, dependencies)

// Run to completion
const result = await subAgentManager.runAgent(agent.id)

// Share KV cache from parent
subAgentManager.shareKVCacheFromParent(childId, parentId)
```

### 2. Verification Hooks Background Classifier

**Files modified:**
- `src/services/verificationHooks.ts` - Complete rewrite as background classifier
- `src/types/index.ts` - Added VerificationConfig, ValidationResult, VerificationReport types
- `src/App.tsx` - Auto-retry integration
- `src/store/configStore.ts` - Added verification config storage

**Features:**
- Pure background classifier - only reads tool execution results
- Ignores model-generated text (no generation bias)
- Format validation + correctness validation + safety validation
- Configurable levels: `strict`, `loose`, `disabled`
- Auto-retry on failure (configurable max retries)
- Degrade recommendation on repeated failures
- Batch verification support
- Per-tool rule sets (12 tools including v2 tools)

**Configuration:**
```typescript
interface VerificationConfig {
  level: 'strict' | 'loose' | 'disabled'
  autoRetry: boolean
  maxRetries: number
  degradeOnFailure: boolean
}
```

### 3. More Core Tools (v2 Tools)

**Files modified:**
- `src/services/modelAdapters.ts` - Added V2_TOOLS export
- `electron/toolExecutor.ts` - Implemented 4 new tools

**New Tools:**

#### `edit_code`
Apply code modifications using unified diff format
```typescript
{
  file_path: string,      // required
  diff: string,           // required - unified diff
  create_backup: boolean  // optional, default true
}
```

#### `project_tree`
Generate a tree view of project structure
```typescript
{
  root_path?: string,           // defaults to workDir
  max_depth?: number,           // default 5
  include_hidden?: boolean,     // default false
  exclude_patterns?: string[]   // patterns to exclude
}
```

#### `web_search`
Search the web using Brave Search API
```typescript
{
  query: string,      // required
  count?: number,     // 1-10, default 5
  freshness?: string  // pd, pw, pm, py
}
```
Note: Requires `BRAVE_SEARCH_API_KEY` environment variable.

#### `task_plan`
Decompose complex tasks into subtasks
```typescript
{
  task_description: string,  // required
  max_subtasks?: number,      // default 5
  include_dependencies?: boolean  // default true
}
```

## Technical Details

### Architecture
- Sub-agents share KV Cache with parent agent for memory efficiency
- Task queue with dependency resolution (topological sort)
- Verification runs in background after each tool execution
- New tools execute in sandboxed environment

### Memory Management
- KV Cache eviction when exceeding max tokens (keeps 80% after eviction)
- Pointers merged from sub-agents use deduplication by ID
- Completed agents auto-cleanup after configurable timeout

### Verification Flow
1. Tool executes → result returned
2. Background classifier validates result structure
3. If validation fails and autoRetry=true → retry up to maxRetries
4. If still failing and degradeOnFailure=true → recommend degrade
5. Warnings/errors collected and displayed to user
