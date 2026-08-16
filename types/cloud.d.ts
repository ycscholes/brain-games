declare interface MiniProgramCloudCallResult<T> {
  result: T;
}

declare interface MiniProgramCloudFunctionApi {
  init(options: { env: string; traceUser?: boolean }): void;
  callFunction<T>(options: {
    name: string;
    data?: Record<string, unknown>;
  }): Promise<MiniProgramCloudCallResult<T>>;
  uploadFile(options: {
    cloudPath: string;
    filePath: string;
  }): Promise<{
    fileID: string;
  }>;
  deleteFile(options: {
    fileList: string[];
  }): Promise<unknown>;
  getTempFileURL(options: {
    fileList: string[];
  }): Promise<{
    fileList: Array<{
      fileID: string;
      tempFileURL?: string;
      status?: number;
      errMsg?: string;
    }>;
  }>;
}

declare interface OfficialAccountPublishOptions {
  title: string;
  content?: string;
  tags?: string[];
  images?: string[];
  recommendPath?: string;
  recommendTitle?: string;
  success?: (result: { status?: string; postUrl?: string }) => void;
  fail?: () => void;
  complete?: () => void;
}

declare interface MiniProgramShareApi {
  shareToOfficialAccount(options: OfficialAccountPublishOptions): void;
}

declare const wx:
  | {
      cloud?: MiniProgramCloudFunctionApi;
      shareToOfficialAccount?: MiniProgramShareApi["shareToOfficialAccount"];
    }
  | undefined;
