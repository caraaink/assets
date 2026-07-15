/* ==========================================================
   Mionime - Cari Anime dari Cuplikan Scene 
   ========================================================== */
(function () {
'use strict';

// Hanya jalan jika UI scene ada di halaman (homepage)
const sceneUI = document.getElementById('welcomeModeScene');
if (!sceneUI) return;

// ================== INJEKSI MARKUP RESULT BOX + MODAL ==================
if (!document.getElementById('search-result-box')) {
  document.body.insertAdjacentHTML('beforeend', `<div id="search-result-box" class="search-result-box">
  <div id="search-result-header" class="search-result-header">
    <h3><i class="fa-solid fa-magnifying-glass" style="color: var(--primary);"></i> Hasil Pencarian Scene</h3>
    <div class="srh-right">
      <span class="srh-brand">mionime.com</span>
      <button class="close-btn" onclick="closeResultBox()" title="Tutup">✕</button>
    </div>
  </div>

  <div id="google-lens-section" class="lens-section">
    <div id="lens-results" class="lens-results"></div>
  </div>

  <div id="search-result-content">
    <div id="result-list"></div>
    <div id="detail-content"></div>
  </div>
</div>

<div id="videoModal" class="modal">
  <div class="modal-content">
    <span class="close-modal" onclick="closeModal()">&times;</span>
    <div id="modalContent">
      <video id="modalVideo" controls><source src="" type="video/mp4">Browser kamu tidak mendukung video.</video>
      <iframe id="modalIframe" frameborder="0" allowfullscreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      <img id="modalImage" src="" alt="Full-size image">
    </div>
  </div>
</div>`);
}
lockScrollableContainers();

// ================== GOOGLE LENS CACHE ==================
let googleLensCache = null;        // Simpan hasil HTML Google Lens
let currentSearchImageUrl = null;  // Simpan imageUrl yang sedang digunakan
let lastDetailArgs = null;         // Simpan argumen detail terakhir (untuk refresh more-info)
// ======================================================

// Kunci UI saat pencarian berjalan: spinner tampil, tombol Cari disable (anti double-klik)
function setSceneBusy(busy) {
  const loading = document.getElementById('loading_file');
  const uploadIcon = document.querySelector('.upload-icon');
  const searchBtn = document.getElementById('search-anime-btn');
  if (loading) loading.style.display = busy ? 'block' : 'none';
  if (uploadIcon) uploadIcon.style.display = busy ? 'none' : 'block';
  if (searchBtn) searchBtn.disabled = busy;
}

function resetResultScroll() {
  ['search-result-content', 'result-list', 'detail-content'].forEach(function(elId) {
    const el = document.getElementById(elId);
    if (el) el.scrollTop = 0;
  });
}

function lockOverscrollChaining(el) {
  if (!el || el.dataset.overscrollLocked) return;
  el.dataset.overscrollLocked = '1';

  let startY = 0;
  el.addEventListener('touchstart', function(e) {
    if (e.touches && e.touches.length) startY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchmove', function(e) {
    if (!e.touches || !e.touches.length) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY; // > 0 = jari geser ke bawah (mau scroll ke atas)

    const atTop = el.scrollTop <= 0;
    const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

    if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
      e.preventDefault();
    }
  }, { passive: false });
}

function lockScrollableContainers() {
  ['search-result-content', 'result-list', 'detail-content'].forEach(function(elId) {
    lockOverscrollChaining(document.getElementById(elId));
  });
}

async function fetchGoogleLens(imageUrl) {
  const lensSection = document.getElementById('google-lens-section');
  const lensContainer = document.getElementById('lens-results');

  lensSection.style.display = 'block';
  lensContainer.innerHTML = '<div style="padding:10px; color:var(--text-muted); font-size:13px;">Memuat gambar serupa...</div>';

  const SEARCH_URL = atob("aHR0cHM6Ly9hcGkubWVvd25pbWUubmV0L3NlYXJjaA==");
  try {
    const response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `imageUrl=${encodeURIComponent(imageUrl)}`
    });

    const html = await response.text();

    if (html && html.trim() !== '') {
      lensContainer.innerHTML = html;
      googleLensCache = html;        // Simpan hasil ke cache
    } else {
      lensSection.style.display = 'none';
      googleLensCache = null;
    }
  } catch (err) {
    console.warn('Google Lens gagal:', err.message);
    lensSection.style.display = 'none';
    googleLensCache = null;
  }
}

