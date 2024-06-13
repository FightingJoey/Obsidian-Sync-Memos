export interface MemosSettings {
    memosAPI: string;
	memosToken: string;
    memosResourcePath: string;
	dailyRecordHeader: string;
	periodicNotesPath: string;
    periodicNotesTemplatePath: string;
    periodicNotesTimePrefix: string;
}

export const DEFAULT_MEMOS_SETTINGS: MemosSettings = {
    memosAPI: "",
    memosToken: "",
    memosResourcePath: "",
    dailyRecordHeader: "",
    periodicNotesPath: "",
    periodicNotesTemplatePath: "",
    periodicNotesTimePrefix: "HH:mm"
}