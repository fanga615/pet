/* ============================================
   PawShare - 寵物分享交流平台
   主要 JavaScript 邏輯
   ============================================ */

'use strict';

/* ============================================
   全域狀態
   ============================================ */

let currentUser = null;      // 目前登入的使用者
let selectedTag = 'other';   // 發文時選擇的分類
let postImages = [];         // 發文時上傳的圖片（base64）
let currentFeedTag = 'all';  // 分享區篩選分類
let editAvatarData = null;   // 編輯個人資料時的新頭貼

/* ============================================
   寵物小知識庫
   ============================================ */

const PET_TIPS = [
  '🐶 狗狗在興奮或緊張時會搖尾巴，但尾巴擺動的方向也能代表不同情緒喔！',
  '🐱 貓咪揉肚子時（踩奶）是從小貓時期留下的安撫行為。',
  '🐰 兔子透過磨牙聲表達滿足，輕柔的磨牙聲代表牠們很開心！',
  '🐦 鸚鵡的智力相當於 5 歲小孩，能學習並理解上百個單字。',
  '🐟 養魚前要讓水「養熟」至少 24 小時，讓氯氣揮發更健康。',
  '🐾 每隻寵物的愛語不同，有些喜歡撫摸，有些喜歡玩耍互動。',
  '🌿 薰衣草精油對貓咪有毒，精油使用時要注意通風！',
  '🎾 每天至少 30 分鐘的互動遊戲，能大幅降低寵物焦慮。',
  '🦴 狗狗不能吃葡萄、葡萄乾與洋蔥，這些對牠們有毒！',
  '🐱 貓咪的耳朵可以旋轉 180 度，能精準定位聲音來源。',
];

/* ============================================
   LocalStorage 輔助函式
   ============================================ */

/** 取得所有使用者 */
function getUsers() {
  return JSON.parse(localStorage.getItem('pawshare_users') || '{}');
}

/** 儲存所有使用者 */
function saveUsers(users) {
  localStorage.setItem('pawshare_users', JSON.stringify(users));
}

/** 取得所有貼文（陣列，最新在前） */
function getPosts() {
  return JSON.parse(localStorage.getItem('pawshare_posts') || '[]');
}

/** 儲存所有貼文 */
function savePosts(posts) {
  localStorage.setItem('pawshare_posts', JSON.stringify(posts));
}

/** 取得所有留言 */
function getComments() {
  return JSON.parse(localStorage.getItem('pawshare_comments') || '{}');
}

/** 儲存所有留言 */
function saveComments(comments) {
  localStorage.setItem('pawshare_comments', JSON.stringify(comments));
}

/** 取得按讚紀錄 { postId: [userId, ...] } */
function getLikes() {
  return JSON.parse(localStorage.getItem('pawshare_likes') || '{}');
}

/** 儲存按讚紀錄 */
function saveLikes(likes) {
  localStorage.setItem('pawshare_likes', JSON.stringify(likes));
}

/** 讀取目前登入者 */
function loadCurrentUser() {
  const id = localStorage.getItem('pawshare_session');
  if (!id) return null;
  const users = getUsers();
  return users[id] || null;
}

/** 儲存登入工作階段 */
function saveSession(userId) {
  localStorage.setItem('pawshare_session', userId);
}

/** 清除工作階段 */
function clearSession() {
  localStorage.removeItem('pawshare_session');
}

/* ============================================
   頁面切換
   ============================================ */

/**
 * 切換顯示的頁面
 * @param {string} pageId - 'auth' | 'home' | 'feed' | 'post'
 */
function goPage(pageId) {
  // 關閉所有搜尋框
  document.querySelectorAll('.search-results').forEach(el => el.classList.remove('open'));

  // 隱藏所有頁面（強制 display:none 避免 auth-page flex 蓋過 .page 的 none）
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });

  const page = document.getElementById('page-' + pageId);
  if (!page) return;

  // 需要登入的頁面
  if ((pageId === 'home' || pageId === 'feed' || pageId === 'post') && !currentUser) {
    goPage('auth');
    showToast('🔑', '請先登入', '需要登入才能繼續', 'warning');
    return;
  }

  // 依頁面類型決定 display 方式
  page.style.display = (pageId === 'auth') ? 'flex' : 'block';
  page.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 進入頁面時重整內容
  if (pageId === 'home') refreshHome();
  if (pageId === 'feed') refreshFeed();
  if (pageId === 'post') refreshPostForm();
}