// Tandai thumbnail Google Lens yang sedang dipakai untuk pencarian ulang
function highlightLensSelection(selectedImageUrl) {
  document.querySelectorAll('#lens-results img').forEach(function(img) {
    const holder = img.closest('[onclick]');
    const onclickAttr = holder ? (holder.getAttribute('onclick') || '') : (img.getAttribute('onclick') || '');
    const isSelected = img.src === selectedImageUrl
      || img.getAttribute('data-url') === selectedImageUrl
      || (selectedImageUrl && onclickAttr.indexOf(selectedImageUrl) !== -1);
    img.classList.toggle('lens-selected', isSelected);
  });
}

// Fungsi ketika user klik gambar dari Google Lens
async function useLensImage(selectedImageUrl) {
  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const detailContent = document.getElementById('detail-content');
  const lensSection = document.getElementById('google-lens-section');
  const lensResults = document.getElementById('lens-results');

  if (!resultBox || !resultList) return;

  // Tandai foto yang dipilih dulu, baru simpan HTML Lens supaya tidak hilang
  // (tanda ikut tersimpan dan tetap ada setelah HTML di-restore)
  highlightLensSelection(selectedImageUrl);
  const oldLensHTML = lensResults ? lensResults.innerHTML : '';

  // Reset detail sepenuhnya
  detailContent.innerHTML = '';
  detailContent.style.display = 'none';

  // Kembalikan tampilan mobile ke mode list
  resultList.style.display = 'block';

  // Tampilkan loading
  resultList.innerHTML = `
    <div style="padding:40px 20px; text-align:center; color:var(--text-muted);">
      <div class="more-info-loading" style="margin:0 auto; width:60px; height:60px;">
        <div class="spinner"></div>
      </div>
      <p style="margin-top:15px;">Mencari anime dari gambar yang dipilih...</p>
    </div>
  `;

  // Pertahankan posisi & ukuran box; yang berganti cukup isi list (spinner)
  resultBox.style.display = 'flex';

  try {
    // Jalankan pencarian ulang
    await performSearch(null, selectedImageUrl, true);

    // Setelah search selesai, pastikan Lens tetap muncul
    if (oldLensHTML && lensSection && lensResults) {
      setTimeout(() => {
        lensSection.style.display = 'block';
        lensResults.innerHTML = oldLensHTML;
      }, 400);
    }
  } catch (err) {
    console.error('Lens search failed:', err);
    resultList.innerHTML = `<p style="color:red; padding:20px; text-align:center;">Gagal melakukan pencarian.<br>${err.message}</p>`;
  }
}


// Cache for storing fetched moreInfo data
const moreInfoCache = new Map();

let currentResultsStore = [];

// Dynamic API base URL
const apiBaseUrl = window.location.origin;

// ================== SANITASI OUTPUT (anti-XSS) ==================
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeSynopsis(text) {
  const escaped = escapeHtml(text);
  let withTags = escaped.replace(/&lt;(\/?(?:i|b|em|strong)|br\s*\/?)&gt;/gi, (match, tag) => `<${tag}>`);
  withTags = withTags.replace(/<br\s*\/?>/gi, '\n');
  return withTags
    .split(/\n{2,}/)
    .map(p => p.trim().replace(/\n/g, '<br>'))
    .filter(p => p.length > 0)
    .join('<br><br>');
}

function isValidYoutubeId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{6,20}$/.test(id);
}

// Fungsi untuk konversi detik ke HH:MM:SS
function formatTime(seconds) {
  const date = new Date(null);
  date.setSeconds(Math.floor(seconds));
  return date.toISOString().substr(11, 8);
}

// Fungsi untuk delay (digunakan untuk retry)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchMoreInfo(anilistId, retries = 2, backoff = 1000) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        trailer {
          id
          site
          thumbnail
        }
        staff(sort: RELEVANCE, page: 1, perPage: 5) {
          edges {
            role
            node {
              name {
                full
              }
              image {
                medium
              }
            }
          }
        }
        favourites
        popularity
        meanScore
        averageScore
        season
        seasonYear
        description(asHtml: false)
        characters(sort: FAVOURITES_DESC, page: 1, perPage: 5) {
          edges {
            node {
              name {
                full
              }
              image {
                medium
              }
            }
            voiceActors(language: JAPANESE) {
              name {
                full
              }
              image {
                medium
              }
            }
          }
        }
      }
    }
  `;
  const variables = { id: parseInt(anilistId) };

  try {
    const response = await fetch(atob("aHR0cHM6Ly9hcGkubWVvd25pbWUubmV0L2FwaS9hbmlsaXN0"), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        console.warn(`Rate limit hit for AniList ID ${anilistId}, retrying after ${backoff}ms...`);
        await delay(backoff);
        return fetchMoreInfo(anilistId, retries - 1, backoff * 2);
      }
      throw new Error(`AniList API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.errors) throw new Error(data.errors[0].message);
    moreInfoCache.set(anilistId.toString(), data.data.Media);
    return data.data.Media;
  } catch (error) {
    console.error('More info fetch error for ID', anilistId, ':', error.message);
    if (retries > 0) {
      console.warn(`Retrying fetchMoreInfo for ID ${anilistId}, retries left: ${retries}`);
      await delay(backoff);
      return fetchMoreInfo(anilistId, retries - 1, backoff * 2);
    }
    return null;
  }
}

