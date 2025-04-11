export type ResourceType = {
  name?: string;
  externalLink?: string;
  type?: string;
  uid?: string;
  id: string;
  filename: string;
  size: number;
};

export type DailyRecordType = {
  rowStatus: "ARCHIVED" | "ACTIVE" | "NORMAL";
  updatedTs: number;
  createdTs: number;
  createdAt: string;
  updatedAt: string;
  content: string;
  resourceList?: ResourceType[];
};

export type FetchError = {
  code: number;
  message: string;
  msg?: string;
  error?: string;
};

export enum LogLevel {
  info = "info",
  error = "error",
  warning = "warning",
  success = "success",
}
