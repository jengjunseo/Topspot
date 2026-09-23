(function () {
  'use strict';

  const data = window.ARCHIVE_DATA;
  const app = document.getElementById('app');
  const state = {
    route: location.hash ? location.hash.slice(1) : 'home',
    currentTrack: null,
    expandedPlayer: false,
    previewMessage: '',
    previews: null,
    previewPromise: null,
    searchText: '',
    lifeYear: 'all',
    indexType: 'all',
    toastTimer: null
  };
  let audio = new Audio();
  audio.preload = 'none';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function safeUrl(value) {
    return /^https:\/\/[a-z0-9.-]+(?::[0-9]+)?(?:\/|$)/i.test(value) ? value : '#';
  }

  function externalLink(url, label, className) {
    return '<a class="' + (className || 'text-link') + '" href="' + escapeHtml(safeUrl(url)) + '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(label) + '<span aria-hidden="true"> ↗</span></a>';
  }

  function trackTitle(track, includeEnglish) {
    if (includeEnglish === false) return track.korean || track.english;
    return track.korean ? track.korean + ' (' + track.english + ')' : track.english;
  }

  function getTrack(number) {
    return data.tracks.find(function (track) { return track.number === Number(number); }) || data.tracks[0];
  }

  function roomFor(number) {
    return data.rooms.find(function (room) {
      const limits = room.id === 'many-views' ? [1, 4] : room.id === 'another-dimension' ? [5, 8] : [9, 11];
      return number >= limits[0] && number <= limits[1];
    }) || data.rooms[0];
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(function () { toast.classList.remove('is-visible'); }, 3000);
  }

  function go(route, options) {
    const opts = options || {};
    state.route = route;
    if (route.indexOf('track/') === 0) {
      const number = Number(route.split('/')[1]);
      if (number && (!state.currentTrack || state.currentTrack.number !== number)) {
        audio.pause();
        state.currentTrack = getTrack(number);
        state.previewMessage = '';
      }
    }
    if (location.hash.slice(1) !== route) location.hash = route;
    renderRoute(true, opts.focus !== false);
  }

  function closeIntro(route) {
    try { localStorage.setItem('topspot-intro-seen', '1'); } catch (ignore) {}
    const layer = document.getElementById('intro');
    if (layer) layer.classList.remove('is-visible');
    go(route || 'home');
  }

  function renderShell() {
    app.innerHTML = [
      '<a class="skip-link" href="#route-view">본문으로 건너뛰기</a>',
      '<header class="site-header">',
      '  <a class="wordmark" href="#home" aria-label="T.O.P. 아카이브 첫 화면"><span>T.O.P.</span><i>ARCHIVE</i></a>',
      '  <nav class="primary-nav" aria-label="주요 메뉴">',
      '    <a data-nav="records" href="#records">RECORDS</a>',
      '    <a data-nav="life" href="#life">THE LIFE</a>',
      '    <a data-nav="index" href="#index">INDEX</a>',
      '  </nav>',
      '  <button class="header-search" data-nav="search" aria-label="검색 열기"><span>SEARCH</span><kbd>/</kbd></button>',
      '</header>',
      '<main id="route-view" tabindex="-1"></main>',
      '<aside id="player-dock" class="player-dock" aria-label="미니 플레이어"></aside>',
      '<div class="toast" id="toast" role="status" aria-live="polite"></div>',
      '<div class="intro-layer" id="intro" aria-labelledby="intro-title">',
      '  <div class="intro-content">',
      '    <p class="eyebrow"><span class="live-dot"></span> INDEPENDENT CULTURE ARCHIVE · 01</p>',
      '    <p class="intro-overline">A LIFE IN 11 TRACKS</p>',
      '    <h1 id="intro-title">T.O.P.<br><em>ANOTHER DIMENSION</em></h1>',
      '    <div class="intro-rule"></div>',
      '    <p class="intro-copy">긴 공백 뒤에 나온 첫 정규 앨범.<br>11곡과 그 앞의 시간을 함께 기록합니다.</p>',
      '    <div class="intro-actions">',
      '      <button class="button button-light" data-enter="home">아카이브 들어가기 <span aria-hidden="true">↗</span></button>',
      '      <button class="quiet-button" data-enter="records">바로 앨범 보기 <span aria-hidden="true">→</span></button>',
      '    </div>',
      '    <p class="intro-footnote">비공식 팬 아카이브 · 음악은 재생 버튼을 눌러야 시작됩니다.</p>',
      '  </div>',
      '  <div class="intro-mark" aria-hidden="true"><span>TOP SPOT</span><i>2026</i></div>',
      '</div>'
    ].join('');
  }

  function currentTrackMarkup() {
    const track = state.currentTrack;
    if (!track) {
      return [
        '<div class="dock-idle"><span class="dock-line"></span><div>',
        '<small>MINI PLAYER</small><strong>곡을 고르면 여기에 표시됩니다</strong></div></div>',
        '<div class="dock-hint">선택한 곡은 자동 재생되지 않습니다.</div>'
      ].join('');
    }
    const playText = audio.paused ? '재생' : '일시정지';
    const playIcon = audio.paused ? '▶' : 'Ⅱ';
    return [
      '<div class="dock-track">',
      '  <button class="dock-cover" data-nav="track/' + track.number + '" aria-label="' + escapeHtml(trackTitle(track)) + ' 곡 화면 열기"><span>' + String(track.number).padStart(2, '0') + '</span></button>',
      '  <div class="dock-meta"><small>TRACK ' + String(track.number).padStart(2, '0') + ' · ' + escapeHtml(roomFor(track.number).title) + '</small><strong>' + escapeHtml(trackTitle(track)) + '</strong></div>',
      '  <div class="dock-controls">',
      '    <button class="icon-button" data-action="previous" aria-label="이전 곡" title="이전 곡">‹</button>',
      '    <button class="play-button" data-action="play" aria-label="' + playText + '" title="' + playText + '">' + playIcon + '</button>',
      '    <button class="icon-button" data-action="next" aria-label="다음 곡" title="다음 곡">›</button>',
      '  </div>',
      '  <div class="dock-progress"><span id="dock-progress-fill"></span></div>',
      '  <div class="dock-time"><span id="dock-time-current">00:00</span><span id="dock-time-total">00:30</span></div>',
      '  <button class="icon-button dock-expand" data-action="expand-player" aria-label="' + (state.expandedPlayer ? '플레이어 접기' : '플레이어 펼치기') + '" title="플레이어 펼치기">' + (state.expandedPlayer ? '⌄' : '⌃') + '</button>',
      '</div>',
      '<div class="dock-message" id="dock-message" aria-live="polite">' + escapeHtml(state.previewMessage) + '</div>',
      state.expandedPlayer ? '<div class="dock-expanded"><span>ARCHIVE NOTES</span><p>' + escapeHtml(track.interpretation) + '</p>' + externalLink(data.album.apple, 'Apple Music') + externalLink(data.album.spotify, 'Spotify') + '</div>' : ''
    ].join('');
  }

  function renderPlayer() {
    const player = document.getElementById('player-dock');
    if (!player) return;
    player.innerHTML = currentTrackMarkup();
    updateProgress();
  }

  function updateProgress() {
    const track = state.currentTrack;
    if (!track) return;
    const total = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30;
    const progress = Math.min(1, audio.currentTime / total);
    const fill = document.getElementById('dock-progress-fill');
    const time = document.getElementById('dock-time-current');
    if (fill) fill.style.width = (progress * 100) + '%';
    if (time) time.textContent = clockString(audio.currentTime);
    const bar = document.getElementById('track-progress-fill');
    if (bar) bar.style.width = (progress * 100) + '%';
    const trackTime = document.getElementById('track-time-current');
    if (trackTime) trackTime.textContent = clockString(audio.currentTime);
    const message = document.getElementById('dock-message');
    if (message && state.previewMessage) message.textContent = state.previewMessage;
  }

  function clockString(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
  }

  function roomLabel(number) {
    const room = roomFor(number);
    return '<span class="room-tag">ROOM ' + room.number + ' · ' + escapeHtml(room.title) + '</span>';
  }

  function trackRow(track, options) {
    const opts = options || {};
    return [
      '<div class="track-row ' + (opts.compact ? 'track-row-compact' : '') + '" data-track-row="' + track.number + '">',
      '  <button class="track-select" data-nav="track/' + track.number + '" aria-label="트랙 ' + String(track.number).padStart(2, '0') + ' ' + escapeHtml(trackTitle(track)) + ' 상세 보기">',
      '    <span class="track-no">' + String(track.number).padStart(2, '0') + '</span>',
      '    <span class="track-name"><strong>' + escapeHtml(trackTitle(track)) + '</strong><small>' + (opts.compact ? escapeHtml(roomFor(track.number).title) : 'T.O.P. · ANOTHER DIMENSION') + '</small></span>',
      '    <span class="track-duration">' + escapeHtml(track.duration) + '</span>',
      '  </button>',
      '  <button class="row-play" data-play="' + track.number + '" aria-label="' + escapeHtml(trackTitle(track)) + ' 30초 미리듣기 시작" title="30초 미리듣기">▶</button>',
      '</div>'
    ].join('');
  }

  function sourceList(sources) {
    return '<ul class="source-list">' + sources.map(function (source) {
      return '<li>' + externalLink(source.url, source.label) + '</li>';
    }).join('') + '</ul>';
  }

  function eventCard(event, selected) {
    return [
      '<button class="event-card ' + (selected ? 'is-selected' : '') + '" data-event="' + escapeHtml(event.id) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">',
      '  <span class="event-date">' + escapeHtml(event.date) + '<i></i></span>',
      '  <span class="event-label">' + escapeHtml(event.label) + '</span>',
      '  <strong>' + escapeHtml(event.title) + '</strong>',
      '  <span class="event-summary">' + escapeHtml(event.summary) + '</span>',
      '  <span class="event-arrow" aria-hidden="true">↗</span>',
      '</button>'
    ].join('');
  }

  function homeView() {
    const featured = getTrack(1);
    return [
      '<section class="home-hero">',
      '  <div class="hero-copy">',
      '    <p class="eyebrow"><span class="live-dot"></span> A CURATED ARCHIVE · LAST VERIFIED 2026.09.23</p>',
      '    <h1>한 사람의 시간,<br><em>열한 곡의 다른 시선.</em></h1>',
      '    <p class="hero-intro">《ANOTHER DIMENSION》의 11곡과 그 앞의 시간을 함께 걷습니다. 확인 가능한 기록과 이 아카이브의 해석을 나눠 읽습니다.</p>',
      '    <div class="hero-actions">',
      '      <button class="button button-light" data-nav="records">앨범 듣기 <span aria-hidden="true">↗</span></button>',
      '      <button class="button button-outline" data-nav="life">이야기부터 보기 <span aria-hidden="true">→</span></button>',
      '    </div>',
      '    <div class="hero-facts"><span>11 TRACKS</span><i></i><span>3 ROOMS</span><i></i><span>15 RECORDS</span></div>',
      '  </div>',
      '  <div class="hero-artwork" aria-label="공식 앨범 아트워크가 아닌 편집용 타이포그래픽">',
      '    <div class="artwork-top"><span>TOP SPOT</span><span>NO. 01 / 2026</span></div>',
      '    <div class="artwork-grid" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>',
      '    <div class="artwork-title"><span>T.O.P.</span><strong>ANOTHER<br>DIMENSION</strong></div>',
      '    <div class="artwork-bottom"><span>다중관점</span><span>ARCHIVE EDITION</span></div>',
      '    <span class="artwork-disclaimer">TYPOGRAPHIC STUDY<br>NOT OFFICIAL ARTWORK</span>',
      '  </div>',
      '</section>',
      '<section class="home-release wrap">',
      '  <div><span class="section-index">01 / THE MAIN RECORD</span><h2>먼저, 앨범을 듣습니다.</h2><p>2026년 4월 3일 공개된 첫 정규 앨범. 세 개의 전시실, 열한 곡.</p></div>',
      '  <div class="release-meta"><strong>' + escapeHtml(data.album.releaseDate) + '</strong><span>11곡 · ' + escapeHtml(data.album.duration) + '</span>' + externalLink(data.album.official, '공식 앨범 링크') + '</div>',
      '</section>',
      '<section class="home-panels wrap">',
      '  <article class="feature-panel feature-life"><div class="panel-number">02</div><p class="eyebrow">THE LIFE / 15 EDITED RECORDS</p><h2>뉴스가 된 시간,<br>다시 음악으로.</h2><p>활동과 작품, 사건과 발언을 확인 가능한 출처와 함께 정리했습니다. 해석은 사실과 따로 읽을 수 있습니다.</p><button class="text-button" data-nav="life">연표 열기 <span aria-hidden="true">↗</span></button></article>',
      '  <article class="feature-panel feature-track"><div class="panel-number">03</div><p class="eyebrow">START WITH TRACK 01</p><h2>' + escapeHtml(trackTitle(featured)) + '</h2><p>' + escapeHtml(featured.interpretation) + '</p><button class="text-button" data-nav="track/1">곡 노트 보기 <span aria-hidden="true">↗</span></button></article>',
      '</section>',
      '<section class="home-list wrap"><div class="section-heading"><div><span class="section-index">04 / TRACK LIST</span><h2>열한 곡, 한 장의 앨범</h2></div><button class="text-button" data-nav="records">전체 트랙 <span aria-hidden="true">↗</span></button></div>',
      '<div class="home-track-grid">' + data.tracks.slice(0, 4).map(function (track) { return trackRow(track, { compact: true }); }).join('') + '</div>',
      '</section>',
      '<section class="home-note wrap"><span>EDITORIAL NOTE</span><p>이 사이트는 T.O.P.의 공식 홈페이지가 아닙니다. 개인이 편집한 비공식 아카이브이며, 사진·가사·음원 파일은 권한 확인 없이 저장하거나 재배포하지 않습니다.</p>' + externalLink(data.album.interview, 'GQ Hong Kong 인터뷰 보기') + '</section>',
      '<footer class="site-footer wrap"><a class="wordmark" href="#home"><span>T.O.P.</span><i>ARCHIVE</i></a><span>AN UNOFFICIAL, SOURCE-LED ARCHIVE</span><button class="text-button" data-nav="index">INDEX ↗</button></footer>'
    ].join('');
  }

  function roomCard(room) {
    const range = room.id === 'many-views' ? [1, 4] : room.id === 'another-dimension' ? [5, 8] : [9, 11];
    const tracks = data.tracks.filter(function (track) { return track.number >= range[0] && track.number <= range[1]; });
    return [
      '<article class="room-card room-' + room.number + '">',
      '  <div class="room-heading"><span>' + room.number + '</span><div><p>' + escapeHtml(room.range) + '</p><h3>' + escapeHtml(room.title) + '</h3></div><span class="room-count">' + tracks.length + ' TRACKS</span></div>',
      '  <p class="room-description">' + escapeHtml(room.description) + '</p>',
      '  <div class="room-track-list">' + tracks.map(function (track) { return trackRow(track, { compact: true }); }).join('') + '</div>',
      '</article>'
    ].join('');
  }

  function recordsView() {
    return [
      '<section class="page-intro wrap"><div><p class="eyebrow">RECORDS / 01</p><h1>세 개의 방,<br><em>한 장의 앨범.</em></h1></div><p class="page-lede">《ANOTHER DIMENSION》을 하나의 흐름으로 듣되, 어느 곡부터 들어도 맥락을 따라올 수 있도록 정리했습니다.</p></section>',
      '<section class="records-lead wrap">',
      '  <div class="records-cover"><div class="cover-lines" aria-hidden="true"></div><span class="cover-label">T.O.P. / FIRST STUDIO ALBUM</span><strong>ANOTHER<br>DIMENSION</strong><span class="cover-korean">다중관점</span><small>편집용 그래픽 · 공식 앨범 이미지 아님</small></div>',
      '  <div class="records-info"><p class="eyebrow">THE MAIN RECORD · 2026</p><h2>TOP SPOT —<br>ANOTHER DIMENSION</h2><p>2013년 《DOOM DADA》 뒤에 도착한 첫 정규 앨범입니다. 지난 시간을 단정하는 대신, 열한 곡의 장면을 차례로 놓아 봅니다.</p><dl><div><dt>발매</dt><dd>2026년 4월 3일</dd></div><div><dt>구성</dt><dd>11곡 · 약 37분</dd></div><div><dt>아티스트</dt><dd>T.O.P.</dd></div></dl>',
      '    <div class="platform-links">' + externalLink(data.album.apple, 'Apple Music') + externalLink(data.album.spotify, 'Spotify') + externalLink(data.album.official, '공식 앨범 페이지') + '</div>',
      '    <p class="rights-note">앨범 이미지는 외부에서 저장하지 않았습니다. 이 페이지의 타이포그래픽은 편집용 그래픽입니다.</p>',
      '  </div>',
      '</section>',
      '<section class="rooms-section wrap"><div class="section-heading"><div><span class="section-index">THREE ROOMS</span><h2>앨범의 세 구분</h2></div><p>버전 구분을 빌린 편집 구조입니다.<br>곡 해석의 정답을 뜻하지 않습니다.</p></div>',
      data.rooms.map(roomCard).join(''),
      '</section>',
      '<section class="before-album wrap"><div><span class="section-index">BEFORE THE ALBUM</span><h2>앞에 놓인 두 기록</h2><p>메인 앨범에 이르는 프롤로그. 별도의 디스코그래피로 넓히지 않습니다.</p></div><div class="before-links"><article><small>2010 · SOLO SINGLE</small><h3>Turn It Up</h3><p>팀 활동과 나란히 발표된 초기 솔로 작업.</p>' + externalLink('https://music.apple.com/us/artist/t-o-p/656496303', 'Apple Music에서 보기') + '</article><article><small>2013 · SOLO SINGLE</small><h3>DOOM DADA</h3><p>첫 정규 앨범 전 마지막 솔로 싱글.</p>' + externalLink('https://www.ygfamily.com/en/news/notice/1894', 'YG 발매 공지') + '</article></div></section>',
      '<section class="credits wrap"><div><span class="section-index">ALBUM CREDITS</span><h2>공식 크레딧</h2><p>작사·작곡·프로듀싱 등 세부 크레딧은 공식 음원 서비스의 곡 정보에서 확인하세요. 검증하지 못한 이름과 역할은 임의로 채우지 않았습니다.</p></div><div class="platform-links">' + externalLink(data.album.apple, 'Apple Music 곡 정보') + externalLink(data.album.spotify, 'Spotify 앨범 정보') + '</div></section>',
      '<footer class="site-footer wrap"><a class="wordmark" href="#home"><span>T.O.P.</span><i>ARCHIVE</i></a><span>RECORDS / 11 TRACKS</span><button class="text-button" data-nav="index">INDEX ↗</button></footer>'
    ].join('');
  }

  function eventsForYear(year) {
    if (year === 'all') return data.events;
    return data.events.filter(function (event) { return event.year.indexOf(year) !== -1; });
  }

  function lifeView(selectedId) {
    const years = ['all', '2006', '2010', '2012', '2013', '2017', '2022', '2023', '2024', '2026'];
    const events = eventsForYear(state.lifeYear);
    let selected = data.events.find(function (event) { return event.id === selectedId; });
    if (!selected || events.indexOf(selected) === -1) selected = events[events.length - 1] || data.events[data.events.length - 1];
    return [
      '<section class="page-intro wrap"><div><p class="eyebrow">THE LIFE / 02</p><h1>한 사람의 시간,<br><em>편집된 기록.</em></h1></div><p class="page-lede">15개의 기록을 시간순으로 읽습니다. 날짜와 출처를 먼저 확인하고, 이 아카이브의 해석은 별도로 살펴보세요.</p></section>',
      '<section class="life-layout wrap">',
      '  <div class="life-list-column"><div class="life-list-tools"><label for="life-year">연도</label><select id="life-year">' + years.map(function (year) { return '<option value="' + year + '"' + (state.lifeYear === year ? ' selected' : '') + '>' + (year === 'all' ? '전체 보기' : year) + '</option>'; }).join('') + '</select><span>' + events.length + ' RECORDS</span></div>',
      '    <div class="event-list">' + events.map(function (event) { return eventCard(event, selected && selected.id === event.id); }).join('') + '</div>',
      '  </div>',
      '  <article class="life-detail" aria-live="polite">',
      '    <div class="detail-stamp"><span>' + escapeHtml(selected.date) + '</span><span>' + escapeHtml(selected.label) + '</span></div>',
      '    <h2>' + escapeHtml(selected.title) + '</h2>',
      '    <div class="fact-block"><span>기록</span><p>' + escapeHtml(selected.fact) + '</p></div>',
      '    <div class="reading-block"><span>이 아카이브의 읽기</span><p>' + escapeHtml(selected.reading) + '</p></div>',
      '    <div class="related-block"><span>연결된 곡</span><div class="related-track-list">' + selected.tracks.map(function (number) { const track = getTrack(number); return '<button data-nav="track/' + number + '">' + String(number).padStart(2, '0') + ' / ' + escapeHtml(trackTitle(track)) + ' <span aria-hidden="true">↗</span></button>'; }).join('') + '</div></div>',
      '    <div class="sources-block"><span>출처</span>' + sourceList(selected.sources) + '</div>',
      '    <p class="checked-date">선별 기록 · 마지막 사실 확인 2026.09.23</p>',
      '  </article>',
      '</section>',
      '<section class="editorial-policy wrap"><p class="eyebrow">HOW TO READ</p><p>사실, 당사자 발언, 보도, 아카이브의 해석을 분리합니다. 확인되지 않은 동기와 심리 상태는 적지 않습니다.</p><button class="text-button" data-nav="index">관련 자료 찾아보기 ↗</button></section>',
      '<footer class="site-footer wrap"><a class="wordmark" href="#home"><span>T.O.P.</span><i>ARCHIVE</i></a><span>THE LIFE / 15 RECORDS</span><button class="text-button" data-nav="records">RECORDS ↗</button></footer>'
    ].join('');
  }

  function trackDetailView(number) {
    const track = getTrack(number);
    const room = roomFor(track.number);
    const linkedEvents = data.events.filter(function (event) { return event.tracks.indexOf(track.number) !== -1; }).slice(0, 3);
    const previous = getTrack(track.number === 1 ? 11 : track.number - 1);
    const next = getTrack(track.number === 11 ? 1 : track.number + 1);
    const savedLyrics = loadLyrics(track.number);
    const korean = track.korean ? '<span>' + escapeHtml(track.korean) + '</span>' : '';
    return [
      '<section class="track-detail-page room-color-' + room.number + '">',
      '  <div class="track-detail-head wrap"><button class="back-link" data-nav="records">← 앨범으로</button><span>' + roomLabel(track.number) + '</span><span class="track-sequence">TRACK ' + String(track.number).padStart(2, '0') + ' / 11</span></div>',
      '  <div class="track-detail-main wrap">',
      '    <div class="track-art" aria-label="공식 이미지가 아닌 타이포그래픽"><div class="track-art-lines" aria-hidden="true"></div><span>ROOM ' + room.number + '</span><strong>' + String(track.number).padStart(2, '0') + '</strong><small>ARCHIVE STUDY</small></div>',
      '    <div class="track-copy">',
      '      <p class="eyebrow">TOP SPOT — ANOTHER DIMENSION</p>',
      '      <h1>' + korean + '<em>' + escapeHtml(track.english) + '</em></h1>',
      '      <p class="track-room-title">ROOM ' + room.number + ' / ' + escapeHtml(room.title) + '<span>·</span>' + escapeHtml(track.duration) + '</p>',
      '      <p class="track-room-description">' + escapeHtml(room.description) + '</p>',
      '      <div class="track-player"><button class="button button-light" data-play="' + track.number + '" aria-label="' + escapeHtml(trackTitle(track)) + ' 미리듣기 시작"><span>▶</span> 30초 미리듣기</button><span class="preview-label">APPLE MUSIC PREVIEW · 30 SEC</span><div class="track-progress"><span id="track-progress-fill"></span></div><div class="track-time"><span id="track-time-current">00:00</span><span>00:30</span></div></div>',
      '      <div class="track-main-links">' + externalLink(data.album.apple, 'Apple Music에서 전체 곡 듣기') + externalLink(data.album.spotify, 'Spotify 앨범 열기') + '</div>',
      '    </div>',
      '  </div>',
      '</section>',
      '<section class="track-notes wrap"><div class="track-notes-heading"><span class="section-index">ARCHIVE NOTES</span><p>아래 내용은 이 아카이브의 감상입니다. 공식 해설이나 당사자의 의도를 대신하지 않습니다.</p></div>',
      '  <article class="note-section"><span>01 / 이 곡을 이렇게 듣는다</span><p>' + escapeHtml(track.interpretation) + '</p></article>',
      '  <article class="note-section"><span>02 / 귀 기울일 부분</span><p>' + escapeHtml(track.listening) + '</p></article>',
      '  <article class="note-section"><span>03 / 앨범 속 위치</span><p>' + escapeHtml(track.position) + '</p></article>',
      '  <article class="lyrics-note"><div><span class="section-index">MY LYRICS / PRIVATE ON THIS DEVICE</span><h2>내 기기에서 보는 가사 메모</h2><p>공개 사용 권한이 확인된 가사 전문은 없습니다. 직접 입력한 텍스트는 이 브라우저 안에만 저장됩니다.</p></div><details><summary>' + (savedLyrics ? '저장한 메모 열기' : '내 메모 입력하기') + '</summary><label class="sr-only" for="lyrics-input">개인 가사 메모</label><textarea id="lyrics-input" rows="8" placeholder="직접 입력한 메모는 이 기기에만 저장됩니다."></textarea><div><button class="button button-outline" data-action="save-lyrics" data-lyrics-track="' + track.number + '">이 기기에 저장</button><button class="quiet-button" data-action="delete-lyrics" data-lyrics-track="' + track.number + '">삭제</button></div></details></article>',
      '  <article class="related-block track-related"><span>관련 기록</span><div class="related-event-list">' + (linkedEvents.length ? linkedEvents.map(function (event) { return '<button data-nav="life/' + event.id + '"><small>' + escapeHtml(event.date) + '</small><strong>' + escapeHtml(event.title) + '</strong><span aria-hidden="true">↗</span></button>'; }).join('') : '<p>이 곡에 연결된 연표 기록은 없습니다.</p>') + '</div></article>',
      '  <nav class="track-pagination" aria-label="트랙 이동"><button data-nav="track/' + previous.number + '"><small>PREVIOUS · ' + String(previous.number).padStart(2, '0') + '</small><strong>' + escapeHtml(trackTitle(previous)) + '</strong></button><button data-nav="track/' + next.number + '"><small>NEXT · ' + String(next.number).padStart(2, '0') + '</small><strong>' + escapeHtml(trackTitle(next)) + '</strong></button></nav>',
      '</section>',
      '<footer class="site-footer wrap"><a class="wordmark" href="#home"><span>T.O.P.</span><i>ARCHIVE</i></a><span>TRACK ' + String(track.number).padStart(2, '0') + ' / 11</span><button class="text-button" data-nav="records">RECORDS ↗</button></footer>'
    ].join('');
  }

  function loadLyrics(number) {
    try { return localStorage.getItem('topspot-lyrics-' + number) || ''; } catch (ignore) { return ''; }
  }

  function searchableText(item) {
    if (item.number) return [trackTitle(item), roomFor(item.number).title, item.interpretation, item.listening, item.position].join(' ');
    return [item.title, item.date, item.type, item.label, item.summary, item.fact, item.reading].join(' ');
  }

  function searchItems(query, type) {
    const needle = query.trim().toLocaleLowerCase('ko');
    const tracks = type === 'life' ? [] : data.tracks.filter(function (track) { return !needle || searchableText(track).toLocaleLowerCase('ko').indexOf(needle) !== -1; }).map(function (track) { return { kind: 'track', item: track }; });
    const events = type === 'tracks' ? [] : data.events.filter(function (event) { return !needle || searchableText(event).toLocaleLowerCase('ko').indexOf(needle) !== -1; }).map(function (event) { return { kind: 'life', item: event }; });
    return tracks.concat(events);
  }

  function searchResultRow(result) {
    const item = result.item;
    if (result.kind === 'track') {
      return '<button class="search-result" data-nav="track/' + item.number + '"><span class="result-kind">TRACK ' + String(item.number).padStart(2, '0') + '</span><strong>' + escapeHtml(trackTitle(item)) + '</strong><small>' + escapeHtml(roomFor(item.number).title) + ' · ' + escapeHtml(item.duration) + '</small><i aria-hidden="true">↗</i></button>';
    }
    return '<button class="search-result" data-nav="life/' + escapeHtml(item.id) + '"><span class="result-kind">' + escapeHtml(item.date) + ' · ' + escapeHtml(item.type) + '</span><strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.summary) + '</small><i aria-hidden="true">↗</i></button>';
  }

  function searchView() {
    const results = searchItems(state.searchText, 'all');
    return [
      '<section class="search-page wrap"><div class="search-title"><p class="eyebrow">SEARCH / 04</p><h1>찾고 싶은 장면을<br><em>입력하세요.</em></h1><p>곡명, 연도, 작품, 사건, 키워드를 검색합니다. 검색은 이 기기에서만 처리됩니다.</p></div>',
      '<label class="search-input-wrap"><span aria-hidden="true">⌕</span><input id="archive-search" type="search" value="' + escapeHtml(state.searchText) + '" placeholder="예: 서울, 2017, Studio54" autocomplete="off" aria-label="아카이브 검색"><kbd>ESC</kbd></label>',
      '<div class="search-meta"><span id="search-count">' + results.length + ' RESULTS</span><span>TRACKS + THE LIFE</span></div>',
      '<div class="search-results" id="search-results">' + (results.length ? results.map(searchResultRow).join('') : '<div class="empty-state"><strong>찾은 결과가 없습니다.</strong><p>검색어를 짧게 바꾸거나 전체 목록을 열어보세요.</p><button class="text-button" data-nav="index">INDEX 전체 보기 ↗</button><button class="text-button" data-action="clear-search">검색어 지우기</button></div>') + '</div>',
      '</section>',
      '<footer class="site-footer wrap"><a class="wordmark" href="#home"><span>T.O.P.</span><i>ARCHIVE</i></a><span>LOCAL SEARCH / NO ACCOUNT</span><button class="text-button" data-nav="index">INDEX ↗</button></footer>'
    ].join('');
  }

  function renderSearchResults() {
    const resultsEl = document.getElementById('search-results');
    const countEl = document.getElementById('search-count');
    if (!resultsEl) return;
    const results = searchItems(state.searchText, 'all');
    if (countEl) countEl.textContent = results.length + ' RESULTS';
    resultsEl.innerHTML = results.length ? results.map(searchResultRow).join('') :
      '<div class="empty-state"><strong>찾은 결과가 없습니다.</strong><p>검색어를 짧게 바꾸거나 전체 목록을 열어보세요.</p><button class="text-button" data-nav="index">INDEX 전체 보기 ↗</button><button class="text-button" data-action="clear-search">검색어 지우기</button></div>';
  }

  function indexView() {
    const results = searchItems(state.searchText, state.indexType);
    return [
      '<section class="page-intro wrap"><div><p class="eyebrow">INDEX / 03</p><h1>아카이브를<br><em>찾아보기.</em></h1></div><p class="page-lede">11곡과 15개 기록을 한곳에서 검색하고, 자료 유형별로 좁혀 볼 수 있습니다.</p></section>',
      '<section class="index-search wrap"><label class="search-input-wrap"><span aria-hidden="true">⌕</span><input id="archive-search" type="search" value="' + escapeHtml(state.searchText) + '" placeholder="곡명, 연도, 키워드" autocomplete="off" aria-label="색인 검색"><kbd>/</kbd></label>',
      '<div class="filter-row"><div class="filter-tabs" role="group" aria-label="자료 유형">' + [['all','전체'],['tracks','곡'],['life','연표']].map(function (filter) { return '<button data-filter="' + filter[0] + '" class="' + (state.indexType === filter[0] ? 'is-active' : '') + '" aria-pressed="' + (state.indexType === filter[0] ? 'true' : 'false') + '">' + filter[1] + '</button>'; }).join('') + '</div><span id="search-count">' + results.length + ' RESULTS</span></div>',
      '<div class="index-results search-results" id="search-results">' + (results.length ? results.map(searchResultRow).join('') : '<div class="empty-state"><strong>검색 결과가 없습니다.</strong><p>검색어를 바꾸거나 전체 목록을 확인하세요.</p><button class="text-button" data-action="clear-search">검색어 지우기 ↗</button></div>') + '</div>',
      '<section class="index-sources"><div><span class="section-index">SOURCE SHELF</span><h2>자료 모음</h2><p>앨범·작품 정보를 확인한 원자료로 이동합니다.</p></div><div class="source-shelf">' + externalLink(data.album.apple, 'Apple Music · 앨범 정보') + externalLink(data.album.spotify, 'Spotify · 앨범 정보') + externalLink(data.album.official, 'TOPSPOT · 공식 앨범 링크') + externalLink(data.album.interview, 'GQ Hong Kong · 인터뷰') + externalLink('https://dearmoon.earth/', 'dearMoon · 프로젝트 기록') + '</div></section>',
      '</section>',
      '<footer class="site-footer wrap"><a class="wordmark" href="#home"><span>T.O.P.</span><i>ARCHIVE</i></a><span>INDEX / SOURCES</span><button class="text-button" data-nav="life">THE LIFE ↗</button></footer>'
    ].join('');
  }

  function renderRoute(shouldScroll, focusHeading) {
    const route = location.hash ? location.hash.slice(1) : state.route || 'home';
    state.route = route;
    const parts = route.split('/');
    const page = parts[0] || 'home';
    let markup = homeView();
    if (page === 'records') markup = recordsView();
    if (page === 'life') markup = lifeView(parts[1]);
    if (page === 'track') markup = trackDetailView(Number(parts[1]) || 1);
    if (page === 'search') markup = searchView();
    if (page === 'index') markup = indexView();
    document.getElementById('route-view').innerHTML = markup;
    document.querySelectorAll('[data-nav]').forEach(function (link) {
      const currentPage = route.split('/')[0];
      const targetPage = link.getAttribute('data-nav').split('/')[0];
      if (link.matches('.primary-nav a')) {
        if (currentPage === targetPage) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    });
    renderPlayer();
    const lyricsInput = document.getElementById('lyrics-input');
    if (lyricsInput && page === 'track') lyricsInput.value = loadLyrics(Number(parts[1]) || 1);
    const searchInput = document.getElementById('archive-search');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.searchText = searchInput.value;
        renderSearchResults();
      });
      if (page === 'search' && focusHeading) window.setTimeout(function () { searchInput.focus(); }, 10);
    }
    if (shouldScroll) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) window.scrollTo(0, 0);
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (focusHeading && page !== 'search') {
      const heading = document.querySelector('#route-view h1');
      if (heading) window.setTimeout(function () { heading.focus({ preventScroll: true }); }, 0);
    }
  }

  function getPreviews() {
    if (state.previews) return Promise.resolve(state.previews);
    if (state.previewPromise) return state.previewPromise;
    state.previewPromise = fetch('https://itunes.apple.com/lookup?country=kr&id=1889117489&entity=song')
      .then(function (response) {
        if (!response.ok) throw new Error('preview request failed');
        return response.json();
      })
      .then(function (payload) {
        const rows = (payload.results || []).filter(function (row) { return row.wrapperType === 'track' && row.previewUrl; });
        const lookup = {};
        rows.forEach(function (row) { lookup[row.trackNumber] = row.previewUrl; });
        state.previews = lookup;
        return lookup;
      })
      .catch(function () {
        state.previews = {};
        return state.previews;
      });
    return state.previewPromise;
  }

  async function playTrack(number) {
    const track = getTrack(number);
    if (state.currentTrack && state.currentTrack.number === track.number && !audio.paused) {
      audio.pause();
      state.previewMessage = '일시정지했습니다.';
      renderPlayer();
      return;
    }
    state.currentTrack = track;
    state.previewMessage = 'Apple Music 미리듣기를 확인하는 중…';
    renderPlayer();
    const previews = await getPreviews();
    const previewUrl = previews[track.number];
    if (!previewUrl) {
      state.previewMessage = '이 지역에서 미리듣기를 불러오지 못했습니다. 공식 플랫폼 링크를 이용해 주세요.';
      renderPlayer();
      showToast('미리듣기를 열지 못했습니다. Apple Music 또는 Spotify에서 이어 들을 수 있습니다.');
      return;
    }
    audio.pause();
    audio.src = previewUrl;
    audio.currentTime = 0;
    state.previewMessage = '30초 미리듣기 재생 중';
    try {
      await audio.play();
      renderPlayer();
      updateProgress();
    } catch (error) {
      state.previewMessage = '재생을 시작하지 못했습니다. 재생 버튼을 다시 눌러 주세요.';
      renderPlayer();
    }
  }

  function selectTrack(number) {
    const track = getTrack(number);
    if (state.currentTrack && state.currentTrack.number !== track.number) audio.pause();
    state.currentTrack = track;
    state.previewMessage = '';
    renderPlayer();
  }

  function skipTrack(direction) {
    const current = state.currentTrack ? state.currentTrack.number : 1;
    const next = current + direction < 1 ? data.tracks.length : current + direction > data.tracks.length ? 1 : current + direction;
    selectTrack(next);
    go('track/' + next);
  }

  function handleClick(event) {
    const enter = event.target.closest('[data-enter]');
    if (enter) { closeIntro(enter.getAttribute('data-enter')); return; }
    const nav = event.target.closest('[data-nav]');
    if (nav) { go(nav.getAttribute('data-nav')); return; }
    const eventButton = event.target.closest('[data-event]');
    if (eventButton) { go('life/' + eventButton.getAttribute('data-event')); return; }
    const play = event.target.closest('[data-play]');
    if (play) { playTrack(Number(play.getAttribute('data-play'))); return; }
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      state.indexType = filter.getAttribute('data-filter');
      renderRoute(false, false);
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const name = action.getAttribute('data-action');
    if (name === 'play' && state.currentTrack) playTrack(state.currentTrack.number);
    if (name === 'previous') skipTrack(-1);
    if (name === 'next') skipTrack(1);
    if (name === 'expand-player') { state.expandedPlayer = !state.expandedPlayer; renderPlayer(); }
    if (name === 'clear-search') {
      state.searchText = '';
      const input = document.getElementById('archive-search');
      if (input) { input.value = ''; input.focus(); }
      renderSearchResults();
    }
    if (name === 'save-lyrics') {
      const number = Number(action.getAttribute('data-lyrics-track'));
      const input = document.getElementById('lyrics-input');
      try { localStorage.setItem('topspot-lyrics-' + number, input ? input.value : ''); showToast('이 기기에 저장했습니다.'); }
      catch (error) { showToast('브라우저 저장 공간을 사용할 수 없습니다.'); }
    }
    if (name === 'delete-lyrics') {
      const number = Number(action.getAttribute('data-lyrics-track'));
      try { localStorage.removeItem('topspot-lyrics-' + number); } catch (ignore) {}
      const input = document.getElementById('lyrics-input');
      if (input) input.value = '';
      showToast('개인 메모를 삭제했습니다.');
    }
  }

  function handleChange(event) {
    if (event.target.id === 'life-year') {
      state.lifeYear = event.target.value;
      const selected = state.route.split('/')[1];
      document.getElementById('route-view').innerHTML = lifeView(selected);
      return;
    }
  }

  function handleKeydown(event) {
    const target = event.target;
    const typing = target && (target.matches('input, textarea, select, [contenteditable="true"]'));
    if (event.key === '/' && !typing) {
      event.preventDefault();
      go('search');
      return;
    }
    if (event.key === 'Escape' && state.route === 'search') {
      go('home');
      return;
    }
    if (!typing && state.route.indexOf('track/') === 0 && event.key === 'ArrowLeft') {
      event.preventDefault();
      skipTrack(-1);
    }
    if (!typing && state.route.indexOf('track/') === 0 && event.key === 'ArrowRight') {
      event.preventDefault();
      skipTrack(1);
    }
  }

  function setupAudio() {
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('play', function () { renderPlayer(); });
    audio.addEventListener('pause', function () { renderPlayer(); });
    audio.addEventListener('ended', function () {
      state.previewMessage = '30초 미리듣기가 끝났습니다. 전체 곡은 공식 플랫폼에서 들을 수 있습니다.';
      renderPlayer();
    });
    audio.addEventListener('error', function () {
      if (state.currentTrack) {
        state.previewMessage = '미리듣기를 불러오지 못했습니다. 공식 플랫폼 링크를 이용해 주세요.';
        renderPlayer();
      }
    });
  }

  function init() {
    renderShell();
    setupAudio();
    app.addEventListener('click', handleClick);
    app.addEventListener('change', handleChange);
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('hashchange', function () { state.route = location.hash.slice(1) || 'home'; renderRoute(true, true); });
    renderRoute(false, false);
    try {
      if (!localStorage.getItem('topspot-intro-seen')) document.getElementById('intro').classList.add('is-visible');
    } catch (ignore) {
      document.getElementById('intro').classList.add('is-visible');
    }
  }

  init();
}());