/* ============================================
   認證：登入 / 註冊
   ============================================ */

/** 切換登入/註冊頁籤 */
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((el, i) => {
    el.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1));
  });
  document.getElementById('form-login').classList.toggle('active', tab === 'login');
  document.getElementById('form-register').classList.toggle('active', tab === 'register');
}

/** 預覽註冊頭貼 */
function previewRegAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('regAvatarPreview');
    preview.innerHTML = `<img src="${e.target.result}" alt="頭貼" />`;
    preview._data = e.target.result;
  };
  reader.readAsDataURL(file);
}

/** 執行登入 */
function doLogin() {
  const id  = document.getElementById('loginId').value.trim();
  const pwd = document.getElementById('loginPwd').value;

  if (!id || !pwd) {
    showToast('⚠️', '請填寫完整', '請輸入 ID 和密碼', 'warning');
    return;
  }

  const users = getUsers();
  if (!users[id]) {
    showModal('😿', '找不到帳號', `找不到使用者 ID「${id}」，請確認後再試。`, [
      { label: '重試', style: 'btn-primary', action: '' },
      { label: '立即註冊', style: 'btn-pink', action: "switchAuthTab('register');closeModal();" }
    ]);
    return;
  }

  if (users[id].password !== pwd) {
    showModal('🔐', '密碼錯誤', '密碼不正確，請再試一次。', [
      { label: '重試', style: 'btn-primary', action: '' }
    ]);
    return;
  }

  // 登入成功
  currentUser = users[id];
  saveSession(id);

  document.getElementById('loginId').value = '';
  document.getElementById('loginPwd').value = '';

  showSuccess('🎉', '歡迎回來！', `${currentUser.name} 你好，很高興再次見到你！`);
  setTimeout(() => { hideSuccess(); goPage('home'); }, 1800);
}

/** 執行註冊 */
function doRegister() {
  const id   = document.getElementById('regId').value.trim();
  const name = document.getElementById('regName').value.trim();
  const pwd  = document.getElementById('regPwd').value;
  const avatarPreview = document.getElementById('regAvatarPreview');
  const avatar = avatarPreview._data || null;

  if (!id || !name || !pwd) {
    showToast('⚠️', '請填寫完整', '所有必填欄位都要填寫', 'warning');
    return;
  }

  if (id.length < 3) {
    showToast('⚠️', 'ID 太短', 'ID 至少需要 3 個字元', 'warning');
    return;
  }

  if (pwd.length < 6) {
    showToast('⚠️', '密碼太短', '密碼至少需要 6 個字元', 'warning');
    return;
  }

  const users = getUsers();
  if (users[id]) {
    showToast('😿', '帳號已存在', `ID「${id}」已經被使用，請換一個`, 'error');
    return;
  }

  // 建立新使用者
  users[id] = {
    id,
    name,
    password: pwd,
    avatar,
    createdAt: Date.now()
  };
  saveUsers(users);

  // 清空表單
  document.getElementById('regId').value = '';
  document.getElementById('regName').value = '';
  document.getElementById('regPwd').value = '';
  document.getElementById('regAvatarPreview').innerHTML = '🐾';
  document.getElementById('regAvatarPreview')._data = null;

  showSuccess('🐣', '歡迎加入！', `${name} 的帳號已建立成功！`);
  setTimeout(() => {
    hideSuccess();
    switchAuthTab('login');
    document.getElementById('loginId').value = id;
  }, 1800);
}

/** 登出 */
function doLogout() {
  showModal('👋', '確定要登出嗎？', '期待下次與你的毛小孩再見面！🐾', [
    { label: '取消', style: 'btn-ghost', action: '' },
    { label: '登出', style: 'btn-primary', action: 'confirmLogout()' }
  ]);
}

function confirmLogout() {
  closeModal();
  currentUser = null;
  clearSession();
  showToast('👋', '已登出', '期待你的下次回來！', 'info');
  goPage('auth');
}

/* ============================================
   個人首頁
   ============================================ */

