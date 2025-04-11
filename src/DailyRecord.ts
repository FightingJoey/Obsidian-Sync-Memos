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

// 定义每日记录数据结构
interface DailyRecordData {
  date: string;           // 日期
  records: {             // 记录集合，key为时间戳，value为记录内容
    [timestamp: string]: string;
  };
}

// 定义同步状态接口
interface SyncStatus {
  isSyncing: boolean;    // 是否正在同步
  progress: number;      // 同步进度
  lastError: string | null; // 最后一次错误信息
}

/**
 * DailyRecord 类：负责处理 Memos 的同步和存储
 * 主要功能：
 * 1. 从 Memos API 获取数据
 * 2. 将数据同步到 Obsidian 日记中
 * 3. 支持增量同步和当日同步
 */
export class DailyRecord {
  private app: App;                    // Obsidian 应用实例
  private settings: MemosSettings;     // 插件设置
  private limit: number;               // API 分页大小
  private lastTime: string;            // 上次同步时间
  private offset: number;              // API 分页偏移量
  private localKey: string;            // localStorage 存储键
  private axios: Axios;               // HTTP 客户端
  private syncStatus: SyncStatus;      // 同步状态
  private readonly TOLERANCE = 1;      // 时间容差（秒）

  /**
   * 构造函数：初始化 DailyRecord 实例
   * @param app Obsidian 应用实例
   * @param settings 插件设置
   */
  constructor(app: App, settings: MemosSettings) {
    this.app = app;
    this.settings = settings;
    this.limit = 50;
    this.offset = 0;
    // 使用 memosToken 作为 localStorage 的 key 的一部分，确保不同用户的同步状态互不影响
    this.localKey = `sync-memos-daily-record-last-time-${this.settings.memosToken}`;
    this.lastTime = window.localStorage.getItem(this.localKey) || "";
    this.syncStatus = {
      isSyncing: false,
      progress: 0,
      lastError: null,
    };

    // 初始化 axios 实例，设置认证和超时
    this.axios = axios.create({
      headers: {
        Authorization: `Bearer ${this.settings.memosToken}`,
        Accept: "application/json",
      },
      timeout: 10000, // 10秒超时
    });
  }

  /**
   * 从 Memos API 获取数据
   * 包含重试机制和错误处理
   * @returns 返回 Memos 记录数组或 null
   */
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

  /**
   * 强制同步：清空上次同步时间，同步所有记录
   */
  public async forceSync(): Promise<void> {
    this.lastTime = "";
    await this.fetch();
  }

  /**
   * 更新同步进度
   * @param progress 进度百分比
   */
  private updateProgress(progress: number): void {
    this.syncStatus.progress = progress;
    logMessage(`同步进度: ${progress}%`, LogLevel.info);
  }

  /**
   * 获取当日开始时间戳（秒级）
   * @returns 返回当日 00:00:00 的时间戳
   */
  private getTodayStartTimestamp(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor(today.getTime() / 1000);
  }

  /**
   * 同步当日记录
   * 只同步今天创建的 Memos
   */
  public async syncToday(): Promise<void> {
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
      await this.insertDailyRecord(true);

      this.updateProgress(100);
      logMessage("当日同步完成", LogLevel.success);
    } catch (error) {
      this.syncStatus.lastError = `同步失败: ${error}`;
      logMessage(`同步失败: ${error}`, LogLevel.error);
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  /**
   * 插入每日记录
   * @param todayOnly 是否只同步今日记录
   */
  private async insertDailyRecord(todayOnly: boolean = false): Promise<void> {
    const header = this.settings.dailyRecordHeader;
    const dailyRecordByDay: Record<string, DailyRecordData> = {};
    const records = await this.fetch();

    if (!records || records.length === 0) {
      logMessage("没有新的记录需要同步", LogLevel.info);
      return;
    }

    let hasNewRecords = false;
    const lastTimeInSeconds = Number(this.lastTime) || 0;
    const todayStartTimestamp = todayOnly ? this.getTodayStartTimestamp() : 0;

    // 处理每条记录
    for (const record of records) {
      if (!record.content && !record.resourceList?.length) {
        continue;
      }

      const recordTimestamp = record.createdTs;
      
      // 如果是仅同步今日，检查记录是否是今天的
      if (todayOnly && recordTimestamp < todayStartTimestamp) {
        continue;
      }

      // 检查记录是否在容差范围内
      if (recordTimestamp * 1000 < lastTimeInSeconds - this.TOLERANCE * 1000) {
        continue;
      }

      hasNewRecords = true;
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

    // 如果没有新记录，且已经检查完所有页面，则结束同步
    if (!hasNewRecords && this.offset === 0) {
      logMessage("没有新的记录需要同步", LogLevel.info);
      // 更新最后同步时间为当前时间（秒级时间戳）
      window.localStorage.setItem(this.localKey, Math.floor(Date.now() / 1000).toString());
      return;
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
    await this.insertDailyRecord(todayOnly);
  }

  /**
   * 处理每日文件
   * @param date 日期
   * @param dailyData 当日数据
   * @param header 标题
   */
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

  /**
   * 创建每日文件
   * @param link 文件路径
   * @returns 返回创建的文件或 null
   */
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

  /**
   * 更新文件内容
   * @param targetFile 目标文件
   * @param dailyData 当日数据
   * @param header 标题
   */
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

      // 处理本地记录
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

      // 合并并排序记录
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

  /**
   * 格式化时间戳
   * @param date 日期
   * @param time 时间
   * @returns 返回格式化后的时间戳
   */
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

  /**
   * 排序记录
   * @param dailyRecords 每日记录
   * @param localRecords 本地记录
   * @returns 返回排序后的记录列表
   */
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

  /**
   * 验证插件设置是否完整
   * 检查必要的设置项是否已配置：
   * 1. memosAPI - Memos 服务的 API 地址
   * 2. memosToken - Memos 服务的访问令牌
   * 3. dailyRecordHeader - 日记中存储 Memos 的标题
   * 
   * @returns 如果所有必要的设置都已配置返回 true，否则返回 false
   */
  private validateSettings(): boolean {
    // 检查 Memos API 地址是否已设置
    if (!this.settings.memosAPI) {
      logMessage("请在插件中设置 usememos 的 API", LogLevel.error);
      return false;
    }

    // 检查 Memos Token 是否已设置
    if (!this.settings.memosToken) {
      logMessage("请在插件中设置 usememos 的 Token", LogLevel.error);
      return false;
    }

    // 检查日记标题是否已设置
    if (!this.settings.dailyRecordHeader) {
      logMessage(
        "请在插件中设置 usememos 需要存储在哪个标题之下",
        LogLevel.error
      );
      return false;
    }

    return true;
  }
}
