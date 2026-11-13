// 第一步：貼上你的 Supabase 專案網址與「公開金鑰」。絕對不要貼入 secret 或 service_role 金鑰。
const 專案網址 = "https://uihkpiflqzclzbopubut.supabase.co";
const 公開金鑰 = "sb_publishable_XH9Clzbf42XVJhzh40xQhQ_sjUXHMlj";

const $ = (id) => document.getElementById(id);
let 雲端 = null;
let 使用者 = null;
let 任務 = [];
let 篩選 = "全部";
let 同步中 = false;
let 編輯中 = false;

function 顯示訊息(內容) { $("notice").textContent = 內容; }
function 顯示畫面(名稱) {
  for (const 區塊 of ["setupPanel", "authPanel", "appPanel"]) $(區塊).classList.toggle("hidden", 區塊 !== 名稱);
}
function 錯誤內容(錯誤) { return 錯誤?.message || "發生未知錯誤，請稍後再試。"; }

// 所有資料都由 Supabase 的資料列安全規則限制為「只能存取自己的任務」。
async function 取得任務() {
  if (!使用者 || 同步中 || 編輯中) return;
  同步中 = true;
  $("syncStatus").textContent = "同步中…";
  try {
    const {data, error} = await 雲端.from("tasks").select("id,title,category,priority,due_date,completed,created_at")
      .eq("user_id", 使用者.id).order("created_at", {ascending:false});
    if (error) throw error;
    任務 = data || [];
    繪製任務();
    $("syncStatus").textContent = "已同步";
  } catch (錯誤) {
    $("syncStatus").textContent = "同步失敗";
    顯示訊息("讀取失敗：" + 錯誤內容(錯誤));
  } finally { 同步中 = false; }
}

function 繪製任務() {
  $("totalCount").textContent = 任務.length;
  $("pendingCount").textContent = 任務.filter(項目 => !項目.completed).length;
  $("doneCount").textContent = 任務.filter(項目 => 項目.completed).length;
  const 清單 = $("taskList");
  清單.replaceChildren();
  const 顯示項目 = 任務.filter(項目 => 篩選 === "全部" || (篩選 === "待完成" ? !項目.completed : 項目.completed));
  $("emptyMessage").classList.toggle("hidden", 顯示項目.length > 0);
  for (const 項目 of 顯示項目) {
    // 以 textContent 寫入使用者輸入的文字，避免被當成網頁程式執行。
    const 列 = document.createElement("li"); 列.className = "task" + (項目.completed ? " completed" : "");
    const 行 = document.createElement("div"); 行.className = "task-line";
    const 主體 = document.createElement("div"); 主體.className = "task-main";
    const 勾選 = document.createElement("input"); 勾選.type = "checkbox"; 勾選.className = "task-check";
    勾選.checked = 項目.completed; 勾選.setAttribute("aria-label", "完成「" + 項目.title + "」");
    勾選.addEventListener("change", async () => {
      勾選.disabled = true;
      const {error} = await 雲端.from("tasks").update({completed:勾選.checked}).eq("id", 項目.id).eq("user_id", 使用者.id);
      if (error) 顯示訊息("更新失敗：" + 錯誤內容(error));
      await 取得任務();
    });
    const 內容 = document.createElement("div"); 內容.className = "task-content";
    const 標題 = document.createElement("div"); 標題.className = "task-title"; 標題.textContent = 項目.title;
    const 標籤列 = document.createElement("div"); 標籤列.className = "meta";
    for (const [文字, 類別] of [[項目.category,""],[項目.priority, 項目.priority === "緊急" ? "urgent" : 項目.priority === "重要" ? "important" : ""], [項目.due_date ? "截止：" + 項目.due_date : "", ""]]) {
      if (!文字) continue;
      const 標籤 = document.createElement("span"); 標籤.className = "tag " + 類別; 標籤.textContent = 文字; 標籤列.append(標籤);
    }
    內容.append(標題, 標籤列); 主體.append(勾選, 內容);
    const 操作 = document.createElement("div"); 操作.className = "task-actions";
    const 編輯 = document.createElement("button"); 編輯.className = "small"; 編輯.textContent = "編輯";
    // 直接在任務下方編輯，不使用手機瀏覽器可能封鎖的彈出視窗。
    編輯.addEventListener("click", () => {
      if (編輯中) { 顯示訊息("請先完成目前正在編輯的任務。"); return; }
      編輯中 = true;
      const 表單 = document.createElement("form");
      表單.className = "edit-form";
      const 標題欄 = document.createElement("input");
      標題欄.value = 項目.title;
      標題欄.maxLength = 120;
      標題欄.required = true;
      標題欄.setAttribute("aria-label", "任務名稱");

      const 分類欄 = document.createElement("select");
      分類欄.setAttribute("aria-label", "任務分類");
      for (const 名稱 of ["課業", "研究", "工作", "個人"]) {
        const 選項 = document.createElement("option");
        選項.value = 名稱; 選項.textContent = 名稱;
        分類欄.append(選項);
      }
      分類欄.value = 項目.category;

      const 優先欄 = document.createElement("select");
      優先欄.setAttribute("aria-label", "優先程度");
      for (const 名稱 of ["一般", "重要", "緊急"]) {
        const 選項 = document.createElement("option");
        選項.value = 名稱; 選項.textContent = 名稱;
        優先欄.append(選項);
      }
      優先欄.value = 項目.priority;

      const 日期欄 = document.createElement("input");
      日期欄.type = "date";
      日期欄.value = 項目.due_date || "";
      日期欄.setAttribute("aria-label", "截止日期");

      const 按鈕列 = document.createElement("div");
      按鈕列.className = "edit-actions";
      const 儲存 = document.createElement("button");
      儲存.type = "submit"; 儲存.textContent = "儲存修改";
      const 取消 = document.createElement("button");
      取消.type = "button"; 取消.className = "secondary"; 取消.textContent = "取消";
      取消.addEventListener("click", () => {
        編輯中 = false;
        表單.remove();
        行.classList.remove("hidden");
        顯示訊息("");
        取得任務();
      });
      按鈕列.append(儲存, 取消);
      表單.append(標題欄, 分類欄, 優先欄, 日期欄, 按鈕列);
      列.append(表單);
      行.classList.add("hidden");
      標題欄.focus();

      表單.addEventListener("submit", async (事件) => {
        事件.preventDefault();
        const 新名稱 = 標題欄.value.trim();
        if (!新名稱) { 顯示訊息("任務名稱不能留白。"); return; }
        儲存.disabled = true;
        取消.disabled = true;
        try {
          const {error} = await 雲端.from("tasks").update({
            title: 新名稱,
            category: 分類欄.value,
            priority: 優先欄.value,
            due_date: 日期欄.value || null
          }).eq("id", 項目.id).eq("user_id", 使用者.id);
          if (error) throw error;
          編輯中 = false;
          顯示訊息("修改已儲存！");
          await 取得任務();
        } catch (錯誤) {
          顯示訊息("編輯失敗：" + 錯誤內容(錯誤));
          儲存.disabled = false;
          取消.disabled = false;
        }
      });
    });
    const 刪除 = document.createElement("button"); 刪除.className = "small danger"; 刪除.textContent = "移除";
    刪除.addEventListener("click", async () => {
      if (!confirm("確定要將這項任務從清單移除嗎？")) return;
      const {error} = await 雲端.from("tasks").delete().eq("id", 項目.id).eq("user_id", 使用者.id);
      if (error) 顯示訊息("移除失敗：" + 錯誤內容(error));
      await 取得任務();
    });
    操作.append(編輯, 刪除); 行.append(主體, 操作); 列.append(行); 清單.append(列);
  }
}