/** 刷新個人首頁 */
function refreshHome() {
  if (!currentUser) return;

  // 重新讀取最新使用者資料
  const users = getUsers();
  currentUser = users[currentUser.id] || currentUser;

  // 更新個人資訊
  renderAvatar(document.getElementById('homeAvatar'), currentUser.avatar, currentUser.name);
  document.getElementById('homeName').textContent = currentUser.name;
  document.getElementById('homeId').textContent   = '@' + currentUser.id;

  // 更新導覽欄頭貼
  updateNavAvatars();

  // 計算統計
  const posts = getPosts().filter(p => p.authorId === currentUser.id);
  const likes = getLikes();
  let totalLikes = 0;
  posts.forEach(p => { totalLikes += (likes[p.id] || []).length; });

  document.getElementById('homePostCount').textContent = posts.length;
  document.getElementById('homeLikeCount').textContent = totalLikes;

  // 渲染我的貼文
  renderPosts(document.getElementById('homePostsGrid'), posts, true);
}

/* ============================================
   分享區
   ============================================ */

/** 刷新分享區 */
function refreshFeed() {
  renderTrending();
  renderFeedPosts();
  // 隨機顯示一個小知識
  const tips = PET_TIPS;
  document.getElementById('petTip').textContent = tips[Math.floor(Math.random() * tips.length)];
}

/** 依分類篩選 */
function filterByTag(tag, btn) {
  currentFeedTag = tag;
  document.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFeedPosts();
}

/** 渲染分享區貼文 */
function renderFeedPosts() {
  let posts = getPosts();
  if (currentFeedTag !== 'all') {
    posts = posts.filter(p => p.tag === currentFeedTag);
  }
  renderPosts(document.getElementById('feedPostsGrid'), posts, false);
}

/** 渲染熱門貼文 */
function renderTrending() {
  const posts  = getPosts();
  const likes  = getLikes();
  const sorted = [...posts].sort((a, b) => (likes[b.id]||[]).length - (likes[a.id]||[]).length);
  const top5   = sorted.slice(0, 5);

  const container = document.getElementById('trendingList');
  if (!container) return;

  if (top5.length === 0) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-light);text-align:center;padding:8px;">還沒有熱門貼文</p>';
    return;
  }

  container.innerHTML = top5.map((p, i) => `
    <div class="trending-item" onclick="scrollToPost('${p.id}')">
      <div class="trending-rank ${i === 0 ? 'top' : ''}">${i + 1}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--text-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.title)}</div>
        <div style="font-size:11px;color:var(--text-light)">❤️ ${(likes[p.id]||[]).length} 讚</div>
      </div>
    </div>
  `).join('');
}

/* ============================================
   貼文渲染引擎
   ============================================ */

/**
 * 渲染貼文列表
 * @param {HTMLElement} container
 * @param {Array} posts
 * @param {boolean} isPersonal - 是否個人首頁模式
 */
