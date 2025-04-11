# Obsidian Sync Memos

一个用于将云端 Memos 同步到 Obsidian 日记中的插件，可与 Thino 插件配合使用。

## 功能特点

- 将云端 Memos 内容同步到 Obsidian 日记中
- 支持自定义同步标题位置
- 支持自定义时间格式
- 支持自动创建日记文件
- 支持与 Thino 插件配合使用
- 支持手动触发同步

## 安装方法

1. 在 Obsidian 中打开设置
2. 进入社区插件
3. 搜索 "Sync Memos"
4. 点击安装
5. 启用插件

## 配置说明

在插件设置中需要配置以下内容：

1. **Memos API**：您的 usememos 服务 API 地址
2. **Memos Token**：您的 usememos 服务 API 令牌
3. **日记标题**：Memos 内容将插入到哪个标题下
4. **日记路径**：日记文件的存储路径
5. **日记模板**：日记文件的模板路径
6. **时间格式**：可选择 "HH:mm" 或 "HH:mm:ss" 格式

## 使用方法

1. 配置好插件设置后，点击左侧边栏的同步图标即可手动触发同步
2. 也可以通过命令面板（Command Palette）输入 "Sync Memos" 来触发同步

## 注意事项

- 请确保正确配置 Memos API 和 Token
- 确保日记文件路径和模板路径配置正确
- 同步时会自动创建不存在的日记文件
- 同步的内容会按照时间顺序插入到指定标题下

## 开发信息

- 作者：DevQiaoYu
- 版本：1.0.3
- 许可证：MIT
- 最低 Obsidian 版本要求：1.0.3

## 技术支持

如有问题或建议，请提交 Issue 或 Pull Request。

### 来源

有时会使用 usememos 来记录灵感，为了将记录下的灵感同步到日记中，在 Obsidian 中有 Thino 作为灵感记录的插件，为了 usememos 和 Thino 可以完美融合，就想到了开发一个插件。

### 参考

本插件中很大一部分代码完全粘贴自 [LifeOS](https://github.com/quanru/obsidian-lifeos) 插件，非常感谢！

发现一个跟我思路挺相近的插件 [Memos Sync](https://github.com/RyoJerryYu/obsidian-memos-sync)，早知道的话就不自己写了。
