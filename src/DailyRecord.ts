import axios, { Axios } from "axios";
import { App, TFile } from "obsidian";
import moment from "moment";
import { type DailyRecordType, type FetchError, LogLevel } from "./type";
import { MemosSettings } from "./settings";
import {
  formatDailyRecord,
  generateHeaderRegExp,
  logMessage,
  createFile,
} from "./util";

// 定义接口
interface DailyRecordData {
  date: string;
  records: {
    [timestamp: string]: string;
  };
}

interface SyncStatus {
  isSyncing: boolean;
  progress: number;
  lastError: string | null;
}

export class DailyRecord {
  private app: App;
  private settings: MemosSettings;
  private limit: number;
  private lastTime: string;
  private offset: number;
  private localKey: string;
  private axios: Axios;
  private syncStatus: SyncStatus;

  constructor(app: App, settings: MemosSettings) {
    this.app = app;
    this.settings = settings;
    this.limit = 50;
    this.offset = 0;
    this.localKey = `sync-memos-daily-record-last-time-${this.settings.memosToken}`;
    this.lastTime = window.localStorage.getItem(this.localKey) || "";
    this.syncStatus = {
      isSyncing: false,
      progress: 0,
      lastError: null,
    };

    this.axios = axios.create({
      headers: {
        Authorization: `Bearer ${this.settings.memosToken}`,
        Accept: "application/json",
      },
      timeout: 10000, // 10秒超时
    });
  }

  private async fetch(): Promise<DailyRecordType[] | null> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const { data } = await this.axios.get<DailyRecordType[] | FetchError>(
          this.settings.memosAPI,
          {
            params: {
              limit: this.limit,
              offset: this.offset,
              rowStatus: "NORMAL",
            },
          }
        );

        if (Array.isArray(data)) {
          return data;
        }

