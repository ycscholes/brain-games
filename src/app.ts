import { PropsWithChildren } from "react";
import { useLaunch } from "@tarojs/taro";
import { initializeCloudSync } from "./services/user-data/sync/userDataSyncService";

import "./app.scss";

const CLOUD_SYNC_START_DELAY_MS = 1200;

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    setTimeout(() => {
      void initializeCloudSync().catch(() => {
        // cloud backup should never block local usage
      });
    }, CLOUD_SYNC_START_DELAY_MS);
    console.log("App launched.");
  });

  // children 是将要会渲染的页面
  return children;
}

export default App;
