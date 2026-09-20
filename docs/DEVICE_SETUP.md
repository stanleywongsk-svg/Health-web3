# HealthLoop：完成本機環境與實機驗證

這是操作指南，不是已完成驗證的證據。2026-09-20 本次只做讀取檢查：磁碟剩約2GB；Xcode26.3可顯示版本，但 `xcodebuild -checkFirstLaunchStatus` 返回69；CoreSimulator系統framework缺失；`xcrun simctl list devices`、Docker服務查詢各15秒逾時；目前PATH沒有Supabase CLI。沒有安裝、重啟服務、簽署、開帳戶或部署。

## 1. 先準備磁碟空間

建議先預留約30GB建置餘量；這是本專案操作建議，不是Apple公布的固定最低要求。Xcode元件、Pods、Docker映像和編譯產物都需要空間。由操作者選擇移走不需要的檔案，保留專案與其他應用程式資料。

## 2. 完成Xcode首次設定

先儲存工作。如果先前安裝一直卡住，可重新啟動Mac後開啟 `/Applications/Xcode.app`，完成首次啟動要求的系統元件安裝；在Xcode設定的Components頁面確認iOS平台支援。

目前 `xcode-select -p` 已指向正確的 `/Applications/Xcode.app/Contents/Developer`。若GUI沒有完成必要元件，可在自己的Terminal執行一次：

```sh
sudo xcodebuild -runFirstLaunch
xcodebuild -checkFirstLaunchStatus
xcrun simctl list devices
```

通過條件：首次設定檢查exit0；simctl正常返回，沒有CoreSimulator載入錯誤。simctl列出裝置不代表HealthKit實機驗證完成。若安裝再次長時間無進展，保留安裝錯誤並使用Apple的完整Xcode安裝/修復流程，不要同時堆疊多個first-launch程序，也不要手動複製私有framework。修復環境後才會得知應用程式是否有真正的原生編譯錯誤。

Apple說明：[必要系統元件及平台元件安裝](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components)。

## 3. 恢復Docker及完整本地後端

開啟Docker Desktop，等待Engine啟動。若沒有回應，用Troubleshoot → Restart Docker Desktop。`docker info --format '{{.ServerVersion}}'` 應成功返回服務端版本。Factory Reset或Clean/Purge Data會影響既有Docker資料，不應當作第一步。

