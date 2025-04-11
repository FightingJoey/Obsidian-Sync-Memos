# Obsidian Sync Memos

这是一个用于将 [Memos](https://github.com/usememos/memos) 同步到 Obsidian 的插件。

## 功能特点

- 自动同步 Memos 到 Obsidian 日记中
- 支持增量同步，只同步新的 Memos
- 支持多种同步模式：
  - 同步今日 Memos
  - 同步本周 Memos（从周一开始）
  - 同步本月 Memos（从 1 号开始）
  - 同步指定日期的 Memos
  - 同步当前文件的 Memos（根据文件名 YYYY-MM-DD.md 格式）
- 支持自定义日记标题和路径
- 支持自定义时间格式
- 支持自动创建日记文件
- 支持日记模板

## 安装

1. 打开 Obsidian 设置
2. 进入 Community plugins
3. 关闭 Safe mode
4. 点击 Browse
5. 搜索 "Obsidian Sync Memos"
6. 点击 Install

## 配置

1. 打开 Obsidian 设置
2. 进入 Community plugins
3. 找到 "Obsidian Sync Memos"
4. 点击设置图标
5. 配置以下选项：
   - Memos API：Memos 服务的 API 地址
   - Memos Token：Memos 服务的访问令牌
   - Daily Record Header：日记中存储 Memos 的标题
   - Daily Note Path：日记文件夹路径
   - Daily Note Template Path：日记模板路径
   - Time Format：时间格式（HH:mm 或 HH:mm:ss）

## 使用方法

### 同步命令

在命令面板（Ctrl/Cmd + P）中可以找到以下命令：

- `同步今日 Memos`：同步今日创建的 Memos
- `同步本周 Memos`：同步本周一及之后创建的 Memos
- `同步本月 Memos`：同步本月 1 号及之后创建的 Memos
- `同步当前文件 Memos`：同步当前打开文件对应日期的 Memos（文件名需为 YYYY-MM-DD.md 格式）

### 自动同步

插件会在以下情况下自动同步：

1. 插件加载时
2. 设置更改时
3. 点击工具栏图标时

### 同步规则

1. 增量同步：只同步新的 Memos，避免重复同步
2. 时间范围：
   - 今日同步：从今日 00:00:00 开始
   - 本周同步：从本周一 00:00:00 开始
   - 本月同步：从本月 1 号 00:00:00 开始
   - 指定日期同步：从指定日期的 00:00:00 到 23:59:59
3. 文件格式：
   - 日记文件名格式：YYYY-MM-DD.md
   - 支持自动创建日记文件
   - 支持使用日记模板

## 注意事项

1. 确保 Memos API 和 Token 配置正确
2. 确保日记标题和路径配置正确
3. 如果使用日记模板，确保模板文件存在
4. 同步过程中请勿关闭 Obsidian
5. 如果同步失败，请检查网络连接和配置是否正确

## 常见问题

1. 同步失败
   - 检查 Memos API 和 Token 是否正确
   - 检查网络连接是否正常
   - 检查日记标题和路径是否正确

2. 重复同步
   - 检查是否启用了增量同步
   - 检查上次同步时间是否正确

3. 文件创建失败
   - 检查日记路径是否正确
   - 检查是否有写入权限
   - 检查模板文件是否存在

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 开发信息

- 作者：DevQiaoYu
- 版本：1.0.5
- 最低 Obsidian 版本要求：1.0.3

## 技术支持

如有问题或建议，请提交 Issue 或 Pull Request。

### 来源

有时会使用 usememos 来记录灵感，为了将记录下的灵感同步到日记中，在 Obsidian 中有 Thino 作为灵感记录的插件，为了 usememos 和 Thino 可以完美融合，就想到了开发一个插件。

### 参考

本插件中很大一部分代码完全粘贴自 [LifeOS](https://github.com/quanru/obsidian-lifeos) 插件，非常感谢！

发现一个跟我思路挺相近的插件 [Memos Sync](https://github.com/RyoJerryYu/obsidian-memos-sync)，早知道的话就不自己写了。
