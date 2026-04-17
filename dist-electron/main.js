"use strict";const u=require("electron"),f=require("path"),R=require("url"),m=require("fs"),P=require("child_process"),T=require("electron-store");var x=typeof document<"u"?document.currentScript:null;class E{constructor(e){this.sandbox=e}async execute(e,t){console.log(`[ToolExecutor] Executing tool: ${e}`,t);try{switch(e){case"file_read":return await this.file_read(t);case"file_write":return await this.file_write(t);case"file_append":return await this.file_append(t);case"dir_list":return await this.dir_list(t);case"bash_execute":return await this.bash_execute(t);case"grep_search":return await this.grep_search(t);case"glob":return await this.glob(t);case"tool_status":return await this.tool_status(t);case"edit_code":return await this.edit_code(t);case"project_tree":return await this.project_tree(t);case"web_search":return await this.web_search(t);case"task_plan":return await this.task_plan(t);default:return{success:!1,error:`Unknown tool: ${e}`}}}catch(r){return console.error(`[ToolExecutor] Error executing ${e}:`,r),{success:!1,error:r.message}}}async file_read(e){const{file_path:t}=e;if(!t)return{success:!1,error:"file_path is required"};const r=this.sandbox.validatePath(t);if(!r.valid)return{success:!1,error:r.error};try{const s=await m.promises.readFile(r.resolved,"utf-8"),i=await m.promises.stat(r.resolved);return{success:!0,result:{content:s,lines:s.split(`
`).length,size:i.size,path:r.resolved}}}catch(s){return{success:!1,error:s.message}}}async file_write(e){const{file_path:t,content:r}=e;if(!t||r===void 0)return{success:!1,error:"file_path and content are required"};const s=this.sandbox.validatePath(t);if(!s.valid)return{success:!1,error:s.error};try{const i=f.dirname(s.resolved);await m.promises.mkdir(i,{recursive:!0}),await m.promises.writeFile(s.resolved,r,"utf-8");const n=await m.promises.stat(s.resolved);return{success:!0,result:{path:s.resolved,bytesWritten:n.size,lines:r.split(`
`).length}}}catch(i){return{success:!1,error:i.message}}}async file_append(e){const{file_path:t,content:r}=e;if(!t||r===void 0)return{success:!1,error:"file_path and content are required"};const s=this.sandbox.validatePath(t);if(!s.valid)return{success:!1,error:s.error};try{await m.promises.appendFile(s.resolved,r,"utf-8");const i=await m.promises.stat(s.resolved);return{success:!0,result:{path:s.resolved,totalBytes:i.size}}}catch(i){return{success:!1,error:i.message}}}async dir_list(e){const{dir_path:t,recursive:r}=e,s=t||this.sandbox.getWorkDir(),i=this.sandbox.validatePath(s);if(!i.valid)return{success:!1,error:i.error};try{const n=await m.promises.readdir(s,{withFileTypes:!0}),o=[];for(const a of n)if(o.push({name:a.name,type:a.isDirectory()?"directory":"file",path:f.join(s,a.name)}),r&&a.isDirectory()){const l=await this.dir_listRecursive(f.join(s,a.name),2);o.push(...l)}return{success:!0,result:o}}catch(n){return{success:!1,error:n.message}}}async dir_listRecursive(e,t,r=0){if(r>=t)return[];const s=[];try{const i=await m.promises.readdir(e,{withFileTypes:!0});for(const n of i)if(s.push({name:n.name,type:n.isDirectory()?"directory":"file",path:f.join(e,n.name)}),n.isDirectory()){const o=await this.dir_listRecursive(f.join(e,n.name),t,r+1);s.push(...o)}}catch{}return s}async bash_execute(e){const{command:t,timeout:r}=e;if(!t)return{success:!1,error:"command is required"};const s=this.sandbox.validateCommand(t);if(!s.valid)return{success:!1,error:s.error};try{const i=await this.sandbox.executeCommand(t,r||3e4);return{success:i.exitCode===0,result:{stdout:i.stdout,stderr:i.stderr,exitCode:i.exitCode,timedOut:i.timedOut}}}catch(i){return{success:!1,error:i.message}}}async grep_search(e){var i;const{pattern:t,file_path:r,case_sensitive:s}=e;if(!t)return{success:!1,error:"pattern is required"};try{const n=r?(i=this.sandbox.validatePath(r))==null?void 0:i.resolved:this.sandbox.getWorkDir(),o=this.sandbox.validatePath(n);if(!o.valid)return{success:!1,error:o.error};const a=[];return await this.grepRecursive(n,t,s!==!1,a),{success:!0,result:{matches:a,total:a.length}}}catch(n){return{success:!1,error:n.message}}}async grepRecursive(e,t,r,s,i=3){try{const n=await m.promises.readdir(e,{withFileTypes:!0}),o=new RegExp(t,r?"g":"gi");for(const a of n)if(a.isDirectory())i>0&&await this.grepRecursive(f.join(e,a.name),t,r,s,i-1);else if(a.isFile())try{(await m.promises.readFile(f.join(e,a.name),"utf-8")).split(`
`).forEach((h,g)=>{o.test(h)&&s.push({file:f.join(e,a.name),line:g+1,content:h.trim()})})}catch{}}catch{}}async glob(e){const{pattern:t}=e;if(!t)return{success:!1,error:"pattern is required"};try{const r=this.sandbox.getWorkDir(),s=t.replace(/\./g,"\\.").replace(/\*\*/g,"{{GLOBSTAR}}").replace(/\*/g,"[^/]*").replace(/{{GLOBSTAR}}/g,".*").replace(/\?/g,"."),i=new RegExp(`^${s}$`,"i"),n=[];return await this.globRecursive(r,i,n),{success:!0,result:{matches:n,total:n.length}}}catch(r){return{success:!1,error:r.message}}}async globRecursive(e,t,r,s=5,i=0){if(!(i>s))try{const n=await m.promises.readdir(e,{withFileTypes:!0});for(const o of n)t.test(o.name)&&r.push(f.join(e,o.name)),o.isDirectory()&&await this.globRecursive(f.join(e,o.name),t,r,s,i+1)}catch{}}async tool_status(e){return{success:!0,result:{sandbox:this.sandbox.getStatus(),timestamp:new Date().toISOString(),tools:["file_read","file_write","file_append","dir_list","bash_execute","grep_search","glob","tool_status","edit_code","project_tree","web_search","task_plan"]}}}async edit_code(e){const{file_path:t,diff:r,create_backup:s}=e;if(!t||!r)return{success:!1,error:"file_path and diff are required"};const i=this.sandbox.validatePath(t);if(!i.valid)return{success:!1,error:i.error};try{if(s!==!1){const l=i.resolved+".bak";await m.promises.copyFile(i.resolved,l)}const n=await m.promises.readFile(i.resolved,"utf-8"),o=this.applyUnifiedDiff(n,r);await m.promises.writeFile(i.resolved,o,"utf-8");const a=(r.match(/^@@/gm)||[]).length;return{success:!0,result:{path:i.resolved,applied:a,patches:a}}}catch(n){return{success:!1,error:n.message}}}applyUnifiedDiff(e,t){const r=e.split(`
`),s=t.split(`
`),i=[];let n=0;for(;n<s.length;){const l=s[n].match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);if(l){const d={oldStart:parseInt(l[1],10)-1,oldCount:parseInt(l[2]||"1",10),newStart:parseInt(l[3],10)-1,newCount:parseInt(l[4]||"1",10),changes:[]};for(n++;n<s.length&&!s[n].startsWith("@@");){const h=s[n];h.startsWith("-")?d.changes.push({type:"delete",content:h.slice(1)}):h.startsWith("+")?d.changes.push({type:"add",content:h.slice(1)}):(h.startsWith(" ")||h==="")&&d.changes.push({type:"keep",content:h.slice(1)}),n++}i.push(d)}else n++}let o=[...r];for(let a=i.length-1;a>=0;a--){const l=i[a];let d=l.oldStart;const h=[];for(const g of l.changes)g.type==="keep"?(d<o.length&&h.push(o[d]),d++):g.type==="add"&&h.push(g.content);o.splice(l.oldStart,l.oldCount,...h)}return o.join(`
`)}async project_tree(e){const{root_path:t,max_depth:r,include_hidden:s,exclude_patterns:i}=e,n=t||this.sandbox.getWorkDir(),o=r??5,a=s??!1,l=i||["node_modules",".git","dist","build","__pycache__"],d=this.sandbox.validatePath(n);if(!d.valid)return{success:!1,error:d.error};try{const h=await this.buildTree(d.resolved,o,a,l,0);let g=0,b=0;const w=C=>{var D;C.type==="file"?g++:b++,(D=C.children)==null||D.forEach(w)};return w(h),{success:!0,result:{tree:h,files:g,directories:b,depth:o}}}catch(h){return{success:!1,error:h.message}}}async buildTree(e,t,r,s,i){const o={name:f.basename(e),type:"directory",path:e,children:[]};if(i>=t)return o;try{const a=await m.promises.readdir(e,{withFileTypes:!0});for(const l of a){if(!r&&l.name.startsWith(".")||s.some(h=>this.matchGlob(l.name,h)))continue;const d=f.join(e,l.name);if(l.isDirectory()){const h=await this.buildTree(d,t,r,s,i+1);o.children.push(h)}else o.children.push({name:l.name,type:"file",path:d})}}catch{}return o}matchGlob(e,t){if(t==="*")return e.includes(".");if(t.startsWith("*.")){const r=t.slice(1);return e.endsWith(r)}return e===t||e.includes(t)}async web_search(e){const{query:t,count:r,freshness:s}=e;if(!t)return{success:!1,error:"query is required"};const i=process.env.BRAVE_SEARCH_API_KEY||"";if(!i)return{success:!1,error:"Brave Search API key not configured. Set BRAVE_SEARCH_API_KEY environment variable."};try{const n=new URLSearchParams({q:t,count:String(r||5)});s&&n.set("freshness",s);const o=await fetch(`https://api.search.brave.com/res/v1/web/search?${n}`,{headers:{Accept:"application/json","X-Subscription-Token":i}});if(!o.ok){const d=await o.text();return{success:!1,error:`Brave Search API error: ${o.status} ${d}`}}const l=((await o.json()).results||[]).map(d=>({title:d.title,url:d.url,description:d.description,pageAge:d.page_age}));return{success:!0,result:{query:t,results:l,total:l.length}}}catch(n){return{success:!1,error:n.message}}}async task_plan(e){const{task_description:t,max_subtasks:r,include_dependencies:s}=e;if(!t)return{success:!1,error:"task_description is required"};const i=r||5,n=s!==!1;try{const o=this.decomposeTask(t,i,n);return{success:!0,result:{originalTask:t,tasks:o,totalTasks:o.length}}}catch(o){return{success:!1,error:o.message}}}decomposeTask(e,t,r){const s=e.toLowerCase(),i=[];let n=1;return(s.includes("read")||s.includes("analyze")||s.includes("review"))&&(i.push({id:String(n++),description:"Read/analyze source files",toolCalls:[{name:"dir_list",arguments:{recursive:!0}}],dependencies:[]}),(s.includes("code")||s.includes("function"))&&i.push({id:String(n++),description:"Extract relevant code sections",toolCalls:[{name:"grep_search",arguments:{pattern:"function|class|const|let"}}],dependencies:["1"]})),(s.includes("create")||s.includes("write")||s.includes("generate"))&&(i.push({id:String(n++),description:"Plan file structure",toolCalls:[{name:"project_tree",arguments:{}}],dependencies:[]}),i.push({id:String(n++),description:"Write/Update files",toolCalls:[{name:"file_write",arguments:{file_path:"",content:""}}],dependencies:[String(n-2)]})),(s.includes("build")||s.includes("compile")||s.includes("run"))&&i.push({id:String(n++),description:"Execute build/run command",toolCalls:[{name:"bash_execute",arguments:{command:""}}],dependencies:[]}),s.includes("test")&&i.push({id:String(n++),description:"Run tests",toolCalls:[{name:"bash_execute",arguments:{command:"npm test"}}],dependencies:[]}),(s.includes("deploy")||s.includes("release"))&&i.push({id:String(n++),description:"Prepare deployment",toolCalls:[{name:"bash_execute",arguments:{command:""}}],dependencies:[]}),i.length===0&&i.push({id:"1",description:e,toolCalls:[{name:"bash_execute",arguments:{command:`echo "Task: ${e}"`}}],dependencies:[]}),i.slice(0,t)}}class F{constructor(e,t,r){if(this.initialized=!0,this.workDir=e,this.dangerousCommands=t,this.allowedExtensions=r,!m.existsSync(this.workDir))try{m.mkdirSync(this.workDir,{recursive:!0})}catch(s){console.error("[SandboxManager] Failed to create work dir:",s),this.initialized=!1}}getWorkDir(){return this.workDir}getStatus(){return{initialized:this.initialized,workDir:this.workDir,dangerousCommandsCount:this.dangerousCommands.length}}validatePath(e){try{const t=f.isAbsolute(e)?f.resolve(e):f.resolve(this.workDir,e);if(!t.startsWith(this.workDir))return{valid:!1,error:`Path "${e}" is outside the allowed working directory`};const r=f.extname(e).toLowerCase();return r&&!this.allowedExtensions.includes(r)?{valid:!1,error:`File extension "${r}" is not allowed. Allowed: ${this.allowedExtensions.join(", ")}`}:{valid:!0,resolved:t}}catch(t){return{valid:!1,error:t.message}}}validateCommand(e){const t=e.toLowerCase().trim();for(const s of this.dangerousCommands)if(t.includes(s.toLowerCase()))return{valid:!1,error:`Command contains forbidden pattern: "${s}"`};const r=["curl ","wget ","nc ","netcat ","ssh ","telnet "];for(const s of r)if(t.includes(s))return{valid:!1,error:`Network commands are not allowed in sandbox: "${s.trim()}"`};return(t.includes("cd ..")||t.includes("cd../"))&&!t.includes(this.workDir)?{valid:!1,error:"Cannot navigate outside working directory"}:{valid:!0}}async executeCommand(e,t=3e4){return new Promise(r=>{var g,b;const s=process.platform==="win32";let i,n;s?(i="cmd.exe",n=["/c",`chcp 65066 >nul 2>&1 && ${e}`]):(i="/bin/sh",n=["-c",e]);const o=P.spawn(i,n,{cwd:this.workDir,env:{...process.env,HOME:this.workDir,TMPDIR:this.workDir},timeout:t,windowsHide:!0});let a="",l="",d=!1;(g=o.stdout)==null||g.on("data",w=>{a+=w.toString("utf8")}),(b=o.stderr)==null||b.on("data",w=>{l+=w.toString("utf8")});const h=setTimeout(()=>{d=!0,o.kill("SIGTERM")},t);o.on("close",w=>{clearTimeout(h),r({stdout:a.slice(0,5e4),stderr:l.slice(0,1e4),exitCode:w||0,timedOut:d})}),o.on("error",w=>{clearTimeout(h),r({stdout:a,stderr:l+w.message,exitCode:1,timedOut:d})})})}updateWorkDir(e){this.workDir=e}}class I{constructor(){this.fixedPrompt="",this.loadFixedPrompt()}loadFixedPrompt(){this.fixedPrompt=`You are Harness Desktop, an AI programming assistant built on the Harness Engineering architecture.

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
`):""}updateFixedPrompt(e){this.fixedPrompt=e}}const S=f.dirname(R.fileURLToPath(typeof document>"u"?require("url").pathToFileURL(__filename).href:x&&x.tagName.toUpperCase()==="SCRIPT"&&x.src||new URL("main.js",document.baseURI).href));process.on("uncaughtException",p=>{console.error("[MAIN] Uncaught Exception:",p),m.appendFileSync(f.join(u.app.getPath("userData"),"error.log"),`[${new Date().toISOString()}] Uncaught Exception: ${p.stack}
`)});process.on("unhandledRejection",p=>{console.error("[MAIN] Unhandled Rejection:",p)});const y=new T({name:"harness-desktop-config",defaults:{apiKey:"",model:"openai",modelEndpoint:"https://api.openai.com/v1",modelName:"gpt-4o",workDir:u.app.getPath("home"),contextWindow:128e3,dangerousCommands:["rm -rf","del /f /q","format","dd if="],allowedExtensions:[".js",".ts",".jsx",".tsx",".json",".md",".txt",".html",".css",".py",".java",".c",".cpp",".h",".go",".rs",".yml",".yaml",".xml",".sh",".bat",".ps1"],riskConfirmation:{medium:!0,high:!0}}});let c=null,k=null,v=null,_=null;const M=!u.app.isPackaged;async function A(){c=new u.BrowserWindow({width:1200,height:800,minWidth:900,minHeight:600,webPreferences:{preload:f.join(S,"preload.js"),contextIsolation:!0,nodeIntegration:!1,sandbox:!1},show:!1,backgroundColor:"#1a1a2e",title:"Harness Desktop"}),c.once("ready-to-show",()=>{c==null||c.show(),console.log("[MAIN] Window ready to show")}),c.webContents.on("did-finish-load",()=>{console.log("[MAIN] WebContents did-finish-load")}),c.webContents.on("did-fail-load",(p,e,t)=>{console.log("[MAIN] WebContents did-fail-load:",e,t)}),c.webContents.on("render-process-gone",(p,e)=>{console.log("[MAIN] WebContents render-process-gone:",e.reason)}),c.webContents.on("console-message",(p,e,t,r,s)=>{e>=2&&console.log(`[MAIN] Console error [${e}]: ${t} (${s}:${r})`)}),v=new F(y.get("workDir"),y.get("dangerousCommands"),y.get("allowedExtensions")),k=new E(v),_=new I,M?(c.loadURL("http://127.0.0.1:5173"),c.webContents.openDevTools()):c.loadFile(f.join(S,"../dist/index.html")),c.on("closed",()=>{c=null})}u.ipcMain.handle("config:get",(p,e)=>y.get(e));u.ipcMain.handle("config:set",(p,e,t)=>(y.set(e,t),!0));u.ipcMain.handle("config:getAll",()=>y.store);u.ipcMain.handle("systemPrompt:getFixed",()=>(_==null?void 0:_.getFixedPrompt())||"");u.ipcMain.handle("systemPrompt:buildDynamic",(p,e)=>(_==null?void 0:_.buildDynamicPrompt(e))||"");u.ipcMain.handle("tool:execute",async(p,e)=>{console.log("[MAIN] Tool call received:",e.name,e.arguments);try{if(!k)throw new Error("ToolExecutor not initialized");return{success:!0,result:await k.execute(e.name,e.arguments)}}catch(t){return console.error("[MAIN] Tool execution error:",t),{success:!1,error:t.message}}});u.ipcMain.handle("sandbox:getStatus",()=>(v==null?void 0:v.getStatus())||{initialized:!1});u.ipcMain.handle("dialog:selectWorkDir",async()=>{const p=await u.dialog.showOpenDialog(c,{properties:["openDirectory"],title:"Select Working Directory"});return!p.canceled&&p.filePaths.length>0?(y.set("workDir",p.filePaths[0]),p.filePaths[0]):null});u.ipcMain.handle("shell:openExternal",async(p,e)=>{await u.shell.openExternal(e)});u.ipcMain.handle("window:minimize",()=>{c==null||c.minimize()});u.ipcMain.handle("window:maximize",()=>{c!=null&&c.isMaximized()?c.unmaximize():c==null||c.maximize()});u.ipcMain.handle("window:close",()=>{c==null||c.close()});u.ipcMain.handle("window:isMaximized",()=>(c==null?void 0:c.isMaximized())||!1);u.ipcMain.handle("fs:readDir",async(p,e)=>{try{return(await m.promises.readdir(e,{withFileTypes:!0})).map(r=>({name:r.name,isDirectory:r.isDirectory(),path:f.join(e,r.name)}))}catch(t){return{error:t.message}}});u.ipcMain.handle("fs:readFile",async(p,e)=>{try{const t=y.get("workDir"),r=f.resolve(t,e);if(!r.startsWith(t))throw new Error("Path outside work directory");return{success:!0,content:await m.promises.readFile(r,"utf-8")}}catch(t){return{success:!1,error:t.message}}});u.ipcMain.handle("fs:writeFile",async(p,e,t)=>{try{const r=y.get("workDir"),s=f.resolve(r,e);if(!s.startsWith(r))throw new Error("Path outside work directory");return await m.promises.writeFile(s,t,"utf-8"),{success:!0}}catch(r){return{success:!1,error:r.message}}});u.ipcMain.handle("fs:exists",async(p,e)=>{try{const t=y.get("workDir"),r=f.resolve(t,e);return r.startsWith(t)?(await m.promises.access(r),!0):!1}catch{return!1}});u.app.whenReady().then(()=>{console.log("[MAIN] App ready, creating window..."),A()});u.app.on("window-all-closed",()=>{process.platform!=="darwin"&&u.app.quit()});u.app.on("activate",()=>{u.BrowserWindow.getAllWindows().length===0&&A()});u.app.on("before-quit",()=>{console.log("[MAIN] App quitting...")});