async function 初始化登入狀態() {
  const {data:{session},error} = await 雲端.auth.getSession();
  if (error) 顯示訊息(錯誤內容(error));
  使用者 = session?.user || null;
  $("accountEmail").textContent = 使用者?.email || "";
  $("logoutButton").classList.toggle("hidden", !使用者);
  顯示畫面(使用者 ? "appPanel" : "authPanel");
  if (使用者) await 取得任務(); else {任務=[];繪製任務();}
}

async function 啟動() {
  if (專案網址.startsWith("請填入") || 公開金鑰.startsWith("請填入")) {顯示畫面("setupPanel"); return;}
  if (!window.supabase?.createClient) {顯示畫面("setupPanel");顯示訊息("無法載入雲端程式庫，請確認網路連線。");return;}
  // 保留登入狀態：關閉網頁後再次開啟，會自動恢復帳號登入。
  // 登出、無痕模式或清除網站資料後，仍需要重新登入。
  雲端 = window.supabase.createClient(專案網址, 公開金鑰, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  await 初始化登入狀態();
  雲端.auth.onAuthStateChange((事件) => {
    if (事件 === "SIGNED_IN" || 事件 === "SIGNED_OUT") {
      // 避免在登入回呼中直接查詢資料而造成鎖定。
      setTimeout(() => 初始化登入狀態(), 0);
    }
  });
}

$("authForm").addEventListener("submit", async (事件) => {
  事件.preventDefault();
  const {error} = await 雲端.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  if (error) 顯示訊息("登入失敗：" + 錯誤內容(error)); else await 初始化登入狀態();
});
$("signupButton").addEventListener("click", async () => {
  if (!$("authForm").reportValidity()) return;
  const {data,error} = await 雲端.auth.signUp({email:$("email").value.trim(),password:$("password").value});
  if (error) 顯示訊息("註冊失敗：" + 錯誤內容(error));
  else 顯示訊息(data.session ? "註冊完成，已登入。" : "已送出註冊要求，請至信箱確認驗證郵件後再登入。");
});
$("logoutButton").addEventListener("click", async () => {
  const {error} = await 雲端.auth.signOut();
  if (error) 顯示訊息("登出失敗：" + 錯誤內容(error)); else await 初始化登入狀態();
});
$("taskForm").addEventListener("submit", async (事件) => {
  事件.preventDefault();
  if (!使用者) return;
  const 標題 = $("taskTitle").value.trim(); if (!標題) return;
  $("addButton").disabled = true;
  const {error} = await 雲端.from("tasks").insert({user_id:使用者.id,title:標題,category:$("taskCategory").value,priority:$("taskPriority").value,due_date:$("taskDue").value || null});
  $("addButton").disabled = false;
  if (error) 顯示訊息("新增失敗：" + 錯誤內容(error));
  else {$("taskTitle").value="";$("taskDue").value="";顯示訊息("新增成功！");await 取得任務();}
});
document.querySelectorAll("[data-filter]").forEach(按鈕 => 按鈕.addEventListener("click", () => {
  篩選 = 按鈕.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(項目 => 項目.classList.toggle("active", 項目 === 按鈕));
  繪製任務();
}));
// 在手機切回網頁，以及每隔十五秒自動取得其他裝置的最新變更。
document.addEventListener("visibilitychange", () => {if (!document.hidden) 取得任務();});
window.addEventListener("focus", () => 取得任務());
setInterval(() => {if (!document.hidden) 取得任務();}, 15000);
啟動();