function renderPosts(container, posts, isPersonal) {
  if (!container) return;

  if (posts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">${isPersonal ? '📝' : '🌟'}</span>
        <h4>${isPersonal ? '還沒有貼文' : '沒有相關貼文'}</h4>
        <p>${isPersonal ? '快來分享你和寵物的故事吧！' : '換個分類試試，或成為第一個發文的人！'}</p>
        <button class="btn btn-primary btn-sm" onclick="goPage('post')">✏️ 立即發文</button>
      </div>
    `;
    return;
  }

  container.innerHTML = posts.map(p => renderPostCard(p)).join('');
}

/** 產生單則貼文卡片 HTML */
function renderPostCard(post) {
  const users    = getUsers();
  const likes    = getLikes();
  const comments = getComments();
  const author   = users[post.authorId] || { name: '匿名', id: post.authorId, avatar: null };

  const postLikes    = likes[post.id] || [];
  const postComments = comments[post.id] || [];
  const isLiked      = currentUser ? postLikes.includes(currentUser.id) : false;

  const avatarHtml = author.avatar
    ? `<img src="${author.avatar}" alt="頭貼" />`
    : getAvatarEmoji(author.name);

  const tagInfo = getTagInfo(post.tag);
  const imgHtml  = post.images && post.images.length > 0
    ? `<img class="post-img" src="${post.images[0]}" alt="貼文圖片"
           onclick="openLightbox('${post.images[0]}')" />`
    : '';

  const commentsHtml = postComments.map(c => {
    const cu = users[c.authorId] || { name: '匿名', avatar: null };
    const cavHtml = cu.avatar
      ? `<img src="${cu.avatar}" alt="" />`
      : getAvatarEmoji(cu.name);
    return `
      <div class="comment-item">
        <div class="comment-avatar">${cavHtml}</div>
        <div class="comment-bubble">
          <div class="comment-author">${escHtml(cu.name)} <span style="color:var(--text-light);font-weight:400">@${escHtml(cu.id || c.authorId)}</span></div>
          <div class="comment-text">${escHtml(c.text)}</div>
          <div class="comment-time">${timeAgo(c.createdAt)}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <article class="post-card" id="post-${post.id}">
      <div class="post-header">
        <div class="post-avatar">${avatarHtml}</div>
        <div class="post-author-info">
          <div class="post-author-name">${escHtml(author.name)}</div>
          <div class="post-meta">
            <span>@${escHtml(author.id || post.authorId)}</span>
            <span>·</span>
            <span>${timeAgo(post.createdAt)}</span>
            ${post.tag ? `<span class="post-tag ${post.tag}">${tagInfo.icon} ${tagInfo.label}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="post-title">${escHtml(post.title)}</div>
      <div class="post-content collapsed" id="content-${post.id}">${escHtml(post.content)}</div>
      <button class="read-more-btn" id="readmore-${post.id}"
              onclick="toggleContent('${post.id}')">展開 ▼</button>

      ${imgHtml}

      <div class="post-actions">
        <button class="action-btn ${isLiked ? 'liked' : ''}"
                onclick="toggleLike('${post.id}', this)">
          <span class="heart-icon">${isLiked ? '❤️' : '🤍'}</span>
          <span class="like-count">${postLikes.length}</span>
        </button>
        <button class="action-btn comment-btn"
                onclick="toggleComments('${post.id}')">
          💬 <span>${postComments.length}</span>
        </button>
      </div>

      <!-- 留言區 -->
      <div class="comments-section" id="comments-${post.id}">
        <div class="comment-list">${commentsHtml}</div>
        <div class="comment-input-area">
          <div class="comment-avatar" style="width:34px;height:34px;">
            ${currentUser
              ? (currentUser.avatar
                  ? `<img src="${currentUser.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;" />`
                  : getAvatarEmoji(currentUser.name))
              : '👤'}
          </div>
          <textarea class="comment-input" placeholder="留下你的回應... 🐾"
                    id="commentInput-${post.id}"
                    onclick="requireLoginForComment(event)"
                    rows="1"
                    oninput="autoResizeTextarea(this)"></textarea>
          <button class="comment-send-btn" onclick="submitComment('${post.id}')">➤</button>
        </div>
      </div>
    </article>
  `;
}

/* ============================================
   發文功能
   ============================================ */

/** 刷新發文表單 */
function refreshPostForm() {
  if (!currentUser) return;

  // 清空表單
  document.getElementById('postTitle').value   = '';
  document.getElementById('postContent').value = '';
  document.getElementById('postImgPreview').innerHTML = '';
  postImages = [];
  selectedTag = 'other';
  document.querySelectorAll('.tag-option').forEach(b => b.classList.remove('selected'));

  // 顯示發文者資訊
  const avatarEl = document.getElementById('posterAvatar');
  renderAvatar(avatarEl, currentUser.avatar, currentUser.name);
  document.getElementById('posterName').textContent   = currentUser.name;
  document.getElementById('posterIdText').textContent = '@' + currentUser.id;
}

/** 選擇分類標籤 */
function selectTag(btn) {
  document.querySelectorAll('.tag-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedTag = btn.dataset.tag;
}

/** 處理圖片上傳（多張） */
function handlePostImgs(files) {
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      postImages.push(e.target.result);
      updatePostImgPreview();
    };
    reader.readAsDataURL(file);
  });
}

/** 更新圖片預覽 */
function updatePostImgPreview() {
  const grid = document.getElementById('postImgPreview');
  grid.innerHTML = postImages.map((src, i) => `
    <div class="preview-item">
      <img src="${src}" alt="預覽" />
      <button class="preview-remove" onclick="removePostImg(${i})">✕</button>
    </div>
  `).join('');
}

/** 移除預覽圖片 */
function removePostImg(index) {
  postImages.splice(index, 1);
  updatePostImgPreview();
}

/** 拖曳上傳 */
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadArea').classList.add('dragover');
}

function handleDragLeave(e) {
  document.getElementById('uploadArea').classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadArea').classList.remove('dragover');
  handlePostImgs(e.dataTransfer.files);
}