        throw new Error(
          data.message || data.msg || data.error || JSON.stringify(data)
        );
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          logMessage(`拉取 usememos 失败: ${error}`, LogLevel.error);
          this.syncStatus.lastError = `拉取失败: ${error}`;
          return null;
        }
        // 指数退避重试
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retryCount) * 1000)
        );
      }
    }
    return null;
  }

  public async forceSync(): Promise<void> {
    this.lastTime = "";
    await this.sync();
  }

  private updateProgress(progress: number): void {
    this.syncStatus.progress = progress;
    logMessage(`同步进度: ${progress}%`, LogLevel.info);
  }

  public async sync(): Promise<void> {
    if (this.syncStatus.isSyncing) {
      logMessage("同步正在进行中", LogLevel.warning);
      return;
    }

    try {
      this.syncStatus.isSyncing = true;
      this.syncStatus.lastError = null;
      this.updateProgress(0);

      if (!this.validateSettings()) {
        return;
      }

      this.offset = 0;
      await this.insertDailyRecord();

      this.updateProgress(100);
      logMessage("同步完成", LogLevel.success);
    } catch (error) {
      this.syncStatus.lastError = `同步失败: ${error}`;
      logMessage(`同步失败: ${error}`, LogLevel.error);
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  private validateSettings(): boolean {
    if (!this.settings.memosAPI) {
      logMessage("请在插件中设置 usememos 的 API", LogLevel.error);
      return false;
    }

    if (!this.settings.memosToken) {
      logMessage("请在插件中设置 usememos 的 Token", LogLevel.error);
      return false;
    }

    if (!this.settings.dailyRecordHeader) {
      logMessage(
        "请在插件中设置 usememos 需要存储在哪个标题之下",
        LogLevel.error
      );
      return false;
    }

    return true;
  }

  private async insertDailyRecord(): Promise<void> {
    const header = this.settings.dailyRecordHeader;
    const dailyRecordByDay: Record<string, DailyRecordData> = {};
    const records = await this.fetch();

    if (!records || records.length === 0) {
      logMessage("没有新的记录需要同步", LogLevel.info);
      return;
    }

    const mostRecentTimeStamp = records[0]?.createdTs || 0;

    if (mostRecentTimeStamp * 1000 < Number(this.lastTime)) {
      logMessage("结束同步 usememos");
      window.localStorage.setItem(this.localKey, Date.now().toString());
      return;
    }

    // 处理记录
    for (const record of records) {
      if (!record.content && !record.resourceList?.length) {
        continue;
      }

      const [date, timeStamp, formattedRecord] = formatDailyRecord(
        record,
        this.settings.periodicNotesTimePrefix
      );

      if (!dailyRecordByDay[date]) {
        dailyRecordByDay[date] = {
          date,
          records: {},
        };
      }
      dailyRecordByDay[date].records[timeStamp] = formattedRecord;
    }

    // 处理每天的文件
    const dates = Object.keys(dailyRecordByDay);
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      await this.processDailyFile(date, dailyRecordByDay[date], header);
      this.updateProgress(((i + 1) / dates.length) * 100);
    }

    // 继续处理下一页
    this.offset += this.limit;
    await this.insertDailyRecord();
  }

  private async processDailyFile(
    date: string,
    dailyData: DailyRecordData,
    header: string
  ): Promise<void> {
    try {
      const momentDay = moment(date, "YYYY-MM-DD");
      const link = `${this.settings.periodicNotesPath}/${momentDay.format(
        "YYYY-MM-DD"
      )}.md`;
      let targetFile = this.app.metadataCache.getFirstLinkpathDest(
        link,
        this.settings.periodicNotesPath
      );

      if (!targetFile) {
        targetFile = await this.createDailyFile(link);
      }

      if (!targetFile) {
        logMessage(`无法创建或找到文件: ${link}`, LogLevel.error);
        return;
      }

      await this.updateFileContent(targetFile, dailyData, header);
    } catch (error) {
      logMessage(`处理文件失败: ${error}`, LogLevel.error);
    }
  }

  private async createDailyFile(link: string): Promise<TFile | null> {
    try {
      const folder = this.settings.periodicNotesPath;
      const templateFile = this.settings.periodicNotesTemplatePath;

      const target = await createFile(this.app, {
        templateFile,
        folder,
        file: link,
      });

      return target instanceof TFile ? target : null;
    } catch (error) {
      logMessage(`创建文件失败: ${error}`, LogLevel.error);
      return null;
    }
  }

  private async updateFileContent(
    targetFile: TFile,
    dailyData: DailyRecordData,
    header: string
  ): Promise<void> {
    try {
      const reg = generateHeaderRegExp(header);
      const originFileContent = await this.app.vault.read(targetFile);
      const regMatch = originFileContent.match(reg);

      if (!regMatch?.length || !regMatch?.index) {
        logMessage(`找不到标题: ${header}`, LogLevel.warning);
        return;
      }

      const localRecordContent = regMatch[2]?.trim();
      const from = regMatch?.index + regMatch[1].length + 1;
      const to = from + localRecordContent.length;
      const prefix = originFileContent.slice(0, from);
      const suffix = originFileContent.slice(to);

      const localRecordList = localRecordContent
        ? localRecordContent.split(/\n(?=- )/g)
        : [];

      const localRecordListWithTime: Record<string, string> = {};
      const localRecordWithoutTime: string[] = [];

      for (const record of localRecordList) {
        if (/^- (\[.*\] )?\d\d:\d\d/.test(record)) {
          const timeMatch = record.match(/\d\d:\d\d/);
          if (timeMatch) {
            const time = timeMatch[0]?.trim();
            const timeStamp = this.formatTimestamp(dailyData.date, time);
            localRecordListWithTime[timeStamp] = record;
          }
        } else {
          localRecordWithoutTime.push(record);
        }
      }

      const sortedRecordList = this.sortRecords(
        dailyData.records,
        localRecordListWithTime
      );

      const finalRecordContent = localRecordWithoutTime
        .concat(sortedRecordList)
        .join("\n");

      const fileContent =
        prefix.trim() + `\n${finalRecordContent}\n\n` + suffix.trim() + "\n";

      await this.app.vault.modify(targetFile, fileContent);
    } catch (error) {
      logMessage(`更新文件内容失败: ${error}`, LogLevel.error);
      throw error;
    }
  }

  private formatTimestamp(date: string, time: string): number {
    try {
      const momentTime = moment(
        `${date}-${time}`,
        `YYYY-MM-DD-${this.settings.periodicNotesTimePrefix}`,
        true
      );

      if (!momentTime.isValid()) {
        throw new Error("Invalid time format");
      }

      return momentTime.unix();
    } catch (error) {
      logMessage(`时间格式错误: ${error}`, LogLevel.error);
      return 0;
    }
  }

  private sortRecords(
    dailyRecords: Record<string, string>,
    localRecords: Record<string, string>
  ): string[] {
    return Object.entries({
      ...dailyRecords,
      ...localRecords,
    })
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, content]) => content);
  }
}
