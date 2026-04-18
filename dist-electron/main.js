"use strict";const c=require("electron"),p=require("path"),I=require("url"),m=require("fs"),W=require("child_process"),q=require("electron-store"),g=require("electron-log");var P=typeof document<"u"?document.currentScript:null;class ${constructor(e){this.sandbox=e}async execute(e,t){console.log(`[ToolExecutor] Executing tool: ${e}`,t);try{switch(e){case"file_read":return await this.file_read(t);case"file_write":return await this.file_write(t);case"file_append":return await this.file_append(t);case"dir_list":return await this.dir_list(t);case"bash_execute":return await this.bash_execute(t);case"grep_search":return await this.grep_search(t);case"glob":return await this.glob(t);case"tool_status":return await this.tool_status(t);case"edit_code":return await this.edit_code(t);case"project_tree":return await this.project_tree(t);case"web_search":return await this.web_search(t);case"task_plan":return await this.task_plan(t);default:return{success:!1,error:`Unknown tool: ${e}`}}}catch(s){return console.error(`[ToolExecutor] Error executing ${e}:`,s),{success:!1,error:s.message}}}async file_read(e){const{file_path:t}=e;if(!t)return{success:!1,error:"file_path is required"};const s=this.sandbox.validatePath(t);if(!s.valid)return{success:!1,error:s.error};try{const r=await m.promises.readFile(s.resolved,"utf-8"),i=await m.promises.stat(s.resolved);return{success:!0,result:{content:r,lines:r.split(`
`).length,size:i.size,path:s.resolved}}}catch(r){return{success:!1,error:r.message}}}async file_write(e){const{file_path:t,content:s}=e;if(!t||s===void 0)return{success:!1,error:"file_path and content are required"};const r=this.sandbox.validatePath(t);if(!r.valid)return{success:!1,error:r.error};try{const i=p.dirname(r.resolved);await m.promises.mkdir(i,{recursive:!0}),await m.promises.writeFile(r.resolved,s,"utf-8");const o=await m.promises.stat(r.resolved);return{success:!0,result:{path:r.resolved,bytesWritten:o.size,lines:s.split(`
`).length}}}catch(i){return{success:!1,error:i.message}}}async file_append(e){const{file_path:t,content:s}=e;if(!t||s===void 0)return{success:!1,error:"file_path and content are required"};const r=this.sandbox.validatePath(t);if(!r.valid)return{success:!1,error:r.error};try{await m.promises.appendFile(r.resolved,s,"utf-8");const i=await m.promises.stat(r.resolved);return{success:!0,result:{path:r.resolved,totalBytes:i.size}}}catch(i){return{success:!1,error:i.message}}}async dir_list(e){const{dir_path:t,recursive:s}=e,r=t||this.sandbox.getWorkDir(),i=this.sandbox.validatePath(r);if(!i.valid)return{success:!1,error:i.error};try{const o=await m.promises.readdir(r,{withFileTypes:!0}),a=[];for(const l of o)if(a.push({name:l.name,type:l.isDirectory()?"directory":"file",path:p.join(r,l.name)}),s&&l.isDirectory()){const d=await this.dir_listRecursive(p.join(r,l.name),2);a.push(...d)}return{success:!0,result:a}}catch(o){return{success:!1,error:o.message}}}async dir_listRecursive(e,t,s=0){if(s>=t)return[];const r=[];try{const i=await m.promises.readdir(e,{withFileTypes:!0});for(const o of i)if(r.push({name:o.name,type:o.isDirectory()?"directory":"file",path:p.join(e,o.name)}),o.isDirectory()){const a=await this.dir_listRecursive(p.join(e,o.name),t,s+1);r.push(...a)}}catch{}return r}async bash_execute(e){const{command:t,timeout:s}=e;if(!t)return{success:!1,error:"command is required"};const r=this.sandbox.validateCommand(t);if(!r.valid)return{success:!1,error:r.error};try{const i=await this.sandbox.executeCommand(t,s||3e4);return{success:i.exitCode===0,result:{stdout:i.stdout,stderr:i.stderr,exitCode:i.exitCode,timedOut:i.timedOut}}}catch(i){return{success:!1,error:i.message}}}async grep_search(e){var i;const{pattern:t,file_path:s,case_sensitive:r}=e;if(!t)return{success:!1,error:"pattern is required"};try{const o=s?(i=this.sandbox.validatePath(s))==null?void 0:i.resolved:this.sandbox.getWorkDir(),a=this.sandbox.validatePath(o);if(!a.valid)return{success:!1,error:a.error};const l=[];return await this.grepRecursive(o,t,r!==!1,l),{success:!0,result:{matches:l,total:l.length}}}catch(o){return{success:!1,error:o.message}}}async grepRecursive(e,t,s,r,i=3){try{const o=await m.promises.readdir(e,{withFileTypes:!0}),a=new RegExp(t,s?"g":"gi");for(const l of o)if(l.isDirectory())i>0&&await this.grepRecursive(p.join(e,l.name),t,s,r,i-1);else if(l.isFile())try{(await m.promises.readFile(p.join(e,l.name),"utf-8")).split(`
`).forEach((f,y)=>{a.test(f)&&r.push({file:p.join(e,l.name),line:y+1,content:f.trim()})})}catch{}}catch{}}async glob(e){const{pattern:t}=e;if(!t)return{success:!1,error:"pattern is required"};try{const s=this.sandbox.getWorkDir(),r=t.replace(/\./g,"\\.").replace(/\*\*/g,"{{GLOBSTAR}}").replace(/\*/g,"[^/]*").replace(/{{GLOBSTAR}}/g,".*").replace(/\?/g,"."),i=new RegExp(`^${r}$`,"i"),o=[];return await this.globRecursive(s,i,o),{success:!0,result:{matches:o,total:o.length}}}catch(s){return{success:!1,error:s.message}}}async globRecursive(e,t,s,r=5,i=0){if(!(i>r))try{const o=await m.promises.readdir(e,{withFileTypes:!0});for(const a of o)t.test(a.name)&&s.push(p.join(e,a.name)),a.isDirectory()&&await this.globRecursive(p.join(e,a.name),t,s,r,i+1)}catch{}}async tool_status(e){return{success:!0,result:{sandbox:this.sandbox.getStatus(),timestamp:new Date().toISOString(),tools:["file_read","file_write","file_append","dir_list","bash_execute","grep_search","glob","tool_status","edit_code","project_tree","web_search","task_plan"]}}}async edit_code(e){const{file_path:t,diff:s,create_backup:r}=e;if(!t||!s)return{success:!1,error:"file_path and diff are required"};const i=this.sandbox.validatePath(t);if(!i.valid)return{success:!1,error:i.error};try{if(r!==!1){const d=i.resolved+".bak";await m.promises.copyFile(i.resolved,d)}const o=await m.promises.readFile(i.resolved,"utf-8"),a=this.applyUnifiedDiff(o,s);await m.promises.writeFile(i.resolved,a,"utf-8");const l=(s.match(/^@@/gm)||[]).length;return{success:!0,result:{path:i.resolved,applied:l,patches:l}}}catch(o){return{success:!1,error:o.message}}}applyUnifiedDiff(e,t){const s=e.split(`
`),r=t.split(`
`),i=[];let o=0;for(;o<r.length;){const d=r[o].match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);if(d){const h={oldStart:parseInt(d[1],10)-1,oldCount:parseInt(d[2]||"1",10),newStart:parseInt(d[3],10)-1,newCount:parseInt(d[4]||"1",10),changes:[]};for(o++;o<r.length&&!r[o].startsWith("@@");){const f=r[o];f.startsWith("-")?h.changes.push({type:"delete",content:f.slice(1)}):f.startsWith("+")?h.changes.push({type:"add",content:f.slice(1)}):(f.startsWith(" ")||f==="")&&h.changes.push({type:"keep",content:f.slice(1)}),o++}i.push(h)}else o++}let a=[...s];for(let l=i.length-1;l>=0;l--){const d=i[l];let h=d.oldStart;const f=[];for(const y of d.changes)y.type==="keep"?(h<a.length&&f.push(a[h]),h++):y.type==="add"&&f.push(y.content);a.splice(d.oldStart,d.oldCount,...f)}return a.join(`
`)}async project_tree(e){const{root_path:t,max_depth:s,include_hidden:r,exclude_patterns:i}=e,o=t||this.sandbox.getWorkDir(),a=s??5,l=r??!1,d=i||["node_modules",".git","dist","build","__pycache__"],h=this.sandbox.validatePath(o);if(!h.valid)return{success:!1,error:h.error};try{const f=await this.buildTree(h.resolved,a,l,d,0);let y=0,k=0;const _=E=>{var T;E.type==="file"?y++:k++,(T=E.children)==null||T.forEach(_)};return _(f),{success:!0,result:{tree:f,files:y,directories:k,depth:a}}}catch(f){return{success:!1,error:f.message}}}async buildTree(e,t,s,r,i){const a={name:p.basename(e),type:"directory",path:e,children:[]};if(i>=t)return a;try{const l=await m.promises.readdir(e,{withFileTypes:!0});for(const d of l){if(!s&&d.name.startsWith(".")||r.some(f=>this.matchGlob(d.name,f)))continue;const h=p.join(e,d.name);if(d.isDirectory()){const f=await this.buildTree(h,t,s,r,i+1);a.children.push(f)}else a.children.push({name:d.name,type:"file",path:h})}}catch{}return a}matchGlob(e,t){if(t==="*")return e.includes(".");if(t.startsWith("*.")){const s=t.slice(1);return e.endsWith(s)}return e===t||e.includes(t)}async web_search(e){const{query:t,count:s,freshness:r}=e;if(!t)return{success:!1,error:"query is required"};const i=process.env.BRAVE_SEARCH_API_KEY||"";if(!i)return{success:!1,error:"Brave Search API key not configured. Set BRAVE_SEARCH_API_KEY environment variable."};try{const o=new URLSearchParams({q:t,count:String(s||5)});r&&o.set("freshness",r);const a=await fetch(`https://api.search.brave.com/res/v1/web/search?${o}`,{headers:{Accept:"application/json","X-Subscription-Token":i}});if(!a.ok){const h=await a.text();return{success:!1,error:`Brave Search API error: ${a.status} ${h}`}}const d=((await a.json()).results||[]).map(h=>({title:h.title,url:h.url,description:h.description,pageAge:h.page_age}));return{success:!0,result:{query:t,results:d,total:d.length}}}catch(o){return{success:!1,error:o.message}}}async task_plan(e){const{task_description:t,max_subtasks:s,include_dependencies:r}=e;if(!t)return{success:!1,error:"task_description is required"};const i=s||5,o=r!==!1;try{const a=this.decomposeTask(t,i,o);return{success:!0,result:{originalTask:t,tasks:a,totalTasks:a.length}}}catch(a){return{success:!1,error:a.message}}}decomposeTask(e,t,s){const r=e.toLowerCase(),i=[];let o=1;return(r.includes("read")||r.includes("analyze")||r.includes("review"))&&(i.push({id:String(o++),description:"Read/analyze source files",toolCalls:[{name:"dir_list",arguments:{recursive:!0}}],dependencies:[]}),(r.includes("code")||r.includes("function"))&&i.push({id:String(o++),description:"Extract relevant code sections",toolCalls:[{name:"grep_search",arguments:{pattern:"function|class|const|let"}}],dependencies:["1"]})),(r.includes("create")||r.includes("write")||r.includes("generate"))&&(i.push({id:String(o++),description:"Plan file structure",toolCalls:[{name:"project_tree",arguments:{}}],dependencies:[]}),i.push({id:String(o++),description:"Write/Update files",toolCalls:[{name:"file_write",arguments:{file_path:"",content:""}}],dependencies:[String(o-2)]})),(r.includes("build")||r.includes("compile")||r.includes("run"))&&i.push({id:String(o++),description:"Execute build/run command",toolCalls:[{name:"bash_execute",arguments:{command:""}}],dependencies:[]}),r.includes("test")&&i.push({id:String(o++),description:"Run tests",toolCalls:[{name:"bash_execute",arguments:{command:"npm test"}}],dependencies:[]}),(r.includes("deploy")||r.includes("release"))&&i.push({id:String(o++),description:"Prepare deployment",toolCalls:[{name:"bash_execute",arguments:{command:""}}],dependencies:[]}),i.length===0&&i.push({id:"1",description:e,toolCalls:[{name:"bash_execute",arguments:{command:`echo "Task: ${e}"`}}],dependencies:[]}),i.slice(0,t)}}class M{constructor(e,t,s){if(this.initialized=!0,this.workDir=e,this.dangerousCommands=t,this.allowedExtensions=s,!m.existsSync(this.workDir))try{m.mkdirSync(this.workDir,{recursive:!0})}catch(r){console.error("[SandboxManager] Failed to create work dir:",r),this.initialized=!1}}getWorkDir(){return this.workDir}getStatus(){return{initialized:this.initialized,workDir:this.workDir,dangerousCommandsCount:this.dangerousCommands.length}}validatePath(e){try{const t=p.isAbsolute(e)?p.resolve(e):p.resolve(this.workDir,e);if(!t.startsWith(this.workDir))return{valid:!1,error:`Path "${e}" is outside the allowed working directory`};const s=p.extname(e).toLowerCase();return s&&!this.allowedExtensions.includes(s)?{valid:!1,error:`File extension "${s}" is not allowed. Allowed: ${this.allowedExtensions.join(", ")}`}:{valid:!0,resolved:t}}catch(t){return{valid:!1,error:t.message}}}validateCommand(e){const t=e.toLowerCase().trim();for(const r of this.dangerousCommands)if(t.includes(r.toLowerCase()))return{valid:!1,error:`Command contains forbidden pattern: "${r}"`};const s=["curl ","wget ","nc ","netcat ","ssh ","telnet "];for(const r of s)if(t.includes(r))return{valid:!1,error:`Network commands are not allowed in sandbox: "${r.trim()}"`};return(t.includes("cd ..")||t.includes("cd../"))&&!t.includes(this.workDir)?{valid:!1,error:"Cannot navigate outside working directory"}:{valid:!0}}async executeCommand(e,t=3e4){return new Promise(s=>{var y,k;const r=process.platform==="win32";let i,o;r?(i="cmd.exe",o=["/c",`chcp 65066 >nul 2>&1 && ${e}`]):(i="/bin/sh",o=["-c",e]);const a=W.spawn(i,o,{cwd:this.workDir,env:{...process.env,HOME:this.workDir,TMPDIR:this.workDir},timeout:t,windowsHide:!0});let l="",d="",h=!1;(y=a.stdout)==null||y.on("data",_=>{l+=_.toString("utf8")}),(k=a.stderr)==null||k.on("data",_=>{d+=_.toString("utf8")});const f=setTimeout(()=>{h=!0,a.kill("SIGTERM")},t);a.on("close",_=>{clearTimeout(f),s({stdout:l.slice(0,5e4),stderr:d.slice(0,1e4),exitCode:_||0,timedOut:h})}),a.on("error",_=>{clearTimeout(f),s({stdout:l,stderr:d+_.message,exitCode:1,timedOut:h})})})}updateWorkDir(e){this.workDir=e}}class L{constructor(){this.fixedPrompt="",this.loadFixedPrompt()}loadFixedPrompt(){this.fixedPrompt=`You are Harness Desktop, an AI programming assistant built on the Harness Engineering architecture.

## Core Principles
- You are a tool-augmented programmer, not just a chatbot
- Always use tools to verify information before responding
- Break down complex tasks into clear, executable steps
- Be explicit about uncertainty and potential risks

## Tool Schema
You have access to the following tools. Always use the appropriate tool for the task.

### file_read
Read the contents of a file.
Arguments: { "file_path": string }
Returns: { "content": string, "lines": number, "size": number }

### file_write
Write or overwrite a file with new content.
Arguments: { "file_path": string, "content": string }
Returns: { "path": string, "bytesWritten": number }

### file_append
Append content to the end of a file.
Arguments: { "file_path": string, "content": string }
Returns: { "path": string, "totalBytes": number }

### dir_list
List directory contents.
Arguments: { "dir_path"?: string, "recursive"?: boolean }
Returns: Array of { "name": string, "type": "file"|"directory", "path": string }

### bash_execute
Execute a bash/shell command in a sandboxed environment.
Arguments: { "command": string, "timeout"?: number }
Returns: { "stdout": string, "stderr": string, "exitCode": number, "timedOut": boolean }
WARNING: This is a HIGH RISK operation. Network access is blocked.

### grep_search
Search for a pattern in files.
Arguments: { "pattern": string, "file_path"?: string, "case_sensitive"?: boolean }
Returns: { "matches": Array<{ "file": string, "line": number, "content": string }>, "total": number }

### glob
Find files matching a glob pattern.
Arguments: { "pattern": string }
Returns: { "matches": string[], "total": number }

### tool_status
Check the status of tool execution environment.
Arguments: {}
Returns: { "sandbox": object, "timestamp": string, "tools": string[] }

## Risk Levels
- **LOW**: Read-only operations (file_read, dir_list, grep_search, glob, tool_status) - Always allowed
- **MEDIUM**: Write operations (file_write, file_append) - Require user confirmation in planning mode
- **HIGH**: Command execution (bash_execute) - Requires explicit user approval

## Output Format
When responding to user requests, use the following format:

### For simple queries:
Provide a direct, helpful response integrating tool results naturally.

### For task completion:
1. Summarize what was accomplished
2. List any files modified or created
3. Note any warnings or issues encountered
4. Suggest next steps if relevant

### For planning mode responses:
When the user requests a complex task, respond with:
<PLAN>
## Task Analysis
[Brief description of the task]

## Execution Steps
1. [Step description] - Tool: [tool_name]
2. ...

## Risk Assessment
- [List potential risks]

## Estimated Steps
[X] steps required
</PLAN>

## Context Management
- Context is managed using pointer indices
- Each interaction adds to the context with a unique pointer
- When context exceeds limits, lower-value content is compressed
- You can reference previous interactions by their pointer ID

## Safety Rules
1. Never attempt to bypass tool restrictions
2. Always validate paths are within the working directory
3. Report any sandbox violations immediately
4. Do not execute commands that modify system files
5. Confirm destructive operations before proceeding

## Working Directory
All file operations are restricted to the designated working directory.
Never attempt to access files outside this directory.
`}getFixedPrompt(){return this.fixedPrompt}buildDynamicPrompt(e){const t=[];return e.currentTime&&t.push(`## Current Time
${e.currentTime}
`),e.sessionId&&t.push(`## Session
Session ID: ${e.sessionId}
`),e.workDir&&t.push(`## Working Directory
${e.workDir}
`),e.availableFiles&&e.availableFiles.length>0&&t.push(`## Available Files
${e.availableFiles.slice(0,50).join(`
`)}${e.availableFiles.length>50?`
... (truncated)`:""}
`),e.userPreferences&&t.push(`## User Preferences
${JSON.stringify(e.userPreferences,null,2)}
`),t.length>0?t.join(`
`):""}updateFixedPrompt(e){this.fixedPrompt=e}}g.transports.file.resolvePathFn=()=>p.join(c.app.getPath("userData"),"logs","main.log");g.transports.file.level="debug";g.transports.file.format="[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";g.transports.file.maxSize=10*1024*1024;g.transports.console.level="debug";g.transports.console.format="[{h}:{i}:{s}] [{level}] {text}";const x=[],z=500,B=g.error.bind(g),O=g.warn.bind(g),U=g.info.bind(g),H=g.debug.bind(g);function S(n){x.push(n),x.length>z&&x.shift()}function C(n){return n.map(e=>e instanceof Error?e.message:typeof e=="object"?JSON.stringify(e):String(e)).join(" ")}function R(n){for(const e of n)if(typeof e=="string"){const t=e.match(/^\[([^\]]+)\]/);if(t)return t[1]}return"main"}function N(n){for(const e of n)if(e instanceof Error&&e.stack)return e.stack}g.error=function(...n){S({timestamp:new Date().toISOString(),level:"error",module:R(n),message:C(n),stack:N(n)}),B(...n)};g.warn=function(...n){S({timestamp:new Date().toISOString(),level:"warn",module:R(n),message:C(n)}),O(...n)};g.info=function(...n){S({timestamp:new Date().toISOString(),level:"info",module:R(n),message:C(n)}),U(...n)};g.debug=function(...n){S({timestamp:new Date().toISOString(),level:"debug",module:R(n),message:C(n)}),H(...n)};function G(n){return{error:(...e)=>g.error(`[${n}]`,...e),warn:(...e)=>g.warn(`[${n}]`,...e),info:(...e)=>g.info(`[${n}]`,...e),debug:(...e)=>g.debug(`[${n}]`,...e)}}function Y(n){n.handle("log:getEntries",(e,t)=>{let s=[...x];return t!=null&&t.level&&(s=s.filter(r=>r.level===t.level)),t!=null&&t.module&&(s=s.filter(r=>r.module===t.module)),t!=null&&t.limit&&(s=s.slice(-t.limit)),s}),n.handle("log:export",()=>p.join(c.app.getPath("userData"),"logs","main.log")),n.handle("log:clear",()=>(x.length=0,!0)),n.handle("log:getBuffer",()=>[...x].slice(-20))}const F=p.dirname(I.fileURLToPath(typeof document>"u"?require("url").pathToFileURL(__filename).href:P&&P.tagName.toUpperCase()==="SCRIPT"&&P.src||new URL("main.js",document.baseURI).href)),w=G("Main");process.on("uncaughtException",n=>{w.error("Uncaught Exception:",n.message,n.stack)});process.on("unhandledRejection",n=>{w.error("Unhandled Rejection:",(n==null?void 0:n.message)||n,n==null?void 0:n.stack)});const b=new q({name:"harness-desktop-config",defaults:{apiKey:"",model:"openai",modelEndpoint:"https://api.openai.com/v1",modelName:"gpt-4o",workDir:c.app.getPath("home"),contextWindow:128e3,dangerousCommands:["rm -rf","del /f /q","format","dd if="],allowedExtensions:[".js",".ts",".jsx",".tsx",".json",".md",".txt",".html",".css",".py",".java",".c",".cpp",".h",".go",".rs",".yml",".yaml",".xml",".sh",".bat",".ps1"],riskConfirmation:{medium:!0,high:!0}}});let u=null,A=null,D=null,v=null;const K=!c.app.isPackaged;async function j(){if(u=new c.BrowserWindow({width:1200,height:800,minWidth:900,minHeight:600,webPreferences:{preload:p.join(F,"preload.js"),contextIsolation:!0,nodeIntegration:!1,sandbox:!1},show:!1,backgroundColor:"#1a1a2e",title:"Harness Desktop"}),u.once("ready-to-show",()=>{u==null||u.show(),w.info("Window ready to show")}),u.webContents.on("did-finish-load",()=>{w.info("WebContents did-finish-load")}),u.webContents.on("did-fail-load",(n,e,t)=>{w.warn("WebContents did-fail-load:",e,t)}),u.webContents.on("render-process-gone",(n,e)=>{w.warn("WebContents render-process-gone:",e.reason)}),u.webContents.on("console-message",(n,e,t,s,r)=>{e>=2&&w.error(`Console error [${e}]: ${t} (${r}:${s})`)}),D=new M(b.get("workDir"),b.get("dangerousCommands"),b.get("allowedExtensions")),A=new $(D),v=new L,K)u.loadURL("http://127.0.0.1:5173"),u.webContents.openDevTools();else{const n=c.app.isPackaged?`file://${p.join(c.app.getAppPath(),"dist","index.html")}`:p.join(F,"..","dist","index.html");w.info("Loading production index from:",n),u.loadURL(n)}u.on("closed",()=>{u=null})}c.ipcMain.handle("config:get",(n,e)=>b.get(e));c.ipcMain.handle("config:set",(n,e,t)=>(b.set(e,t),!0));c.ipcMain.handle("config:getAll",()=>b.store);c.ipcMain.handle("systemPrompt:getFixed",()=>(v==null?void 0:v.getFixedPrompt())||"");c.ipcMain.handle("systemPrompt:buildDynamic",(n,e)=>(v==null?void 0:v.buildDynamicPrompt(e))||"");c.ipcMain.handle("tool:execute",async(n,e)=>{w.info("Tool call received:",e.name,e.arguments);try{if(!A)throw new Error("ToolExecutor not initialized");return{success:!0,result:await A.execute(e.name,e.arguments)}}catch(t){return w.error("Tool execution error:",t),{success:!1,error:t.message}}});c.ipcMain.handle("sandbox:getStatus",()=>(D==null?void 0:D.getStatus())||{initialized:!1});c.ipcMain.handle("dialog:selectWorkDir",async()=>{const n=await c.dialog.showOpenDialog(u,{properties:["openDirectory"],title:"Select Working Directory"});return!n.canceled&&n.filePaths.length>0?(b.set("workDir",n.filePaths[0]),n.filePaths[0]):null});c.ipcMain.handle("shell:openExternal",async(n,e)=>{await c.shell.openExternal(e)});c.ipcMain.handle("window:minimize",()=>{u==null||u.minimize()});c.ipcMain.handle("window:maximize",()=>{u!=null&&u.isMaximized()?u.unmaximize():u==null||u.maximize()});c.ipcMain.handle("window:close",()=>{u==null||u.close()});c.ipcMain.handle("window:isMaximized",()=>(u==null?void 0:u.isMaximized())||!1);c.ipcMain.handle("fs:readDir",async(n,e)=>{try{return(await m.promises.readdir(e,{withFileTypes:!0})).map(s=>({name:s.name,isDirectory:s.isDirectory(),path:p.join(e,s.name)}))}catch(t){return{error:t.message}}});c.ipcMain.handle("fs:readFile",async(n,e)=>{try{const t=b.get("workDir"),s=p.resolve(t,e);if(!s.startsWith(t))throw new Error("Path outside work directory");return{success:!0,content:await m.promises.readFile(s,"utf-8")}}catch(t){return{success:!1,error:t.message}}});c.ipcMain.handle("fs:writeFile",async(n,e,t)=>{try{const s=b.get("workDir"),r=p.resolve(s,e);if(!r.startsWith(s))throw new Error("Path outside work directory");return await m.promises.writeFile(r,t,"utf-8"),{success:!0}}catch(s){return{success:!1,error:s.message}}});c.ipcMain.handle("fs:exists",async(n,e)=>{try{const t=b.get("workDir"),s=p.resolve(t,e);return s.startsWith(t)?(await m.promises.access(s),!0):!1}catch{return!1}});Y(c.ipcMain);c.app.whenReady().then(()=>{w.info("App ready, creating window..."),j()});c.app.on("window-all-closed",()=>{process.platform!=="darwin"&&c.app.quit()});c.app.on("activate",()=>{c.BrowserWindow.getAllWindows().length===0&&j()});c.app.on("before-quit",()=>{w.info("App quitting...")});