async function showDetail(id, videoUrl, filename, from, to, anilist, imageUrl, isMoreInfoFetch = false) {
  const detailContent = document.getElementById('detail-content');
  const searchResultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const lensSection = document.getElementById('google-lens-section');
  
  if (!detailContent) return;
  if (lensSection) {
      lensSection.style.display = 'none';   // Sembunyikan Google Lens saat buka detail
    }
  const title = anilist.title || {};
  const coverImage = anilist.coverImage ? anilist.coverImage.large : 'https://via.placeholder.com/100?text=Poster';

  let moreInfo = moreInfoCache.get(anilist.id.toString()) || anilist.moreInfo || null;
  let moreInfoHTML = '';

  if (!moreInfo) {
    moreInfoHTML = `<div class="more-info-trigger" data-anilist-id="${anilist.id}">Lihat Info Selengkapnya</div>`;
  } else {
    const trailer = moreInfo.trailer;
    const trailerHTML = trailer && trailer.site === 'youtube' && isValidYoutubeId(trailer.id) && trailer.thumbnail
      ? `<div class="trailer-link clickable" data-trailer="https://www.youtube.com/embed/${trailer.id}">
           <img src="${escapeHtml(trailer.thumbnail)}" alt="Trailer" loading="lazy" width="300" height="169">
           <span class="play-icon">▶︎</span>
         </div>`
      : '<p>Tidak ada trailer tersedia.</p>';

    const characters = moreInfo.characters && moreInfo.characters.edges.length > 0
      ? moreInfo.characters.edges.map(edge => {
          const characterName = escapeHtml(edge.node.name.full);
          const voiceActor = escapeHtml(edge.voiceActors[0]?.name.full || 'Tidak diketahui');
          const characterImage = escapeHtml(edge.node.image?.medium || 'https://via.placeholder.com/50?text=No+Image');
          const vaImage = escapeHtml(edge.voiceActors[0]?.image?.medium || 'https://via.placeholder.com/50?text=No+Image');
          return `<p>
            <img src="${characterImage}" alt="${characterName}" loading="lazy" width="50" height="50" class="clickable" data-fullsize="${characterImage}">
            <strong>${characterName}</strong>
            <span><img src="${vaImage}" alt="${voiceActor}" loading="lazy" width="50" height="50" class="clickable" data-fullsize="${vaImage}"><span class="va-name">${voiceActor}</span></span>
          </p>`;
        }).join('')
      : '<p>Tidak ada data karakter tersedia.</p>';

    const staff = moreInfo.staff && moreInfo.staff.edges.length > 0
      ? moreInfo.staff.edges.map(edge => {
          const staffName = escapeHtml(edge.node.name.full);
          const staffRole = escapeHtml(edge.role || 'Tidak diketahui');
          const staffImage = edge.node.image?.medium ? escapeHtml(edge.node.image.medium) : null;
          return staffImage
            ? `<p><img src="${staffImage}" alt="${staffName}" loading="lazy" width="50" height="50" class="clickable" data-fullsize="${staffImage}"> <strong>${staffRole}</strong>: <span class="staff-name">${staffName}</span></p>`
            : `<p><strong>${staffRole}</strong>: <span class="staff-name">${staffName}</span></p>`;
        }).join('')
      : '<p>Tidak ada data staf tersedia.</p>';

    moreInfoHTML = `
      <div class="detail-group">
        <div class="detail-group-title"><i class="fa-solid fa-chart-simple"></i> Statistik</div>
        <p><strong>Favorit:</strong> ${moreInfo.favourites || 'Tidak diketahui'}</p>
        <p><strong>Popularitas:</strong> ${moreInfo.popularity || 'Tidak diketahui'}</p>
        <p><strong>Skor Rata-rata:</strong> ${moreInfo.meanScore || 'Tidak diketahui'}/100</p>
        <p><strong>Musim:</strong> ${moreInfo.season && moreInfo.seasonYear ? `${escapeHtml(moreInfo.season)} ${escapeHtml(moreInfo.seasonYear)}` : 'Tidak diketahui'}</p>
      </div>
      <div class="detail-group">
        <div class="detail-group-title"><i class="fa-solid fa-book-open"></i> Sinopsis</div>
        <div class="synopsis">${moreInfo.description ? sanitizeSynopsis(moreInfo.description) : 'Tidak ada sinopsis tersedia.'}</div>
      </div>
      <div class="detail-group">
        <div class="detail-group-title"><i class="fa-solid fa-clapperboard"></i> Trailer</div>
        ${trailerHTML}
      </div>
      <div class="detail-group">
        <div class="detail-group-title"><i class="fa-solid fa-user-group"></i> Pemeran Karakter</div>
        <div class="character-list">${characters}</div>
      </div>
      <div class="detail-group">
        <div class="detail-group-title"><i class="fa-solid fa-users-gear"></i> Staf Produksi</div>
        <div class="staff-list">${staff}</div>
      </div>
    `;
  }

  lastDetailArgs = [id, videoUrl, filename, from, to, anilist, imageUrl];

  detailContent.innerHTML = `
    <div class="detail-section">
      <span class="detail-close" onclick="closeDetail()">✕</span>

      <div class="detail-group">
        <div class="video-preview">
          ${videoUrl ? `
            <div class="video-wrapper">
              <div class="detail-preview clickable">
                <img src="${escapeHtml(imageUrl) || 'https://via.placeholder.com/300x169?text=Video'}" alt="preview" data-original="${escapeHtml(videoUrl)}">
                <span class="play-icon">▶︎</span>
              </div>
            </div>
          ` : '<p>Tidak ada video preview.</p>'}
          <button id="tonton-full" class="tonton-btn">Tonton Full Episode</button>
        </div>
        <p class="filename-small">Filename: ${escapeHtml(filename) || 'Tidak diketahui'} | Waktu Scene: ${formatTime(from)} - ${formatTime(to)}</p>
      </div>

      <div class="detail-group">
        <div class="detail-group-title"><i class="fa-solid fa-circle-info"></i> Identitas Anime</div>
        <div class="full-info">
          <div class="poster-frame">
            <img class="poster clickable" src="${escapeHtml(coverImage)}" alt="Poster" width="100" height="140" data-fullsize="${escapeHtml(coverImage)}">
          </div>
          <p><strong>Judul Romaji:</strong> ${escapeHtml(title.romaji) || 'Tidak diketahui'}</p>
          <p><strong>Judul Jepang:</strong> ${escapeHtml(title.native) || 'Tidak diketahui'}</p>
          <p><strong>Judul Inggris:</strong> ${escapeHtml(title.english) || 'Tidak diketahui'}</p>
          <p><strong>Alias:</strong> ${anilist.synonyms && anilist.synonyms.length ? escapeHtml(anilist.synonyms.join(', ')) : 'Tidak ada'}</p>
        </div>
      </div>

      <div class="detail-group">
        <div class="detail-group-title"><i class="fa-solid fa-list-ul"></i> Detail Rilis</div>
        <p><strong>Is Adult:</strong> ${anilist.isAdult ? 'Ya' : 'Tidak'}</p>
        <p><strong>Genre:</strong> ${anilist.genres && anilist.genres.length ? escapeHtml(anilist.genres.join(', ')) : 'Tidak diketahui'}</p>
        <p><strong>Format:</strong> ${escapeHtml(anilist.format) || 'Tidak diketahui'}</p>
        <p><strong>Status:</strong> ${escapeHtml(anilist.status) || 'Tidak diketahui'}</p>
        <p><strong>Total Episodes:</strong> ${anilist.episodes ? escapeHtml(anilist.episodes) : 'Tidak diketahui'}</p>
        <p><strong>Durasi per Episode:</strong> ${anilist.duration ? `${escapeHtml(anilist.duration)} menit` : 'Tidak diketahui'}</p>
        <p><strong>Tanggal Mulai:</strong> ${anilist.startDate ? `${escapeHtml(anilist.startDate.year)}-${escapeHtml(anilist.startDate.month)}-${escapeHtml(anilist.startDate.day)}` : 'Tidak diketahui'}</p>
        <p><strong>Tanggal Selesai:</strong> ${anilist.endDate ? `${escapeHtml(anilist.endDate.year)}-${escapeHtml(anilist.endDate.month)}-${escapeHtml(anilist.endDate.day)}` : 'Tidak diketahui'}</p>
        <p><strong>Studios:</strong> ${anilist.studios && anilist.studios.edges.length ? escapeHtml(anilist.studios.edges.map(edge => edge.node.name).join(', ')) : 'Tidak diketahui'}</p>
        <p><strong>Sumber:</strong> ${escapeHtml(anilist.source) || 'Tidak diketahui'}</p>
        <p><strong>Anilist ID:</strong> ${anilist.id ? `<a href="https://anilist.co/anime/${encodeURIComponent(anilist.id)}" target="_blank" rel="noopener noreferrer">${escapeHtml(anilist.id)}</a>` : 'Tidak diketahui'}
           <strong>MAL ID:</strong> ${anilist.idMal ? `<a href="https://myanimelist.net/anime/${encodeURIComponent(anilist.idMal)}" target="_blank" rel="noopener noreferrer">${escapeHtml(anilist.idMal)}</a>` : 'Tidak diketahui'}</p>
      </div>

      ${moreInfoHTML}
    </div>
  `;

  // Tombol Tonton Full Episode
  const tontonBtn = detailContent.querySelector('#tonton-full');
  if (tontonBtn) {
    tontonBtn.addEventListener('click', async () => {
      const malId = anilist.idMal || 0;
      if (!anilist.idMal && !anilist.id) {
        tontonBtn.style.backgroundColor = 'gray';
        tontonBtn.textContent = 'ID anime tidak ditemukan';
        return;
      }

      tontonBtn.textContent = 'Mengecek...';
      tontonBtn.disabled = true;

      try {
        const anilistParam = anilist.id ? `?anilist=${encodeURIComponent(anilist.id)}` : '';
        const res = await fetch(`${window.location.origin}/api/check/${malId}${anilistParam}`);
        const data = await res.json();

        if (data.code === 200) {
          tontonBtn.style.backgroundColor = 'green';
          tontonBtn.textContent = 'Tersedia! Mengarahkan...';
          setTimeout(() => window.location.href = window.location.origin + data.data, 3000);
        } else if (data.code === 404) {
          tontonBtn.style.backgroundColor = 'red';
          tontonBtn.textContent = 'Tidak tersedia di database';
        }
      } catch (err) {
        tontonBtn.style.backgroundColor = 'orange';
        tontonBtn.textContent = 'Gagal mengecek';
      } finally {
        tontonBtn.disabled = false;
      }
    });
  }

  // Tampilkan detail sesuai ukuran layar
  if (window.innerWidth <= 600) {
    resultList.style.display = 'none';
    detailContent.style.display = 'block';
    searchResultBox.style.maxWidth = '500px';
  } else {
    detailContent.style.display = 'block';
    searchResultBox.style.maxWidth = '1100px';
    resultList.style.maxWidth = '550px';
  }

  // Scroll behavior
  setTimeout(() => {
    detailContent.scrollTop = isMoreInfoFetch && moreInfo ? 0 : 0;
  }, 100);

  // Event listeners untuk gambar dan video
  attachDetailEvents();
}

