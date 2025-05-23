import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';

import { MemosSettings, DEFAULT_MEMOS_SETTINGS } from "./settings";

import { DailyRecord } from './DailyRecord';

/**
 * SyncMemos 插件主类
 * 负责插件的生命周期管理和设置界面
 */
export default class SyncMemos extends Plugin {
	settings: MemosSettings = DEFAULT_MEMOS_SETTINGS;        // 插件设置
	dailyRecord!: DailyRecord;      // 每日记录处理器
	file!: File;                    // 文件对象

	/**
	 * 插件加载时的初始化
	 */
	async onload() {
		await this.loadSettings();

		// 添加工具栏图标
		const ribbonIconEl = this.addRibbonIcon('refresh-cw', 'Sync Today Memos', (evt: MouseEvent) => {
			this.dailyRecord.syncToday();
		});

		// 添加强制同步命令
		this.addCommand({
			id: 'force-sync-memos',
			name: 'Force Sync Memos',
			callback: () => {
				this.dailyRecord.forceSync();
			}
		});

		// 添加同步今日记录命令
		this.addCommand({
			id: 'sync-today-memos',
			name: 'Sync Today Memos',
			callback: () => {
				this.dailyRecord.syncToday();
			}
		});

		// 添加同步本周记录命令
		this.addCommand({
			id: 'sync-week-memos',
			name: 'Sync Week Memos',
			callback: () => {
				this.dailyRecord.syncWeek();
			}
		});

		// 添加同步本月记录命令
		this.addCommand({
			id: 'sync-month-memos',
			name: 'Sync Month Memos',
			callback: () => {
				this.dailyRecord.syncMonth();
			}
		});

		this.addCommand({
			id: "sync-current-file-memos",
			name: "同步当前文件 Memos",
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice("请先打开一个文件");
					return;
				}

				// 从文件名中提取日期
				const fileName = activeFile.name;
				const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
				
				if (!dateMatch) {
					new Notice("当前文件不是日记文件（格式应为 YYYY-MM-DD.md）");
					return;
				}

				const date = dateMatch[1];
				this.dailyRecord.syncDate(date);
			},
		});

		this.loadDailyRecord();

		// 添加设置页面
		this.addSettingTab(new SyncMemosSettingTab(this.app, this));
	}

	/**
	 * 插件卸载时的清理
	 */
	onunload() {
	}

	/**
	 * 加载插件设置
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_MEMOS_SETTINGS, await this.loadData());
	}

	/**
	 * 保存插件设置
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * 加载每日记录处理器
	 */
	loadDailyRecord() {
		this.dailyRecord = new DailyRecord(
			this.app,
			this.settings
		);
	}
}

/**
 * 插件设置页面类
 */
class SyncMemosSettingTab extends PluginSettingTab {
	plugin: SyncMemos;

	constructor(app: App, plugin: SyncMemos) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * 显示设置页面
	 */
	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		// 添加设置标题
		new Setting(this.containerEl).setName("General Settings").setHeading();

		// Memos API 设置
		new Setting(containerEl)
			.setName('Memos API')
			.setDesc('The usememos service API')
			.addText(text => text
				.setPlaceholder('https://your-use-memos.com/api/v1/memo')
				.setValue(this.plugin.settings.memosAPI)
				.onChange(async (value) => {
					this.plugin.settings.memosAPI = value;
					await this.plugin.saveSettings();
				}));

		// Memos Token 设置
		new Setting(containerEl)
			.setName('Memos Token')
			.setDesc('The token of you service API')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.memosToken)
				.onChange(async (value) => {
					this.plugin.settings.memosToken = value;
					// 重新初始化 DailyRecord 实例以更新 token
					this.plugin.loadDailyRecord();
					await this.plugin.saveSettings();
				}));

		// 日记标题设置
		new Setting(containerEl)
			.setName('Daliy Record Header')
			.setDesc('将Memos插入到哪个标题下')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.dailyRecordHeader)
				.onChange(async (value) => {
					this.plugin.settings.dailyRecordHeader = value;
					await this.plugin.saveSettings();
				}));

		// 日记路径设置
		new Setting(containerEl)
			.setName('Daliy Note Path')
			.setDesc('日记文件夹')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.periodicNotesPath)
				.onChange(async (value) => {
					this.plugin.settings.periodicNotesPath = value;
					await this.plugin.saveSettings();
				}));

		// 日记模板路径设置
		new Setting(containerEl)
			.setName('Daliy Note Template Path')
			.setDesc('日记模板')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.periodicNotesTemplatePath)
				.onChange(async (value) => {
					this.plugin.settings.periodicNotesTemplatePath = value;
					await this.plugin.saveSettings();
				}));

		// 时间格式设置
		new Setting(containerEl)
			.setName("日记中默认前缀")
			.setDesc("设置日记中Memos的默认前缀")
			.addDropdown((cb) =>
				cb
					.addOption("HH:mm", "HH:mm")
					.addOption("HH:mm:ss", "HH:mm:ss")
					.setValue(this.plugin.settings.periodicNotesTimePrefix)
					.onChange((value) => {
						this.plugin.settings.periodicNotesTimePrefix = value;
						this.plugin.saveSettings();
					})
			);
	}
}
