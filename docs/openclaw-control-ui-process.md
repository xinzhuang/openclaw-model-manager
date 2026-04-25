OpenClaw Control UI 修改配置的全链路流程分析

Control UI 配置修改流程
1. 前端代码位置
文件	说明
config.ts	配置状态管理：ConfigState 包含表单数据、原始 JSON5、验证状态、保存状态等
config.ts (view)	配置视图渲染
config-form.ts	配置表单生成，基于 JSON Schema 动态渲染
2. 前端 → Gateway 通信（WebSocket）
UI 通过 WebSocket 发送三种请求：

方法	用途
config.set	完整替换配置
config.patch	增量合并（JSON5 merge patch）
config.apply	应用配置并触发重启评估
核心流程（config.ts）：


// 1. 序列化表单 → JSON5 字符串
const raw = serializeFormForSubmit(state);
// 2. 乐观锁：带上 baseHash 防止并发修改
await state.client.request("config.apply", { raw, baseHash, sessionKey });
// 3. 成功后重新加载配置
await loadConfig(state);
3. Gateway 服务端处理
server-methods/config.ts 实现三个 RPC 方法：

验证管道（按顺序）：

baseHash 检查 — 乐观锁，防止并发写入导致覆盖
JSON5 解析 — 支持注释、尾逗号、无引号 key
Secret 引用检查 — 验证所有 ${VAR} 可解析
Schema 验证 — Zod + 插件扩展验证
config.patch 特殊处理：

数组合并按 ID 匹配
对象深度合并
恢复被隐藏的 Secret 值（防止表单提交时误删 ${VAR} 引用）
4. 持久化（文件写入）
io.ts 的 writeConfigFile() 流程：


1. clearConfigCache()              // 清除缓存
2. 合并补丁 / 恢复 ${VAR} 引用
3. validateConfigObjectRawWithPlugins()  // 验证
4. stampConfigVersion()             // 添加 meta.lastTouchedVersion
5. 原子写入：
   - 写临时文件: config.json5.{pid}.{uuid}.tmp
   - 创建备份: config.json5.bak
   - atomic rename → 正式文件
   - 权限设为 0o600
6. appendConfigAuditRecord()        // 审计日志
7. notifyRuntimeConfigWriteListeners() // 通知监听器
8. finalizeRuntimeSnapshotWrite()   // 刷新运行时快照
5. 配置变更后触发的事件
config-reload.ts 中 diffConfigPaths() 计算变更路径，然后 buildGatewayReloadPlan() 决定行为：

变更路径	触发动作
gateway.mode / gateway.port	可能需要重启 Gateway
channels.*	重启受影响的通道
cron.*	重启 Cron 服务
skills.*	bumpSkillsSnapshotVersion() 使工具缓存失效
hooks.*	重新加载 hooks 配置
heartbeat.*	重启心跳运行器
gateway.auth.*	断开旧认证客户端，重新强制执行
热重载 vs 重启：大部分变更支持热加载（applyHotReload()），极少数需要发送 SIGUSR1 重启 Gateway。

6. 完整时序图

Control UI (Browser)
    │
    │  WebSocket: config.apply(raw, baseHash)
    ▼
Gateway Server [server-methods/config.ts]
    │
    ├─ 验证: JSON5解析 → Schema验证 → Secret检查
    │
    ▼
Config I/O [io.ts]
    │
    ├─ 原子写入 config.json5 (tmp → rename)
    ├─ 审计日志 appendConfigAuditRecord()
    ├─ notifyRuntimeConfigWriteListeners()
    │
    ▼
Config Reload [config-reload.ts]
    │
    ├─ diffConfigPaths() → 计算变更路径
    ├─ buildGatewayReloadPlan()
    │
    ├─ [热重载] applyHotReload()
    │   ├─ restartCron()
    │   ├─ restartChannels()
    │   └─ updateLaneConcurrency()
    │
    └─ [需重启] queueRestart(SIGUSR1)
    │
    ▼
Control UI 重新加载 config.get 刷新界面
7. 关键设计要点
乐观锁（baseHash）：防止多人同时编辑覆盖彼此的修改
原子写入：临时文件 + rename，防止写入中断导致配置文件损坏
Secret 保护：表单中 ${VAR} 引用被隐藏，写入时自动恢复
审计追踪：每次变更记录 PID、操作人、变更路径到审计日志
最小化重启：通过 diff 精确判断哪些组件需要重启，尽量热加载