function attachDetailEvents() {
  const detailContent = document.getElementById('detail-content');

  // Preview video
  const detailPreview = detailContent.querySelector('.detail-preview.clickable');
  if (detailPreview) {
    detailPreview.addEventListener('click', function() {
      openModalVideo(this.querySelector('img').dataset.original);
    });
  }

  // Trailer
  const trailerLink = detailContent.querySelector('.trailer-link.clickable');
  if (trailerLink) {
    trailerLink.addEventListener('click', function() {
      openModalIframe(this.dataset.trailer);
    });
  }

  // Clickable images (poster, character, staff)
  detailContent.querySelectorAll('.poster.clickable, .character-list img.clickable, .staff-list img.clickable').forEach(img => {
    img.addEventListener('click', function() {
      openModalImage(this.dataset.fullsize);
    });
  });

  // More info trigger
  const moreInfoTrigger = detailContent.querySelector('.more-info-trigger');
  if (moreInfoTrigger) {
    moreInfoTrigger.addEventListener('click', async function() {
      const anilistId = this.dataset.anilistId;
      const loadingSpinner = document.createElement('div');
      loadingSpinner.className = 'more-info-loading';
      loadingSpinner.innerHTML = '<div class="spinner"></div>';
      this.insertAdjacentElement('beforebegin', loadingSpinner);
      this.style.display = 'none';

      const moreInfo = await fetchMoreInfo(anilistId);
      if (moreInfo && lastDetailArgs) {
        showDetail(lastDetailArgs[0], lastDetailArgs[1], lastDetailArgs[2], lastDetailArgs[3], lastDetailArgs[4], lastDetailArgs[5], lastDetailArgs[6], true);
      } else {
        loadingSpinner.remove();
        this.style.display = 'inline-block';
      }
    });
  }
}