/** 送出貼文 */
function submitPost() {
  if (!currentUser) { goPage('auth'); return; }

  const title   = document.getElementById('postTitle').value.trim();
  const content = document.getElementById('postContent').value.trim();

  if (!title) { showToast('⚠️', '請填寫主題', '貼文需要一個標題', 'warning'); return; }
  if (!content) { showToast('⚠️', '請填寫內容', '告訴大家你的故事吧！', 'warning'); return; }

  const newPost = {
    id:       'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    authorId: currentUser.id,
    title,
    content,
    tag:      selectedTag,
    images:   [...postImages],
    createdAt: Date.now()
  };

  const posts = getPosts();
  posts.unshift(newPost);
  savePosts(posts);

  showSuccess('🚀', '發文成功！', '你的故事已分享給所有人！');
  setTimeout(() => {
    hideSuccess();
    goPage('home');
  }, 1800);
}

/* ============================================
   按讚功能
   ============================================ */

/** 切換按讚 */
function toggleLike(postId, btn) {
  if (!currentUser) {
    showModal('🔑', '請先登入才能按讚！', '加入 PawShare 和大家一起互動吧 🐾', [
      { label: '取消', style: 'btn-ghost', action: '' },
      { label: '去登入', style: 'btn-primary', action: "closeModal();goPage('auth');" }
    ]);
    return;
  }

  const likes = getLikes();
  if (!likes[postId]) likes[postId] = [];

  const idx = likes[postId].indexOf(currentUser.id);
  if (idx === -1) {
    // 按讚
    likes[postId].push(currentUser.id);
    btn.classList.add('liked');
    btn.querySelector('.heart-icon').textContent = '❤️';
    btn.querySelector('.like-count').textContent = likes[postId].length;
    // 心跳動畫
    btn.querySelector('.heart-icon').style.animation = 'none';
    requestAnimationFrame(() => {
      btn.querySelector('.heart-icon').style.animation = 'heartbeat 0.4s ease';
    });
  } else {
    // 取消按讚
    likes[postId].splice(idx, 1);
    btn.classList.remove('liked');
    btn.querySelector('.heart-icon').textContent = '🤍';
    btn.querySelector('.like-count').textContent = likes[postId].length;
  }

  saveLikes(likes);
}

/* ============================================
   留言功能
   ============================================ */

/** 展開/收合留言區 */
function toggleComments(postId) {
  const section = document.getElementById('comments-' + postId);
  if (!section) return;
  section.classList.toggle('open');
  if (section.classList.contains('open')) {
    section.querySelector('.comment-input')?.focus();
  }
}

/** 未登入時點擊留言輸入框 */
function requireLoginForComment(e) {
  if (!currentUser) {
    e.preventDefault();
    e.target.blur();
    showModal('🐾', '是否已有平台帳號？', '請先登入或註冊才能留言！', [
      { label: '取消', style: 'btn-ghost', action: '' },
      { label: '登入 / 註冊', style: 'btn-primary', action: "closeModal();goPage('auth');" }
    ]);
  }
}

