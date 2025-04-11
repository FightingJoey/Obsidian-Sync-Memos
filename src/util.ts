import { Notice, TFile } from 'obsidian';
import type { App } from 'obsidian';
import type { DailyRecordType, ResourceType } from './type';
import { LogLevel } from './type';
import moment from 'moment';

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function createFile(
  app: App,
  options: {
    templateFile: string;
    folder: string;
    file: string;
    tag?: string;
  }
) {
  if (!app) {
    return;
  }

  const { templateFile, folder, file, tag } = options;
  const templateTFile = app.vault.getAbstractFileByPath(templateFile!);
  const finalFile = file.match(/\.md$/) ? file : `${file}.md`;

  if (!templateTFile) {
    return logMessage('模版文件不存在' + templateFile)
  }

  if (templateTFile instanceof TFile) {
    const templateContent = await app.vault.cachedRead(templateTFile);

    if (!folder || !finalFile) {
      return;
    }

    const tFile = app.vault.getAbstractFileByPath(finalFile);

    if (tFile && tFile instanceof TFile) {
      return await app.workspace.getLeaf().openFile(tFile);
    }

    if (!app.vault.getAbstractFileByPath(folder)) {
      app.vault.createFolder(folder);
    }

    let fileCreated = await app.vault.create(finalFile, templateContent);

    await app.fileManager.processFrontMatter(fileCreated, (frontMatter) => {
      if (!tag) {
        return;
      }

      frontMatter.tags = frontMatter.tags || [];
      frontMatter.tags.push(tag.replace(/^#/, ''));
    });
    await sleep(30); // 等待被索引，否则读取不到 frontmatter：this.app.metadataCache.getFileCache(file)
    // await app.workspace.getLeaf().openFile(fileCreated);
    return fileCreated
  }
}

export function formatDailyRecord(record: DailyRecordType, timeFormat: string) {
  const { createdTs, createdAt, content, resourceList } = record;
  let timeStamp = createdAt ? moment(createdAt).unix() : createdTs;
  const [date, time] = moment(timeStamp * 1000)
    .format(`YYYY-MM-DD ${timeFormat}`)
    .split(' ');

  timeStamp = moment(
      `${date}-${time}`,
      `YYYY-MM-DD-${timeFormat}`
    ).unix();

  let targetFirstLine = `- ${time} `;
  const otherLine = content.trim().split('\n');
  
  let targetOtherLine = ''
  if (otherLine?.length > 1) {
    targetOtherLine = otherLine?.length //剩余行
    ? '\n' +
      otherLine
        .map((line: string) => `\t${line}`)
        .join('\n')
    : '';
  } else {
    targetOtherLine = content.trim()
  }

  const finalTargetContent = targetFirstLine + targetOtherLine
  return [date, timeStamp, finalTargetContent].map(String);
}

export function logMessage(message: string, level: LogLevel = LogLevel.info) {
  new Notice(message, 5000);

  if (level === LogLevel.info) {
    console.info(message);
  } else if (level === LogLevel.warning) {
    console.warn(message);
  } else if (level === LogLevel.error) {
    console.error(message);
    throw Error(message);
  }
}

export function generateHeaderRegExp(header: string) {
  const formattedHeader = /^#+/.test(header.trim())
    ? header.trim()
    : `# ${header.trim()}`;
  const reg = new RegExp(`(${formattedHeader}[^\n]*)([\\s\\S]*?)(?=\\n##|$)`);

  return reg;
}