function openModalVideo(src) {
  const modal = document.getElementById('videoModal');
  const modalVideo = document.getElementById('modalVideo');
  modalVideo.style.display = 'block';
  modalVideo.querySelector('source').src = src;
  modalVideo.load();
  document.getElementById('search-result-box').style.display = 'none';
  modal.style.display = 'flex';
}

function openModalIframe(src) {
  if (typeof src !== 'string' || !/^https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]{6,20}(\?.*)?$/.test(src)) {
    console.warn('URL trailer tidak valid, dibatalkan:', src);
    return;
  }
  const modal = document.getElementById('videoModal');
  const modalIframe = document.getElementById('modalIframe');
  modalIframe.style.display = 'block';
  modalIframe.src = src;
  document.getElementById('search-result-box').style.display = 'none';
  modal.style.display = 'flex';
}

function openModalImage(src) {
  const modal = document.getElementById('videoModal');
  const modalImage = document.getElementById('modalImage');
  modalImage.style.display = 'block';
  modalImage.src = src;
  document.getElementById('search-result-box').style.display = 'none';
  modal.style.display = 'flex';
}

function closeDetail() {
  const detailContent = document.getElementById('detail-content');
  const resultList = document.getElementById('result-list');
  const searchResultBox = document.getElementById('search-result-box');
  const lensSection = document.getElementById('google-lens-section');

  detailContent.style.display = 'none';
  resultList.style.display = 'block';
  if (lensSection) {
      lensSection.style.display = 'block';
    }
  if (window.innerWidth > 600) {
    searchResultBox.style.maxWidth = '550px';
    resultList.style.maxWidth = '550px';
  }
  document.querySelectorAll('.result-item').forEach(item => item.classList.remove('active'));
}