/** 送出留言 */
function submitComment(postId) {
  if (!currentUser) {
    showModal('🔑', '請先登入', '登入後才能留言 🐾', [
      { label: '取消', style: 'btn-ghost', action: '' },
      { label: '去登入', style: 'btn-primary', action: "closeModal();goPage('auth');" }
    ]);
    return;
  }

  const input = document.getElementById('commentInput-' + postId);
  const text  = input.value.trim();
  if (!text) return;

  const comments = getComments();
  if (!comments[postId]) comments[postId] = [];

  const newComment = {
    id:       'c_' + Date.now(),
    authorId: currentUser.id,
    text,
    createdAt: Date.now()
  };
  comments[postId].push(newComment);
  saveComments(comments);

  // 清空輸入框
  input.value = '';
  input.style.height = 'auto';

  // 更新留言計數（所有同貼文按鈕）
  document.querySelectorAll(`[onclick="toggleComments('${postId}')"] span`).forEach(el => {
    el.textContent = comments[postId].length;
  });

  // 動態加入新留言到列表
  const list = document.querySelector(`#comments-${postId} .comment-list`);
  if (list) {
    const div = document.createElement('div');
    const cu  = currentUser;
    const cavHtml = cu.avatar
      ? `<img src="${cu.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;" />`
      : getAvatarEmoji(cu.name);
    div.className = 'comment-item';
    div.innerHTML = `
      <div class="comment-avatar">${cavHtml}</div>
      <div class="comment-bubble">
        <div class="comment-author">${escHtml(cu.name)} <span style="color:var(--text-light);font-weight:400">@${escHtml(cu.id)}</span></div>
        <div class="comment-text">${escHtml(text)}</div>
        <div class="comment-time">剛剛</div>
      </div>
    `;
    list.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  showToast('💬', '留言成功！', '', 'success');
}

/* ============================================
   個人資料編輯
   ============================================ */

function openEditProfile() {
  if (!currentUser) return;
  const preview = document.getElementById('editAvatarPreview');
  if (currentUser.avatar) {
    preview.innerHTML = `<img src="${currentUser.avatar}" alt="頭貼" />`;
  } else {
    preview.innerHTML = getAvatarEmoji(currentUser.name);
  }
  preview._data = currentUser.avatar || null;
  document.getElementById('editName').value = currentUser.name;
  document.getElementById('editProfileModal').classList.remove('hidden');
}

function closeEditProfile() {
  document.getElementById('editProfileModal').classList.add('hidden');
}

function previewEditAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const p = document.getElementById('editAvatarPreview');
    p.innerHTML = `<img src="${e.target.result}" alt="頭貼" />`;
    p._data = e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveProfile() {
  const newName   = document.getElementById('editName').value.trim();
  const newAvatar = document.getElementById('editAvatarPreview')._data;

  if (!newName) { showToast('⚠️', '名稱不能為空', '', 'warning'); return; }

  const users = getUsers();
  users[currentUser.id].name = newName;
  if (newAvatar !== undefined) users[currentUser.id].avatar = newAvatar;
  saveUsers(users);
  currentUser = users[currentUser.id];

  closeEditProfile();
  refreshHome();
  showToast('✅', '個人資料已更新！', '', 'success');
}

/* ============================================
   深色模式
   ============================================ */

function toggleDark() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('pawshare_dark', isDark ? '1' : '0');
  document.querySelectorAll('.dark-toggle').forEach(btn => {
    btn.textContent = isDark ? '☀️' : '🌙';
  });
}

function initDarkMode() {
  const saved = localStorage.getItem('pawshare_dark');
  if (saved === '1') {
    document.body.classList.add('dark-mode');
    document.querySelectorAll('.dark-toggle').forEach(btn => { btn.textContent = '☀️'; });
  }
}

/* ============================================
   搜尋功能
   ============================================ */

function handleSearch(query, pageId) {
  const resultsEl = document.getElementById('searchResults' + (pageId === 'home' ? 'Home' : 'Feed'));
  if (!resultsEl) return;

  if (!query.trim()) {
    resultsEl.classList.remove('open');
    return;
  }

  const posts   = getPosts();
  const q       = query.toLowerCase();
  const matched = posts.filter(p =>
    p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
  ).slice(0, 6);

  if (matched.length === 0) {
    resultsEl.innerHTML = `
      <div class="search-result-item">
        <span class="result-icon">🔍</span>
        <div class="result-info"><strong>沒有找到相關貼文</strong><span>試試其他關鍵字</span></div>
      </div>
    `;
  } else {
    resultsEl.innerHTML = matched.map(p => `
      <div class="search-result-item" onclick="jumpToPost('${p.id}', '${pageId}')">
        <span class="result-icon">${getTagInfo(p.tag).icon}</span>
        <div class="result-info">
          <strong>${escHtml(p.title)}</strong>
          <span>${escHtml(p.content.substring(0, 40))}...</span>
        </div>
      </div>
    `).join('');
  }

  resultsEl.classList.add('open');
}

function openSearch(pageId) {
  const inputId = pageId === 'home' ? 'searchInputHome' : 'searchInputFeed';
  const val     = document.getElementById(inputId)?.value;
  if (val) handleSearch(val, pageId);
}

