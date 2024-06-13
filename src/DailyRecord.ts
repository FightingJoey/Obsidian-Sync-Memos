import axios, { Axios } from 'axios';
import { App, TFile, moment, normalizePath } from 'obsidian';
import {
  type DailyRecordType,
  type FetchError,
  type ResourceType,
  LogLevel,
} from './type';
import { MemosSettings } from "./settings";
import {
  formatDailyRecord,
  generateHeaderRegExp,
  logMessage,
  createFile,
} from './util';

export class DailyRecord {
  app: App;
  settings: MemosSettings;
  limit: number;
  lastTime: string;
  offset: number;
  localKey: string;
  locale: string;
  axios: Axios;
  constructor(app: App, settings: MemosSettings) {
    this.app = app;
    this.settings = settings;
    this.limit = 50;
    this.offset = 0;
    this.localKey = `sync-memos-daily-record-last-time-${this.settings.memosToken}`;
    this.lastTime = window.localStorage.getItem(this.localKey) || '';
    this.axios = axios.create({
      headers: {
        Authorization: `Bearer ${this.settings.memosToken}`,
        Accept: 'application/json',
      },
    });
  }

  async fetch() {
    try {
      const { data } = await this.axios.get<DailyRecordType[] | FetchError>(
        this.settings.memosAPI,
        {
          params: {
            limit: this.limit,
            offset: this.offset,
            rowStatus: 'NORMAL',
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
      logMessage(
        `拉取 usememos 失败: ${error}`,
        LogLevel.error
      );
    }
  }

  forceSync = async () => {
    this.lastTime = '';
    this.sync();
  };

  sync = async () => {
    logMessage('开始同步 usememos');
    if (!this.settings.memosAPI) {
      logMessage('请在插件中设置 usememos 的 API');
      return;
    }

    if (!this.settings.memosToken) {
      logMessage('请在插件中设置 usememos 的 Token');
      return;
    }

    if (!this.settings.dailyRecordHeader) {
      logMessage('请在插件中设置 usememos 需要存储在哪个标题之下');
      return;
    }
    this.offset = 0;
    this.insertDailyRecord();
  };

  insertDailyRecord = async () => {
    const header = this.settings.dailyRecordHeader;
    const dailyRecordByDay: Record<string, Record<string, string>> = {};
    const records = (await this.fetch()) || [];
    const mostRecentTimeStamp = records[0]?.createdAt
      ? moment(records[0]?.createdAt).unix()
      : records[0]?.createdTs;

    if (!records.length || mostRecentTimeStamp * 1000 < Number(this.lastTime)) {
      // 直到 record 返回为空，或者最新的一条记录的时间，晚于上一次同步时间
      logMessage('结束同步 usememos');

      window.localStorage.setItem(this.localKey, Date.now().toString());

      return;
    }

    for (const record of records) {
      if (!record.content && !record.resourceList?.length) {
        continue;
      }

      const [date, timeStamp, formattedRecord] = formatDailyRecord(record, `${this.settings.periodicNotesTimePrefix}`);

      if (dailyRecordByDay[date]) {
        dailyRecordByDay[date][timeStamp] = formattedRecord;
      } else {
        dailyRecordByDay[date] = {
          [timeStamp]: formattedRecord,
        };
      }
    }

    await Promise.all(
      Object.keys(dailyRecordByDay).map(async (today) => {
        const momentDay = moment(today);
        const link = `${this.settings.periodicNotesPath}/${momentDay.format('YYYY-MM-DD')}.md`;
        let targetFile = this.app.metadataCache.getFirstLinkpathDest(link, this.settings.periodicNotesPath);

        if (!targetFile) {
          const folder = `${this.settings.periodicNotesPath}`;
          const file = link
          const templateFile = `${this.settings.periodicNotesTemplatePath}`;

          const target = await createFile(this.app, {
            templateFile,
            folder,
            file,
          });

          if (target instanceof TFile) {
            targetFile = target
          }
        }

        const reg = generateHeaderRegExp(header);

        if (targetFile instanceof TFile) {
          const originFileContent = await this.app.vault.read(targetFile);
          const regMatch = originFileContent.match(reg);

          if (!regMatch?.length || !regMatch?.index) {
            if (!this.settings.dailyRecordHeader) {
              logMessage(
                'Current daily file will not insert daily record due to no daily record header'
              );
              return;
            }
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
            const regMatch = record.match(/.*\^(\d{10})/);
            const createdTs = regMatch?.length ? regMatch[1]?.trim() : '';

            if (/^- (\[.*\] )?\d\d:\d\d/.test(record)) {
              // 本地有时间的记录
              const regMatch = record.match(/\d\d:\d\d/);

              if (regMatch) {
                const time = regMatch[0]?.trim();
                const timeStamp = moment(
                  `${today}-${time}`,
                  `YYYY-MM-DD-${this.settings.periodicNotesTimePrefix}`
                ).unix();

                localRecordListWithTime[timeStamp] = record;
              }
            } else {
              localRecordWithoutTime.push(record);
            }
          }

          const sortedRecordList = Object.entries({
            ...dailyRecordByDay[today],
            ...localRecordListWithTime,
          })
            .sort((a, b) => {
              const indexA = Number(a[0]);
              const indexB = Number(b[0]);
              return indexA - indexB;
            })
            .map((item) => item[1]);

          const finalRecordContent = localRecordWithoutTime
            .concat(sortedRecordList)
            .join('\n');
          const fileContent =
            prefix.trim() +
            `\n${finalRecordContent}\n\n` +
            suffix.trim() +
            '\n';

          await this.app.vault.modify(targetFile, fileContent);
        }
      })
    );

    this.offset = this.offset + this.limit;
    this.insertDailyRecord();
  };
}