function closeResultBox() {
  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const detailContent = document.getElementById('detail-content');
  const floatingFooter = document.getElementById('floating-footer');
  const fileInput = document.getElementById('file-short-anime');
  const imageUrlInput = document.getElementById('image-url');
  
  resultBox.style.display = 'none';
  resultList.innerHTML = '';
  detailContent.innerHTML = '';
  detailContent.style.display = 'none';
  fileInput.value = '';
  imageUrlInput.value = '';
  floatingFooter.style.display = 'flex';

  // Reset cache
  moreInfoCache.clear();
  googleLensCache = null;
  currentSearchImageUrl = null;
  currentResultsStore = [];
}

document.getElementById('file-short-anime').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;

  const loading = document.getElementById('loading_file');
  const uploadIcon = document.querySelector('.upload-icon');
  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const detailContent = document.getElementById('detail-content');
  const floatingFooter = document.getElementById('floating-footer');

  setSceneBusy(true);
  resultList.innerHTML = '';
  detailContent.innerHTML = '';
  moreInfoCache.clear();
  googleLensCache = null;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'chat_meownime');
    formData.append('cloud_name', 'meownime');

    const res = await fetch(atob("aHR0cHM6Ly9hcGkuY2xvdWRpbmFyeS5jb20vdjFfMS9tZW93bmltZS9hdXRvL3VwbG9hZA=="), {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error(`Upload error: ${res.status}`);

    const data = await res.json();
    const imageUrl = data.secure_url;

    await performSearch(null, imageUrl);
  } catch (error) {
    console.error('Upload error:', error);
    resultList.innerHTML = `<p class="error">Gagal mengunggah gambar: ${error.message}</p>`;
  } finally {
    setSceneBusy(false);
    this.value = '';
  }
});

function isValidImageLink(value) {
  return /^https?:\/\/\S+\.\S+/i.test(value);
}

function triggerSceneUrlSearch() {
  const searchBtn = document.getElementById('search-anime-btn');
  if (searchBtn && searchBtn.disabled) return; // anti double-klik
  const urlInput = document.getElementById('image-url');
  const rawValue = urlInput ? urlInput.value.trim() : '';
  if (rawValue !== '' && isValidImageLink(rawValue)) {
    setSceneBusy(true);
    moreInfoCache.clear();
    googleLensCache = null;
    performSearch(null, rawValue);
  } else {
    alert('Masukkan LINK / URL gambar yang valid (diawali http:// atau https://), bukan teks judul!\nUntuk pencarian dengan tulisan, gunakan kolom pencarian di bar situs paling atas.');
  }
}

