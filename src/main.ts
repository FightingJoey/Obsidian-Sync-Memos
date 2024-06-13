import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';

import { MemosSettings, DEFAULT_MEMOS_SETTINGS } from "./settings";

import { DailyRecord } from './DailyRecord';

export default class SyncMemos extends Plugin {
	settings: MemosSettings;
	dailyRecord: DailyRecord;
	// timeout: NodeJS.Timeout;
  	// interval: NodeJS.Timer;
	file: File;

	async onload() {
		await this.loadSettings();

		const ribbonIconEl = this.addRibbonIcon('refresh-cw', 'Sync Memos', (evt: MouseEvent) => {
			this.dailyRecord.forceSync();
		});

		this.loadDailyRecord();

		// 设置页面
		this.addSettingTab(new SyncMemosSettingTab(this.app, this));
	}

	onunload() {
		// clearTimeout(this.timeout);
		// clearInterval(this.interval);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_MEMOS_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	loadDailyRecord() {
		this.dailyRecord = new DailyRecord(
			this.app,
			this.settings
		);

		// clearTimeout(this.timeout);
		// clearInterval(this.interval);

		// // sync on start
		// this.timeout = setTimeout(() => this.dailyRecord.sync(), 15 * 1000);
		// // sync every 0.5 hour
		// this.interval = setInterval(
		//   () => this.dailyRecord.sync(),
		//   0.5 * 60 * 60 * 1000
		// );
	}
}

class SyncMemosSettingTab extends PluginSettingTab {
	plugin: SyncMemos;

	constructor(app: App, plugin: SyncMemos) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(this.containerEl).setName("General Settings").setHeading();

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

		new Setting(containerEl)
			.setName('Memos Token')
			.setDesc('The token of you service API')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.memosToken)
				.onChange(async (value) => {
					this.plugin.settings.memosToken = value;
					await this.plugin.saveSettings();
				}));

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

		new Setting(containerEl)
			.setName("日记中默认前缀")
			.setDesc(
				"设置日记中Memos的默认前缀"
			)
			.addDropdown((cb) =>
				cb
					.addOption("HH:mm", "HH:mm")
					.addOption("HH:mm:ss", "HH:mm:ss")
					.setValue(this.plugin.settings.periodicNotesTimePrefix)
					.onChange((value: "HH:mm" | "HH:mm:ss") => {
						this.plugin.settings.periodicNotesTimePrefix = value;
						this.plugin.saveSettings();
					})
			);
	}
}