function jumpToPost(postId, pageId) {
  document.querySelectorAll('.search-results').forEach(el => el.classList.remove('open'));
  if (pageId !== 'feed') goPage('feed');
  setTimeout(() => {
    const el = document.getElementById('post-' + postId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}

function scrollToPost(postId) {
  goPage('feed');
  setTimeout(() => {
    const el = document.getElementById('post-' + postId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 400);
}

/* ============================================
   UI 輔助工具
   ============================================ */

/** 顯示 Toast 通知 */
function showToast(icon, title, msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const id        = 'toast_' + Date.now();
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.id        = id;
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/** 顯示 Modal 彈窗 */
function showModal(icon, title, msg, actions = []) {
  document.getElementById('modalIcon').textContent  = icon;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMsg').textContent   = msg;

  const actionsEl = document.getElementById('modalActions');
  actionsEl.innerHTML = actions.map(a => `
    <button class="btn ${a.style}" onclick="${a.action || ''}closeModal()">
      ${a.label}
    </button>
  `).join('');

  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

/** 顯示成功動畫 */
function showSuccess(emoji, title, msg) {
  document.getElementById('successEmoji').textContent  = emoji;
  document.getElementById('successTitle').textContent  = title;
  document.getElementById('successMsg').textContent    = msg;
  document.getElementById('successOverlay').classList.add('show');
}

function hideSuccess() {
  document.getElementById('successOverlay').classList.remove('show');
}

/** 展開/收合貼文內容 */
function toggleContent(postId) {
  const content = document.getElementById('content-' + postId);
  const btn     = document.getElementById('readmore-' + postId);
  if (!content || !btn) return;

  const isCollapsed = content.classList.contains('collapsed');
  content.classList.toggle('collapsed', !isCollapsed);
  btn.textContent = isCollapsed ? '收合 ▲' : '展開 ▼';
}

/** 燈箱 */
function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

/** 渲染頭貼到元素 */
function renderAvatar(el, avatarData, name) {
  if (!el) return;
  if (avatarData) {
    el.innerHTML = `<img src="${avatarData}" alt="頭貼" />`;
  } else {
    el.innerHTML = getAvatarEmoji(name);
  }
}

/** 取得名稱首字 emoji */
function getAvatarEmoji(name) {
  const emojis = ['🐶', '🐱', '🐰', '🐦', '🐟', '🐹', '🦊', '🐼', '🐨', '🐯'];
  const idx    = (name || '').charCodeAt(0) % emojis.length;
  return emojis[idx];
}

/** 更新所有導覽欄頭貼 */
function updateNavAvatars() {
  if (!currentUser) return;
  ['navAvatarHome', 'navAvatarFeed', 'navAvatarPost'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    renderAvatar(el, currentUser.avatar, currentUser.name);
  });
}

/** 取得分類標籤資訊 */
function getTagInfo(tag) {
  const map = {
    dog:    { icon: '🐶', label: '狗狗' },
    cat:    { icon: '🐱', label: '貓咪' },
    bird:   { icon: '🐦', label: '鳥類' },
    rabbit: { icon: '🐰', label: '兔兔' },
    other:  { icon: '🦜', label: '其他' },
  };
  return map[tag] || map.other;
}

/** 時間格式化 */
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const sec  = Math.floor(diff / 1000);
  const min  = Math.floor(sec / 60);
  const hr   = Math.floor(min / 60);
  const day  = Math.floor(hr / 24);

  if (sec < 60)  return '剛剛';
  if (min < 60)  return `${min} 分鐘前`;
  if (hr < 24)   return `${hr} 小時前`;
  if (day < 7)   return `${day} 天前`;
  return new Date(ts).toLocaleDateString('zh-TW');
}

/** HTML 跳脫（防 XSS） */
function escHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 自動調整 textarea 高度 */
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/* ============================================
   點擊空白處關閉搜尋結果
   ============================================ */

document.addEventListener('click', e => {
  if (!e.target.closest('.navbar-search')) {
    document.querySelectorAll('.search-results').forEach(el => el.classList.remove('open'));
  }
  if (!e.target.closest('.modal') && !e.target.closest('.modal-overlay')) {
    // 點overlay關閉modal
  }
});

// 點 modal overlay 關閉
document.getElementById('modalOverlay')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// 燈箱點擊背景關閉
document.getElementById('lightbox')?.addEventListener('click', function(e) {
  if (e.target === this) closeLightbox();
});

// ESC 關閉 modal/燈箱/編輯視窗
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeLightbox();
    closeEditProfile();
  }
});

/* ============================================
   示範資料（首次啟動）
   ============================================ */

function seedDemoData() {
  const users = getUsers();
  if (Object.keys(users).length > 0) return; // 已有資料則跳過

  // 建立示範帳號
  const demoUsers = {
    'pawlover': {
      id: 'pawlover',
      name: '毛孩愛好者',
      password: 'demo123',
      avatar: null,
      createdAt: Date.now() - 86400000 * 7
    },
    'catmom': {
      id: 'catmom',
      name: '貓咪媽媽',
      password: 'demo123',
      avatar: null,
      createdAt: Date.now() - 86400000 * 5
    },
    'dogdad': {
      id: 'dogdad',
      name: '狗狗爸爸',
      password: 'demo123',
      avatar: null,
      createdAt: Date.now() - 86400000 * 3
    }
  };
  saveUsers(demoUsers);

  // 建立示範貼文
  const demoPosts = [
    {
      id: 'post_demo_1',
      authorId: 'catmom',
      title: '我家橘貓今天的日常 🧡',
      content: '今天橘寶又在陽台上曬太陽，他真的超享受陽光的！每次看到他那副慵懶的模樣就覺得生活好美好。他最近學會了一個新動作，就是當我拿出零食袋時會自動坐好然後舉起前爪，真的太可愛了！大家的貓咪有什麼有趣的習慣嗎？',
      tag: 'cat',
      images: [],
      createdAt: Date.now() - 3600000 * 2
    },
    {
      id: 'post_demo_2',
      authorId: 'dogdad',
      title: '帶柴犬去公園玩的超開心！🐶',
      content: '今天難得天氣好，帶小花去附近的大公園玩。她跑了好久，把所有的狗朋友都玩了一遍，最後累到在草地上直接躺下來睡著了 XD 這種時候真的覺得養狗的幸福感破表！你們都有帶毛孩去哪些好玩的地方嗎？',
      tag: 'dog',
      images: [],
      createdAt: Date.now() - 3600000 * 5
    },
    {
      id: 'post_demo_3',
      authorId: 'pawlover',
      title: '兔兔愛吃牧草的日常 🐰',
      content: '雪球今天又把整盆牧草吃光了！才補充不到一小時就掃光光。看著他小嘴巴嚼啊嚼的，真的超療癒。最近在研究各種牧草的營養差異，提摩西草和果園草好像適合不同年齡的兔子，大家都餵什麼牧草呢？',
      tag: 'rabbit',
      images: [],
      createdAt: Date.now() - 3600000 * 10
    },
    {
      id: 'post_demo_4',
      authorId: 'catmom',
      title: '分享貓咪超可愛的睡姿 😻',
      content: '橘寶今天睡成一顆麵包！四隻腳縮在肚子底下，頭微微低著，整個就是一個超完美麵包型，我在旁邊偷笑了好久。貓咪真的是天生的療癒系動物，不管睡什麼姿勢都超可愛的！',
      tag: 'cat',
      images: [],
      createdAt: Date.now() - 86400000
    }
  ];
  savePosts(demoPosts);

  // 建立示範按讚
  const demoLikes = {
    'post_demo_1': ['dogdad', 'pawlover'],
    'post_demo_2': ['catmom'],
    'post_demo_3': ['catmom', 'dogdad'],
    'post_demo_4': ['dogdad', 'pawlover']
  };
  saveLikes(demoLikes);

  // 建立示範留言
  const demoComments = {
    'post_demo_1': [
      { id: 'c_d1', authorId: 'dogdad', text: '哈哈我們家狗狗也會這樣！寵物真的太有靈性了～', createdAt: Date.now() - 3600000 },
      { id: 'c_d2', authorId: 'pawlover', text: '橘貓是最可愛的！快分享照片～', createdAt: Date.now() - 1800000 }
    ],
    'post_demo_2': [
      { id: 'c_d3', authorId: 'catmom', text: '哇看起來好好玩！我也想帶我的橘貓去公園（雖然他可能不喜歡 XD）', createdAt: Date.now() - 3600000 }
    ]
  };
  saveComments(demoComments);
}

/* ============================================
   初始化
   ============================================ */

function init() {
  // 注入示範資料
  seedDemoData();

  // 初始化深色模式
  initDarkMode();

  // 讀取登入狀態
  currentUser = loadCurrentUser();

  if (currentUser) {
    // 已登入，導向首頁
    goPage('home');
  } else {
    // 未登入，顯示認證頁面
    goPage('auth');
  }
}

// 頁面載入後執行初始化
document.addEventListener('DOMContentLoaded', init);