document.getElementById('search-anime-btn').addEventListener('click', triggerSceneUrlSearch);

document.getElementById('image-url').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); triggerSceneUrlSearch(); }
});

async function performSearch(base64Image, imageUrl, keepOpen) {
  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const detailContent = document.getElementById('detail-content');
  const loading = document.getElementById('loading_file');
  const uploadIcon = document.querySelector('.upload-icon');
  const floatingFooter = document.getElementById('floating-footer');

  detailContent.innerHTML = '';
  detailContent.style.display = 'none';
  if (!keepOpen) {
    // Pencarian baru: kosongkan & sembunyikan box dulu
    resultList.innerHTML = '';
    resultBox.style.display = 'none';
  }
  if (!keepOpen) resultBox.style.maxWidth = window.innerWidth > 600 ? '550px' : '500px';
  setSceneBusy(true);

  try {
    const params = new URLSearchParams();
    if (base64Image) params.append('image', base64Image);
    else if (imageUrl) params.append('url', imageUrl);
    
    params.append('anilistInfo', 1);
    params.append('cutBorders', 1);

    const TRACE_URL = atob("aHR0cHM6Ly9hcGkubWVvd25pbWUubmV0L2FwaS90cmFjZQ==");
    const response = await fetch(`${TRACE_URL}?${params.toString()}`, { method: 'GET' });

    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

    const data = await response.json();

    if (data.result && data.result.length > 0) {
      const resultsWithMoreInfo = await Promise.all(data.result.map(async (result) => {
        const anilist = result.anilist || {};
        if (anilist.id && moreInfoCache.has(anilist.id.toString())) {
          anilist.moreInfo = moreInfoCache.get(anilist.id.toString());
        } else if (anilist.id) {
          const moreInfo = await fetchMoreInfo(anilist.id);
          if (moreInfo) anilist.moreInfo = moreInfo;
        }
        return { ...result, anilist };
      }));

      currentResultsStore = resultsWithMoreInfo;

      let resultsHTML = '';
      resultsWithMoreInfo.forEach((result, index) => {
        const anilist = result.anilist || {};
        const title = anilist.title || {};
        const hasVideo = result.video && result.video !== '';

        const previewDivHTML = `
          <div class="preview-media ${hasVideo ? 'clickable' : ''}">
            <img src="${escapeHtml(result.image) || 'https://via.placeholder.com/100?text=Video'}" height="100" width="100" alt="preview" loading="lazy" ${hasVideo ? `data-original="${escapeHtml(result.video)}"` : ''}>
            ${hasVideo ? '<span class="play-icon">▶︎</span>' : ''}
          </div>
        `;

        resultsHTML += `
          <div class="result-item" data-result-index="${index}">
            <div class="summary-info">
              <div class="anime-title">${escapeHtml(title.romaji || title.native) || 'Tidak diketahui'}</div>
              <div class="anime-subtitle">${escapeHtml(title.native) || 'Tidak diketahui'}</div>
              <hr>
              <p class="episode">Episode: ${escapeHtml(result.episode) || 'Tidak diketahui'}</p>
              <p class="time">Waktu Scene: ${formatTime(result.from)} - ${formatTime(result.to)}</p>
              <p>Similarity: ${(result.similarity * 100).toFixed(2)}%</p>
            </div>
            ${previewDivHTML}
          </div>
        `;
      });

      resultList.innerHTML = resultsHTML;
      attachResultEvents();

      setTimeout(() => {
        resultBox.style.display = 'flex';
        floatingFooter.style.display = 'none';
        resetResultScroll();
      }, 100);

      // Google Lens - Hanya fetch sekali
      if (imageUrl) {
        currentSearchImageUrl = imageUrl;
        if (!googleLensCache) {
          setTimeout(() => {
            fetchGoogleLens(imageUrl);
          }, 800);
        } else {
          // Tampilkan cache yang sudah ada
          setTimeout(() => {
            const lensSection = document.getElementById('google-lens-section');
            const lensContainer = document.getElementById('lens-results');
            lensSection.style.display = 'block';
            lensContainer.innerHTML = googleLensCache;
          }, 300);
        }
      }

    } else {
      resultList.innerHTML = '<p>Tidak ditemukan hasil yang cocok.</p>';
      setTimeout(() => {
        resultBox.style.display = 'flex';
        floatingFooter.style.display = 'none';
        resetResultScroll();
      }, 100);
    }

  } catch (error) {
    console.error('Search error:', error);
    resultList.innerHTML = `<p class="error">Gagal mencari: ${error.message},refresh halaman dan coba lagi`;
    floatingFooter.style.display = 'flex';
    setTimeout(() => {
      resultBox.style.display = 'flex';
      resetResultScroll();
    }, 100);
  } finally {
    setSceneBusy(false);
  }
}

