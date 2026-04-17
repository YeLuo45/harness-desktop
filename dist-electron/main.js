"use strict";const o=require("electron"),c=require("path"),A=require("url"),h=require("fs"),C=require("child_process"),F=require("electron-store");var b=typeof document<"u"?document.currentScript:null;class S{constructor(e){this.sandbox=e}async execute(e,t){console.log(`[ToolExecutor] Executing tool: ${e}`,t);try{switch(e){case"file_read":return await this.file_read(t);case"file_write":return await this.file_write(t);case"file_append":return await this.file_append(t);case"dir_list":return await this.dir_list(t);case"bash_execute":return await this.bash_execute(t);case"grep_search":return await this.grep_search(t);case"glob":return await this.glob(t);case"tool_status":return await this.tool_status(t);default:return{success:!1,error:`Unknown tool: ${e}`}}}catch(r){return console.error(`[ToolExecutor] Error executing ${e}:`,r),{success:!1,error:r.message}}}async file_read(e){const{file_path:t}=e;if(!t)return{success:!1,error:"file_path is required"};const r=this.sandbox.validatePath(t);if(!r.valid)return{success:!1,error:r.error};try{const s=await h.promises.readFile(r.resolved,"utf-8"),i=await h.promises.stat(r.resolved);return{success:!0,result:{content:s,lines:s.split(`
`).length,size:i.size,path:r.resolved}}}catch(s){return{success:!1,error:s.message}}}async file_write(e){const{file_path:t,content:r}=e;if(!t||r===void 0)return{success:!1,error:"file_path and content are required"};const s=this.sandbox.validatePath(t);if(!s.valid)return{success:!1,error:s.error};try{const i=c.dirname(s.resolved);await h.promises.mkdir(i,{recursive:!0}),await h.promises.writeFile(s.resolved,r,"utf-8");const n=await h.promises.stat(s.resolved);return{success:!0,result:{path:s.resolved,bytesWritten:n.size,lines:r.split(`
`).length}}}catch(i){return{success:!1,error:i.message}}}async file_append(e){const{file_path:t,content:r}=e;if(!t||r===void 0)return{success:!1,error:"file_path and content are required"};const s=this.sandbox.validatePath(t);if(!s.valid)return{success:!1,error:s.error};try{await h.promises.appendFile(s.resolved,r,"utf-8");const i=await h.promises.stat(s.resolved);return{success:!0,result:{path:s.resolved,totalBytes:i.size}}}catch(i){return{success:!1,error:i.message}}}async dir_list(e){const{dir_path:t,recursive:r}=e,s=t||this.sandbox.getWorkDir(),i=this.sandbox.validatePath(s);if(!i.valid)return{success:!1,error:i.error};try{const n=await h.promises.readdir(s,{withFileTypes:!0}),u=[];for(const d of n)if(u.push({name:d.name,type:d.isDirectory()?"directory":"file",path:c.join(s,d.name)}),r&&d.isDirectory()){const g=await this.dir_listRecursive(c.join(s,d.name),2);u.push(...g)}return{success:!0,result:u}}catch(n){return{success:!1,error:n.message}}}async dir_listRecursive(e,t,r=0){if(r>=t)return[];const s=[];try{const i=await h.promises.readdir(e,{withFileTypes:!0});for(const n of i)if(s.push({name:n.name,type:n.isDirectory()?"directory":"file",path:c.join(e,n.name)}),n.isDirectory()){const u=await this.dir_listRecursive(c.join(e,n.name),t,r+1);s.push(...u)}}catch{}return s}async bash_execute(e){const{command:t,timeout:r}=e;if(!t)return{success:!1,error:"command is required"};const s=this.sandbox.validateCommand(t);if(!s.valid)return{success:!1,error:s.error};try{const i=await this.sandbox.executeCommand(t,r||3e4);return{success:i.exitCode===0,result:{stdout:i.stdout,stderr:i.stderr,exitCode:i.exitCode,timedOut:i.timedOut}}}catch(i){return{success:!1,error:i.message}}}async grep_search(e){var i;const{pattern:t,file_path:r,case_sensitive:s}=e;if(!t)return{success:!1,error:"pattern is required"};try{const n=r?(i=this.sandbox.validatePath(r))==null?void 0:i.resolved:this.sandbox.getWorkDir(),u=this.sandbox.validatePath(n);if(!u.valid)return{success:!1,error:u.error};const d=[];return await this.grepRecursive(n,t,s!==!1,d),{success:!0,result:{matches:d,total:d.length}}}catch(n){return{success:!1,error:n.message}}}async grepRecursive(e,t,r,s,i=3){try{const n=await h.promises.readdir(e,{withFileTypes:!0}),u=new RegExp(t,r?"g":"gi");for(const d of n)if(d.isDirectory())i>0&&await this.grepRecursive(c.join(e,d.name),t,r,s,i-1);else if(d.isFile())try{(await h.promises.readFile(c.join(e,d.name),"utf-8")).split(`
`).forEach((w,v)=>{u.test(w)&&s.push({file:c.join(e,d.name),line:v+1,content:w.trim()})})}catch{}}catch{}}async glob(e){const{pattern:t}=e;if(!t)return{success:!1,error:"pattern is required"};try{const r=this.sandbox.getWorkDir(),s=t.replace(/\./g,"\\.").replace(/\*\*/g,"{{GLOBSTAR}}").replace(/\*/g,"[^/]*").replace(/{{GLOBSTAR}}/g,".*").replace(/\?/g,"."),i=new RegExp(`^${s}$`,"i"),n=[];return await this.globRecursive(r,i,n),{success:!0,result:{matches:n,total:n.length}}}catch(r){return{success:!1,error:r.message}}}async globRecursive(e,t,r,s=5,i=0){if(!(i>s))try{const n=await h.promises.readdir(e,{withFileTypes:!0});for(const u of n)t.test(u.name)&&r.push(c.join(e,u.name)),u.isDirectory()&&await this.globRecursive(c.join(e,u.name),t,r,s,i+1)}catch{}}async tool_status(e){return{success:!0,result:{sandbox:this.sandbox.getStatus(),timestamp:new Date().toISOString(),tools:["file_read","file_write","file_append","dir_list","bash_execute","grep_search","glob","tool_status"]}}}}class M{constructor(e,t,r){if(this.initialized=!0,this.workDir=e,this.dangerousCommands=t,this.allowedExtensions=r,!h.existsSync(this.workDir))try{h.mkdirSync(this.workDir,{recursive:!0})}catch(s){console.error("[SandboxManager] Failed to create work dir:",s),this.initialized=!1}}getWorkDir(){return this.workDir}getStatus(){return{initialized:this.initialized,workDir:this.workDir,dangerousCommandsCount:this.dangerousCommands.length}}validatePath(e){try{const t=c.isAbsolute(e)?c.resolve(e):c.resolve(this.workDir,e);if(!t.startsWith(this.workDir))return{valid:!1,error:`Path "${e}" is outside the allowed working directory`};const r=c.extname(e).toLowerCase();return r&&!this.allowedExtensions.includes(r)?{valid:!1,error:`File extension "${r}" is not allowed. Allowed: ${this.allowedExtensions.join(", ")}`}:{valid:!0,resolved:t}}catch(t){return{valid:!1,error:t.message}}}validateCommand(e){const t=e.toLowerCase().trim();for(const s of this.dangerousCommands)if(t.includes(s.toLowerCase()))return{valid:!1,error:`Command contains forbidden pattern: "${s}"`};const r=["curl ","wget ","nc ","netcat ","ssh ","telnet "];for(const s of r)if(t.includes(s))return{valid:!1,error:`Network commands are not allowed in sandbox: "${s.trim()}"`};return(t.includes("cd ..")||t.includes("cd../"))&&!t.includes(this.workDir)?{valid:!1,error:"Cannot navigate outside working directory"}:{valid:!0}}async executeCommand(e,t=3e4){return new Promise(r=>{var v,k;const s=process.platform==="win32";let i,n;s?(i="cmd.exe",n=["/c",`chcp 65066 >nul 2>&1 && ${e}`]):(i="/bin/sh",n=["-c",e]);const u=C.spawn(i,n,{cwd:this.workDir,env:{...process.env,HOME:this.workDir,TMPDIR:this.workDir},timeout:t,windowsHide:!0});let d="",g="",x=!1;(v=u.stdout)==null||v.on("data",m=>{d+=m.toString("utf8")}),(k=u.stderr)==null||k.on("data",m=>{g+=m.toString("utf8")});const w=setTimeout(()=>{x=!0,u.kill("SIGTERM")},t);u.on("close",m=>{clearTimeout(w),r({stdout:d.slice(0,5e4),stderr:g.slice(0,1e4),exitCode:m||0,timedOut:x})}),u.on("error",m=>{clearTimeout(w),r({stdout:d,stderr:g+m.message,exitCode:1,timedOut:x})})})}updateWorkDir(e){this.workDir=e}}class P{constructor(){this.fixedPrompt="",this.loadFixedPrompt()}loadFixedPrompt(){this.fixedPrompt=`You are Harness Desktop, an AI programming assistant built on the Harness Engineering architecture.

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
`):""}updateFixedPrompt(e){this.fixedPrompt=e}}const D=c.dirname(A.fileURLToPath(typeof document>"u"?require("url").pathToFileURL(__filename).href:b&&b.tagName.toUpperCase()==="SCRIPT"&&b.src||new URL("main.js",document.baseURI).href));process.on("uncaughtException",l=>{console.error("[MAIN] Uncaught Exception:",l),h.appendFileSync(c.join(o.app.getPath("userData"),"error.log"),`[${new Date().toISOString()}] Uncaught Exception: ${l.stack}
`)});process.on("unhandledRejection",l=>{console.error("[MAIN] Unhandled Rejection:",l)});const p=new F({name:"harness-desktop-config",defaults:{apiKey:"",model:"openai",modelEndpoint:"https://api.openai.com/v1",modelName:"gpt-4o",workDir:o.app.getPath("home"),contextWindow:128e3,dangerousCommands:["rm -rf","del /f /q","format","dd if="],allowedExtensions:[".js",".ts",".jsx",".tsx",".json",".md",".txt",".html",".css",".py",".java",".c",".cpp",".h",".go",".rs",".yml",".yaml",".xml",".sh",".bat",".ps1"],riskConfirmation:{medium:!0,high:!0}}});let a=null,_=null,y=null,f=null;const E=process.env.NODE_ENV!=="production"||!o.app.isPackaged;async function R(){a=new o.BrowserWindow({width:1200,height:800,minWidth:900,minHeight:600,webPreferences:{preload:c.join(D,"preload.js"),contextIsolation:!0,nodeIntegration:!1,sandbox:!1},show:!1,backgroundColor:"#1a1a2e",title:"Harness Desktop"}),a.once("ready-to-show",()=>{a==null||a.show(),console.log("[MAIN] Window ready to show")}),y=new M(p.get("workDir"),p.get("dangerousCommands"),p.get("allowedExtensions")),_=new S(y),f=new P,E?(a.loadURL("http://127.0.0.1:5173"),a.webContents.openDevTools()):a.loadFile(c.join(D,"../dist/index.html")),a.on("closed",()=>{a=null})}o.ipcMain.handle("config:get",(l,e)=>p.get(e));o.ipcMain.handle("config:set",(l,e,t)=>(p.set(e,t),!0));o.ipcMain.handle("config:getAll",()=>p.store);o.ipcMain.handle("systemPrompt:getFixed",()=>(f==null?void 0:f.getFixedPrompt())||"");o.ipcMain.handle("systemPrompt:buildDynamic",(l,e)=>(f==null?void 0:f.buildDynamicPrompt(e))||"");o.ipcMain.handle("tool:execute",async(l,e)=>{console.log("[MAIN] Tool call received:",e.name,e.arguments);try{if(!_)throw new Error("ToolExecutor not initialized");return{success:!0,result:await _.execute(e.name,e.arguments)}}catch(t){return console.error("[MAIN] Tool execution error:",t),{success:!1,error:t.message}}});o.ipcMain.handle("sandbox:getStatus",()=>(y==null?void 0:y.getStatus())||{initialized:!1});o.ipcMain.handle("dialog:selectWorkDir",async()=>{const l=await o.dialog.showOpenDialog(a,{properties:["openDirectory"],title:"Select Working Directory"});return!l.canceled&&l.filePaths.length>0?(p.set("workDir",l.filePaths[0]),l.filePaths[0]):null});o.ipcMain.handle("shell:openExternal",async(l,e)=>{await o.shell.openExternal(e)});o.ipcMain.handle("window:minimize",()=>{a==null||a.minimize()});o.ipcMain.handle("window:maximize",()=>{a!=null&&a.isMaximized()?a.unmaximize():a==null||a.maximize()});o.ipcMain.handle("window:close",()=>{a==null||a.close()});o.ipcMain.handle("window:isMaximized",()=>(a==null?void 0:a.isMaximized())||!1);o.ipcMain.handle("fs:readDir",async(l,e)=>{try{return(await h.promises.readdir(e,{withFileTypes:!0})).map(r=>({name:r.name,isDirectory:r.isDirectory(),path:c.join(e,r.name)}))}catch(t){return{error:t.message}}});o.ipcMain.handle("fs:readFile",async(l,e)=>{try{const t=p.get("workDir"),r=c.resolve(t,e);if(!r.startsWith(t))throw new Error("Path outside work directory");return{success:!0,content:await h.promises.readFile(r,"utf-8")}}catch(t){return{success:!1,error:t.message}}});o.ipcMain.handle("fs:writeFile",async(l,e,t)=>{try{const r=p.get("workDir"),s=c.resolve(r,e);if(!s.startsWith(r))throw new Error("Path outside work directory");return await h.promises.writeFile(s,t,"utf-8"),{success:!0}}catch(r){return{success:!1,error:r.message}}});o.ipcMain.handle("fs:exists",async(l,e)=>{try{const t=p.get("workDir"),r=c.resolve(t,e);return r.startsWith(t)?(await h.promises.access(r),!0):!1}catch{return!1}});o.app.whenReady().then(()=>{console.log("[MAIN] App ready, creating window..."),R()});o.app.on("window-all-closed",()=>{process.platform!=="darwin"&&o.app.quit()});o.app.on("activate",()=>{o.BrowserWindow.getAllWindows().length===0&&R()});o.app.on("before-quit",()=>{console.log("[MAIN] App quitting...")});
