declare interface MiniProgramCloudCallResult<T> {
  result: T;
}

declare interface MiniProgramCloudFunctionApi {
  init(options: { env: string; traceUser?: boolean }): void;
  callFunction<T>(options: {
    name: string;
    data?: Record<string, unknown>;
  }): Promise<MiniProgramCloudCallResult<T>>;
}

declare const wx:
  | {
      cloud?: MiniProgramCloudFunctionApi;
    }
  | undefined;