function attachResultEvents() {
  document.querySelectorAll('.result-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (e.target.closest('.preview-media')) return;
      // Highlight persis item yang diklik (aman untuk data anime duplikat)
      document.querySelectorAll('.result-item').forEach(el => el.classList.remove('active'));
      this.classList.add('active');

      const index = parseInt(this.dataset.resultIndex, 10);
      const result = currentResultsStore[index];
      if (!result) return;

      const anilist = result.anilist || {};
      const id = anilist.id || `unknown-${index}`;
      showDetail(id, result.video, result.filename, result.from, result.to, anilist, result.image, false);
    });
  });

  document.querySelectorAll('.preview-media.clickable img').forEach(img => {
    img.addEventListener('click', function(e) {
      e.stopPropagation();
      openModalVideo(this.dataset.original);
    });
  });
}

// Global click handler untuk modal
document.addEventListener('click', function(e) {
  if (e.target.matches('.close-modal') || e.target.matches('.modal')) {
    const modal = document.getElementById('videoModal');
    modal.style.display = 'none';
    const modalVideo = document.getElementById('modalVideo');
    const modalIframe = document.getElementById('modalIframe');
    const modalImage = document.getElementById('modalImage');

    modalVideo.pause();
    modalVideo.querySelector('source').src = '';
    modalIframe.src = '';
    modalImage.src = '';

    if (document.getElementById('result-list').innerHTML) {
      document.getElementById('search-result-box').style.display = 'flex';
    }
  }
});

// ================== CLOSE MODAL FUNCTION ==================
function closeModal() {
  const modal = document.getElementById('videoModal');
  if (!modal) return;

  modal.style.display = 'none';

  // Reset semua media
  const modalVideo = document.getElementById('modalVideo');
  const modalIframe = document.getElementById('modalIframe');
  const modalImage = document.getElementById('modalImage');

  if (modalVideo) {
    modalVideo.pause();
    modalVideo.style.display = 'none';
    if (modalVideo.querySelector('source')) {
      modalVideo.querySelector('source').src = '';
    }
    modalVideo.load();
  }

  if (modalIframe) {
    modalIframe.style.display = 'none';
    modalIframe.src = '';
  }

  if (modalImage) {
    modalImage.style.display = 'none';
    modalImage.src = '';
  }

  // Kembalikan search result box jika ada hasil
  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  
  if (resultBox && resultList && resultList.innerHTML.trim() !== '') {
    resultBox.style.display = 'flex';
  }
}

document.addEventListener('click', function(e) {
  if (e.target.matches('.close-modal') || e.target.matches('.modal')) {
    closeModal();
  }
});

// ================== TOGGLE MODE WELCOME <-> SCENE ==================
let sceneUserInteracted = false;
let sceneAutoTimer = null;
let currentWelcomeMode = 'welcome';

function lockSceneAutoSwitch() {
  sceneUserInteracted = true;
  if (sceneAutoTimer) { clearInterval(sceneAutoTimer); sceneAutoTimer = null; }
}

function toggleWelcomeSceneMode(fromUser) {
  if (fromUser) lockSceneAutoSwitch();
  currentWelcomeMode = (currentWelcomeMode === 'welcome') ? 'scene' : 'welcome';
  const panelDefault = document.getElementById('welcomeModeDefault');
  const panelScene = document.getElementById('welcomeModeScene');
  if (!panelDefault || !panelScene) return;
  panelDefault.style.display = (currentWelcomeMode === 'welcome') ? 'block' : 'none';
  panelScene.style.display = (currentWelcomeMode === 'scene') ? 'block' : 'none';
}

// Auto ganti mode tiap 5 detik selama user belum berinteraksi;
// interaksi apa pun di panel scene = mode dipertahankan (stop auto switch)
sceneAutoTimer = setInterval(function() {
  if (!sceneUserInteracted) toggleWelcomeSceneMode(false);
}, 5000);

['focusin', 'click', 'change', 'paste', 'input'].forEach(function(evt) {
  sceneUI.addEventListener(evt, lockSceneAutoSwitch);
});

// ================== EKSPOS FUNGSI UNTUK ATRIBUT onclick ==================
window.closeResultBox = closeResultBox;
window.closeModal = closeModal;
window.closeDetail = closeDetail;
window.useLensImage = useLensImage;
window.toggleWelcomeSceneMode = toggleWelcomeSceneMode;

})();
