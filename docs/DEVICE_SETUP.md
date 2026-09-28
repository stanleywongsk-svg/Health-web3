# HealthLoop：完成本機環境與實機驗證

**2026-09-24 更新：原生編譯與模擬器啟動已通過。** Xcode26.3首次設定與CoreSimulator現在正常；新prebuild、97個Pods、未簽署iPhoneOS編譯，以及含JavaScript的模擬器Release編譯、安裝、啟動均實際成功。模擬器先驗證配置提示，再以本地ad-hoc簽署顯示乾淨的簡體中文登入畫面。完全關閉簽署會使Keychain缺少entitlement（-34018），不適合登入測試；不要為此關閉安全儲存。確切命令及本機產物見 [NATIVE_BUILD_EVIDENCE.md](NATIVE_BUILD_EVIDENCE.md)。目前沒有有效簽署身份；未完成真實iPhone安裝或HealthKit讀取。

Docker Desktop4.92.0、Engine29.8.0及CLI29.8.1正常，Supabase CLI2.117.0已鎖定在專案依賴。本機合成Auth/API環境請依 [LOCAL_STACK_TESTING.md](LOCAL_STACK_TESTING.md) 啟動；原生實機環境與此測試資料庫分開準備。Docker首次下載的舊憑證工具連結已修正；原先的sudo替換指令已作廢，不要重跑。

以下是操作指南，不是實機驗收證據。這部Mac已無需重做Xcode首次安裝；第2節只供其他或重新出錯的宿主排障。下一個實機門檻是操作者的Apple簽署身份、HealthKit能力及兩部兼容iPhone。

先用可重複的唯讀檢查取代猜測：

```sh
cd /Users/wi/healthloop
export PATH="/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/opt/homebrew/bin:$PATH"
node scripts/native-check.ts
```

失敗會返回exit1；各外部檢查最多12秒。不會安裝、接受許可、重啟服務、列印key或裝置識別碼。需要手機環境檔檢查時另外執行 `node scripts/native-check.ts --env-file apps/mobile/.env`；它只驗證格式，不證明網路或登入成功。完整實際記錄見 [NATIVE_BUILD_EVIDENCE.md](NATIVE_BUILD_EVIDENCE.md)。

## 1. 先準備磁碟空間

2026-09-24兩種原生建置及容器下載後曾量得約103GiB可用；使用前重查。建議持續預留約30GiB建置餘量；這是本專案操作建議，不是Apple公布的固定最低要求。Xcode元件、Pods、Docker映像和編譯產物都需要空間。由操作者選擇移走不需要的檔案，保留專案與其他應用程式資料。

## 2. 只在預檢失敗時修復Xcode首次設定

先儲存工作。如果先前安裝一直卡住，可重新啟動Mac後開啟 `/Applications/Xcode.app`，完成首次啟動要求的系統元件安裝；在Xcode設定的Components頁面確認iOS平台支援。

2026-09-20失敗時 `xcode-select -p` 已指向正確的 `/Applications/Xcode.app/Contents/Developer`。當時XcodeSystemResources、MobileDevice、MobileDeviceDevelopment及對應CoreTypes安裝包缺少安裝記錄；2026-09-24預檢已通過。以下修復命令僅在新診斷仍失敗時適用。`/Library/Developer`屬於root，不能以一般使用者直接補檔。請由操作者在Xcode介面審閱許可並完成系統元件安裝；`-runFirstLaunch`也會同時接受許可，必須由操作者了解並決定執行。若採CLI，先確認沒有另一個首次安裝正在進行，再於自己的Terminal執行一次：

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
cd /Users/wi/healthloop
pnpm install --frozen-lockfile
pnpm exec supabase --version
```

本機合成測試請改用 [LOCAL_STACK_TESTING.md](LOCAL_STACK_TESTING.md) 的專案範圍啟動命令，確認端口實際只綁定127.0.0.1。不要假設Docker network的預設位址已生效。

專案依賴安裝方式來自[Supabase官方CLI指南](https://supabase.com/docs/guides/local-development/cli/getting-started)。記錄實際安裝版本。新本地專案會使用現有遷移與seed；如果需要重建一個可丟棄的本地測試庫，才執行 `supabase db reset --local`，它會清除該本地庫資料，不能用於需要保留的裝置測試記錄。

本儲存庫的 `supabase/seed.sql` 會設置demo模式。實機流程需在其獨立開發資料庫使用受信任SQL連線執行以下指令。合成測試啟动會排除Studio以節省資源，不保證54323有服務；若實機環境另啟用Studio，才使用該環境的SQL Editor：

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
pnpm exec supabase functions serve core --env-file supabase/functions/core/.env.local
```

郵件測試介面位於 `http://127.0.0.1:54324`。App申請登入後，這裡會顯示真正由本地Supabase Auth產生的6位OTP；設定為10分鐘有效、60秒重發間隔。這驗證本地Auth流程，並不證明外部SMTP寄達。先前55432端口的獨立PostgreSQL只有合成測試用途，不能替代此完整後端。

## 4. 在無空格路徑建置，設定手機連線

目前 `/Users/wi/healthloop` 本身沒有空格，可直接使用。舊路徑 `web3 health` 曾觸發React Native預編譯Pods的URI錯誤。若希望獨立驗證，可從目前已提交程式碼建立另一個無空格工作目錄（僅首次執行；保留原repo）：

```sh
cd /Users/wi/healthloop
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

新增或修改原生依賴（包括本地通知）後需要重新生成並編譯development build，單純刷新Metro不足以載入原生模組。這會重新安裝Pods；先前 `/tmp/healthloop-native-build/ios/Pods` 已因空間不足而移除，不能當作現在仍可用的依賴。

用Xcode開啟 `apps/mobile/ios/app.xcworkspace`，在Signing & Capabilities選擇可用的Apple開發Team，核實HealthKit能力和唯讀用途說明。本地提醒不使用APNs；生成entitlements應沒有`aps-environment`，Info.plist應没有`remote-notification`背景模式。連接並解鎖iPhone、信任Mac、啟用Developer Mode。Apple的[能力支援表](https://developer.apple.com/help/account/reference/supported-capabilities-ios)列有HealthKit；可先採用本機開發簽署流程，不要自動購買資格或建立雲端建置。

```sh
pnpm --filter @healthloop/mobile ios --device
```

本專案包含自訂原生HealthKit模組，需要自己的development build。[Expo本機建置／裝置安裝說明](https://docs.expo.dev/more/expo-cli/#building)。

先在一部裝置跑通：OTP登入 → 分開同意 → 唯讀健康資料 → 最少化摘要 → 伺服器判定 → 積分帳本。再在第二部裝置重複，並依 [NATIVE_VERIFICATION.md](../apps/mobile/NATIVE_VERIFICATION.md) 驗證無資料、拒絕/撤回、離線重啟、重試不重複入帳、帳戶切換等情境。

記錄commit/build、裝置型號/iOS、案例通過或失敗、B/C復核；真實健康值和未遮蔽截圖留在裝置測試環境。模擬器通過、App可開啟或單次成功都不足以把P03/P31標成完成。這個流程不包含商店發布、正式環境或Lab鏈上交易。
