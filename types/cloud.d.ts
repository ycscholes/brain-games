declare interface MiniProgramCloudCallResult<T> {
  result: T;
}

declare interface MiniProgramCloudFunctionApi {
  init(options: { env: string; traceUser?: boolean }): void;
  callFunction<T>(options: {
    name: string;
    data?: Record<string, unknown>;
  }): Promise<MiniProgramCloudCallResult<T>>;
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

declare const wx:
  | {
      cloud?: MiniProgramCloudFunctionApi;
    }
  | undefined;
