export interface MemosSettings {
    memosAPI: string;
	memosToken: string;
	dailyRecordHeader: string;
	periodicNotesPath: string;
    periodicNotesTemplatePath: string;
    periodicNotesTimePrefix: string;
}

export const DEFAULT_MEMOS_SETTINGS: MemosSettings = {
    memosAPI: "",
    memosToken: "",
    dailyRecordHeader: "",
    periodicNotesPath: "",
    periodicNotesTemplatePath: "",
    periodicNotesTimePrefix: "HH:mm"
}