[Docker官方修復入口](https://docs.docker.com/desktop/troubleshoot-and-support/troubleshoot/)。

環境恢復後安裝CLI並從原儲存庫啟動本地專案；不要重新執行 `supabase init` 覆蓋現有設定：

```sh
brew install supabase/tap/supabase
supabase --version
cd '/Users/wi/web3 health'
supabase start
```

CLI安裝方式來自[Supabase官方CLI](https://github.com/supabase/cli)。記錄實際安裝版本。新本地專案會使用現有遷移與seed；如果需要重建一個可丟棄的本地測試庫，才執行 `supabase db reset --local`，它會清除該本地庫資料，不能用於需要保留的裝置測試記錄。

本儲存庫的 `supabase/seed.sql` 會設置demo模式。實機流程必須在本地Studio的SQL Editor（`http://127.0.0.1:54323`）執行：

```sql
UPDATE private.system_settings SET demo_mode=false WHERE singleton;
SELECT demo_mode FROM private.system_settings WHERE singleton;
```

查詢必須返回false。每次重新套用seed後都要重新檢查。

建立本地 `supabase/functions/core/.env.local`，保留以下配置：

```dotenv
HEALTHLOOP_ENV=development
HEALTHLOOP_BUILD_MODE=real
HEALTHLOOP_PROJECT_LABEL=healthloop-local-dev
HEALTHLOOP_ALLOWED_ORIGINS=http://localhost:8081
```

若檔案已存在，編輯現有值而非覆蓋其他本地設定。CLI會提供本地Supabase服務配置。從repo根目錄執行並保留此Terminal：

```sh
supabase functions serve core --env-file supabase/functions/core/.env.local
```

郵件測試介面位於 `http://127.0.0.1:54324`。App申請登入後，這裡會顯示真正由本地Supabase Auth產生的6位OTP；設定為10分鐘有效、60秒重發間隔。這驗證本地Auth流程，並不證明外部SMTP寄達。先前55432端口的獨立PostgreSQL只有合成測試用途，不能替代此完整後端。

## 4. 在無空格路徑建置，設定手機連線

原路徑 `web3 health` 曾觸發React Native預編譯Pods的URI錯誤。可從目前已提交程式碼建立一個獨立、無空格路徑的工作目錄（僅首次執行；保留原repo）：

```sh
cd '/Users/wi/web3 health'
git worktree add --detach /Users/wi/healthloop-device HEAD
cd /Users/wi/healthloop-device
export PATH="/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/opt/homebrew/bin:$PATH"
pnpm install --frozen-lockfile
```

如果此路徑已存在，先確認它是本專案工作目錄再使用，不要刪除它。這份工作目錄停在建立時的commit，之後的來源修改需要同步。

在**這份工作目錄**的 `apps/mobile/.env` 填入：

```dotenv
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_DATA_MODE=real
EXPO_PUBLIC_SUPABASE_URL=http://<Mac私網IP>:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<本地公開anon或publishable key>
EXPO_PUBLIC_CORE_API_URL=http://<Mac私網IP>:54321/functions/v1/core
```

Mac與iPhone使用同一可信任區域網路。手機的127.0.0.1代表手機自己；兩個API網址必須使用相同的Mac位址。只把公開客戶端key填入App。原repo的 `.env` 不會自動複製進新工作目錄，修改後要重新啟動Metro。

先用手機Safari開啟 `http://<Mac私網IP>:54321/functions/v1/core/missions`；預期未登入401 JSON，表示路由可達，並非登入成功。若不能連線，檢查Mac防火牆、Wi-Fi裝置隔離和容器端口綁定。App另外需要允許本地網路；若Safari可達而App不可達，再查看原生網路錯誤及生成Info.plist的開發環境HTTP設定，避免關閉所有環境的傳輸保護。

## 5. 簽署、安裝、完成兩部iPhone驗收

在新工作目錄設定由你控制的唯一 `ios.bundleIdentifier`，然後生成iOS專案：

```sh
pnpm --filter @healthloop/mobile prebuild
```

這會重新安裝Pods；先前 `/tmp/healthloop-native-build/ios/Pods` 已因空間不足而移除，不能當作現在仍可用的依賴。

用Xcode開啟 `apps/mobile/ios/app.xcworkspace`，在Signing & Capabilities選擇可用的Apple開發Team，核實HealthKit能力和唯讀用途說明。連接並解鎖iPhone、信任Mac、啟用Developer Mode。Apple的[能力支援表](https://developer.apple.com/help/account/reference/supported-capabilities-ios)列有HealthKit；可先採用本機開發簽署流程，不要自動購買資格或建立雲端建置。

```sh
pnpm --filter @healthloop/mobile ios --device
```

本專案包含自訂原生HealthKit模組，需要自己的development build。[Expo本機建置／裝置安裝說明](https://docs.expo.dev/more/expo-cli/#building)。

先在一部裝置跑通：OTP登入 → 分開同意 → 唯讀健康資料 → 最少化摘要 → 伺服器判定 → 積分帳本。再在第二部裝置重複，並依 [NATIVE_VERIFICATION.md](../apps/mobile/NATIVE_VERIFICATION.md) 驗證無資料、拒絕/撤回、離線重啟、重試不重複入帳、帳戶切換等情境。

記錄commit/build、裝置型號/iOS、案例通過或失敗、B/C復核；真實健康值和未遮蔽截圖留在裝置測試環境。模擬器通過、App可開啟或單次成功都不足以把P03/P31標成完成。這個流程不包含商店發布、正式環境或Lab鏈上交易。
