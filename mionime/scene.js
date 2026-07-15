// ================== GOOGLE LENS CACHE ==================
let googleLensCache = null;
let currentSearchImageUrl = null;
const moreInfoCache = new Map();

// Helper untuk Mencegah Double Click / Disable Tombol
function setBtnLoadingState(isLoading, text = "Cari") {
  const btn = document.getElementById('search-anime-btn');
  const fileInput = document.getElementById('file-short-anime');
  const fileLabel = document.querySelector('.scene-upload-icon');
  
  if (btn) {
    btn.disabled = isLoading;
    if (isLoading) {
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mencari...`;
    } else {
      btn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> ${text}`;
    }
  }
  if (fileInput) fileInput.disabled = isLoading;
  if (fileLabel) fileLabel.style.pointerEvents = isLoading ? "none" : "auto";
}

function formatTime(seconds) {
  const date = new Date(null);
  date.setSeconds(Math.floor(seconds));
  return date.toISOString().substr(11, 8);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGoogleLens(imageUrl) {
  const lensSection = document.getElementById('google-lens-section');
  const lensContainer = document.getElementById('lens-results');
  if (!lensSection || !lensContainer) return;

  lensSection.style.display = 'block';
  lensContainer.innerHTML = '<div style="padding:10px; color:var(--text-muted); font-size:13px;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat gambar serupa...</div>';

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
      googleLensCache = html;
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

async function useLensImage(selectedImageUrl) {
  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const detailContent = document.getElementById('detail-content');
  const lensSection = document.getElementById('google-lens-section');
  const lensResults = document.getElementById('lens-results');

  if (!resultBox || !resultList) return;
  const oldLensHTML = lensResults ? lensResults.innerHTML : '';

  detailContent.innerHTML = '';
  detailContent.style.display = 'none';
  resultList.style.display = 'block';
  resultList.innerHTML = `
    <div style="padding:40px 20px; text-align:center; color:var(--text-muted);">
      <div class="more-info-loading" style="margin:0 auto; width:50px; height:50px;">
        <div class="spinner"></div>
      </div>
      <p style="margin-top:15px; font-size:13px;">Mencari anime dari gambar terpilih...</p>
    </div>
  `;

  resultBox.style.display = 'block';
  try {
    await performSearch(null, selectedImageUrl);
    if (oldLensHTML && lensSection && lensResults) {
      setTimeout(() => {
        lensSection.style.display = 'block';
        lensResults.innerHTML = oldLensHTML;
      }, 400);
    }
  } catch (err) {
    resultList.innerHTML = `<p style="color:var(--primary); padding:20px; text-align:center;">Gagal melakukan pencarian.<br>${err.message}</p>`;
  }
}

async function fetchMoreInfo(anilistId, retries = 2, backoff = 1000) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        trailer { id site thumbnail }
        staff(sort: RELEVANCE, page: 1, perPage: 5) {
          edges { role node { name { full } image { medium } } }
        }
        favourites popularity meanScore averageScore season seasonYear description(asHtml: false)
        characters(sort: FAVOURITES_DESC, page: 1, perPage: 5) {
          edges {
            node { name { full } image { medium } }
            voiceActors(language: JAPANESE) { name { full } image { medium } }
          }
        }
      }
    }
  `;
  const variables = { id: parseInt(anilistId) };
  try {
    const response = await fetch(atob("aHR0cHM6Ly9hcGkubWVvd25pbWUubmV0L2FwaS9hbmlsaXN0"), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
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
    if (retries > 0) {
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
  if (lensSection) lensSection.style.display = 'none';

  const title = anilist.title || {};
  const coverImage = anilist.coverImage ? anilist.coverImage.large : 'https://via.placeholder.com/100?text=Poster';

  document.querySelectorAll('.result-item').forEach(item => item.classList.remove('active'));
  const selectedItem = document.querySelector(`.result-item[data-id="${id}"]`);
  if (selectedItem) selectedItem.classList.add('active');

  let moreInfo = moreInfoCache.get(anilist.id.toString()) || anilist.moreInfo || null;
  let moreInfoHTML = '';

  if (!moreInfo) {
    moreInfoHTML = `<div class="more-info-trigger" data-anilist-id="${anilist.id}"><i class="fa-solid fa-circle-info"></i> Lihat Info & Karakter Selengkapnya</div>`;
  } else {
    const trailer = moreInfo.trailer;
    const trailerHTML = trailer && trailer.site === 'youtube' && trailer.id && trailer.thumbnail
      ? `<p><strong>Trailer:</strong></p><div class="trailer-link clickable" data-trailer="https://www.youtube.com/embed/${trailer.id}">
           <img src="${trailer.thumbnail}" alt="Trailer" loading="lazy">
           <span class="play-icon"><i class="fa-solid fa-play"></i></span>
         </div>`
      : '<p><strong>Trailer:</strong> Tidak ada trailer tersedia.</p>';

    const characters = moreInfo.characters && moreInfo.characters.edges.length > 0
      ? moreInfo.characters.edges.map(edge => {
          const characterName = edge.node.name.full;
          const voiceActor = edge.voiceActors[0]?.name.full || 'Tidak diketahui';
          const characterImage = edge.node.image?.medium || 'https://via.placeholder.com/50?text=No+Image';
          const vaImage = edge.voiceActors[0]?.image?.medium || 'https://via.placeholder.com/50?text=No+Image';
          return `<p>
            <img src="${characterImage}" alt="${characterName}" loading="lazy" class="clickable" data-fullsize="${characterImage}">
            <span style="font-size:12px;"><b>${characterName}</b><br><small style="color:var(--text-muted);"><i class="fa-solid fa-microphone"></i> ${voiceActor}</small></span>
          </p>`;
        }).join('')
      : '<p>Tidak ada data karakter tersedia.</p>';

    const staff = moreInfo.staff && moreInfo.staff.edges.length > 0
      ? moreInfo.staff.edges.map(edge => {
          const staffName = edge.node.name.full;
          const staffRole = edge.role || 'Tidak diketahui';
          const staffImage = edge.node.image?.medium || null;
          return staffImage
            ? `<p><img src="${staffImage}" alt="${staffName}" loading="lazy" class="clickable" data-fullsize="${staffImage}"> <span style="font-size:12px;"><b>${staffRole}</b><br><small style="color:var(--text-muted);">${staffName}</small></span></p>`
            : `<p><strong>${staffRole}</strong>: ${staffName}</p>`;
        }).join('')
      : '<p>Tidak ada data staf tersedia.</p>';

    moreInfoHTML = `
      ${trailerHTML}
      <p><strong>Skor Rata-rata:</strong> <span style="color:#eab308;font-weight:bold;"><i class="fa-solid fa-star"></i> ${moreInfo.meanScore || '?'}/100</span></p>
      <p><strong>Musim:</strong> ${moreInfo.season && moreInfo.seasonYear ? `${moreInfo.season} ${moreInfo.seasonYear}` : '-'}</p>
      <p><strong>Sinopsis:</strong></p>
      <div class="synopsis">${moreInfo.description || 'Tidak ada sinopsis tersedia.'}</div>
      <p><strong>Pemeran Karakter:</strong></p>
      <div class="character-list">${characters}</div>
      <p><strong>Staf Produksi:</strong></p>
      <div class="staff-list">${staff}</div>
    `;
  }

  detailContent.innerHTML = `
    <div class="detail-section">
      <button class="detail-close" onclick="closeDetail()" title="Tutup Detail">✕</button>
      <div class="video-preview">
        ${videoUrl ? `
          <div class="video-wrapper">
            <div class="detail-preview ${videoUrl ? 'clickable' : ''}">
              <img src="${imageUrl || 'https://via.placeholder.com/300x169?text=Video'}" alt="preview" data-original="${videoUrl}">
              ${videoUrl ? '<span class="play-icon"><i class="fa-solid fa-play"></i></span>' : ''}
            </div>
          </div>
        ` : '<p style="color:var(--text-muted); font-size:12px;">Tidak ada video preview.</p>'}

        <button id="tonton-full" class="p-btn p-btn-manage" style="width:100%; margin-top:10px; font-size:12px; padding:8px;"><i class="fa-solid fa-circle-play"></i> Tonton Full Episode di Mionime</button>
      </div>
      <div class="filename-small"><i class="fa-solid fa-file-video"></i> ${filename || 'Unknown'} | <i class="fa-solid fa-stopwatch"></i> ${formatTime(from)} - ${formatTime(to)}</div>

      <div class="full-info">
        <img class="poster clickable" src="${coverImage}" alt="Poster" data-fullsize="${coverImage}">
        <p><strong>Judul Romaji:</strong> <b style="color:#fff;">${title.romaji || 'Tidak diketahui'}</b></p>
        <p><strong>Judul Jepang:</strong> ${title.native || '-'}</p>
        <p><strong>Judul Inggris:</strong> ${title.english || '-'}</p>
        <p><strong>Format:</strong> ${anilist.format || '-'} (${anilist.episodes || '?'} Eps)</p>
        <p><strong>Status:</strong> ${anilist.status || '-'}</p>
        <p><strong>Genre:</strong> <span style="color:var(--primary);">${anilist.genres ? anilist.genres.join(', ') : '-'}</span></p>
        <p><strong>Studios:</strong> ${anilist.studios ? anilist.studios.edges.map(edge => edge.node.name).join(', ') : '-'}</p>
        <p><strong>MAL ID:</strong> ${anilist.idMal ? `<a href="https://myanimelist.net/anime/${anilist.idMal}" target="_blank" style="color:#3b82f6;text-decoration:underline;">${anilist.idMal}</a>` : '-'}</p>
        ${moreInfoHTML}
      </div>
    </div>
  `;

  const tontonBtn = detailContent.querySelector('#tonton-full');
  if (tontonBtn) {
    tontonBtn.addEventListener('click', async () => {
      const malId = anilist.idMal;
      if (!malId) {
        tontonBtn.style.background = '#4b5563';
        tontonBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ID MAL tidak ditemukan';
        return;
      }
      tontonBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengecek Database...';
      tontonBtn.disabled = true;
      try {
        const res = await fetch(`${window.location.origin}/check/${malId}`);
        const data = await res.json();
        if (data.code === 200) {
          tontonBtn.style.background = '#10b981';
          tontonBtn.style.borderColor = '#10b981';
          tontonBtn.innerHTML = '<i class="fa-solid fa-check"></i> Tersedia! Mengarahkan...';
          setTimeout(() => window.location.href = window.location.origin + data.data, 1500);
        } else {
          tontonBtn.style.background = '#ef4444';
          tontonBtn.style.borderColor = '#ef4444';
          tontonBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Belum tersedia di database';
          setTimeout(() => {
            tontonBtn.disabled = false;
            tontonBtn.style.background = '';
            tontonBtn.style.borderColor = '';
            tontonBtn.innerHTML = '<i class="fa-solid fa-circle-play"></i> Tonton Full Episode di Mionime';
          }, 3000);
        }
      } catch (err) {
        tontonBtn.style.background = '#f59e0b';
        tontonBtn.innerHTML = 'Gagal mengecek koneksi';
        tontonBtn.disabled = false;
      }
    });
  }

  if (window.innerWidth <= 600) {
    resultList.style.display = 'none';
    detailContent.style.display = 'block';
  } else {
    detailContent.style.display = 'block';
  }
  attachDetailEvents();
}

function attachDetailEvents() {
  const detailContent = document.getElementById('detail-content');
  if (!detailContent) return;

  const detailPreview = detailContent.querySelector('.detail-preview.clickable');
  if (detailPreview) {
    detailPreview.addEventListener('click', function() {
      openModalVideo(this.querySelector('img').dataset.original);
    });
  }
  const trailerLink = detailContent.querySelector('.trailer-link.clickable');
  if (trailerLink) {
    trailerLink.addEventListener('click', function() {
      openModalIframe(this.dataset.trailer);
    });
  }
  detailContent.querySelectorAll('.poster.clickable, .character-list img.clickable, .staff-list img.clickable').forEach(img => {
    img.addEventListener('click', function() {
      openModalImage(this.dataset.fullsize);
    });
  });

  const moreInfoTrigger = detailContent.querySelector('.more-info-trigger');
  if (moreInfoTrigger) {
    moreInfoTrigger.addEventListener('click', async function() {
      const anilistId = this.dataset.anilistId;
      this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat data karakter & staf...';
      this.style.pointerEvents = 'none';
      await fetchMoreInfo(anilistId);
      const activeItem = document.querySelector('.result-item.active');
      if (activeItem) activeItem.click();
    });
  }
}

function openModalVideo(src) {
  const modal = document.getElementById('videoModal');
  const modalVideo = document.getElementById('modalVideo');
  if(!modal || !modalVideo) return;
  modalVideo.style.display = 'block';
  modalVideo.querySelector('source').src = src;
  modalVideo.load();
  document.getElementById('search-result-box').style.display = 'none';
  modal.style.display = 'block';
}

function openModalIframe(src) {
  const modal = document.getElementById('videoModal');
  const modalIframe = document.getElementById('modalIframe');
  if(!modal || !modalIframe) return;
  modalIframe.style.display = 'block';
  modalIframe.src = src;
  document.getElementById('search-result-box').style.display = 'none';
  modal.style.display = 'block';
}

function openModalImage(src) {
  const modal = document.getElementById('videoModal');
  const modalImage = document.getElementById('modalImage');
  if(!modal || !modalImage) return;
  modalImage.style.display = 'block';
  modalImage.src = src;
  document.getElementById('search-result-box').style.display = 'none';
  modal.style.display = 'block';
}

function closeDetail() {
  const detailContent = document.getElementById('detail-content');
  const resultList = document.getElementById('result-list');
  const lensSection = document.getElementById('google-lens-section');
  if(detailContent) detailContent.style.display = 'none';
  if(resultList) resultList.style.display = 'block';
  if (lensSection) lensSection.style.display = 'block';
  document.querySelectorAll('.result-item').forEach(item => item.classList.remove('active'));
}

function closeResultBox() {
  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const detailContent = document.getElementById('detail-content');
  const floatingFooter = document.getElementById('floating-footer');
  const fileInput = document.getElementById('file-short-anime');
  const imageUrlInput = document.getElementById('image-url');
  
  if(resultBox) resultBox.style.display = 'none';
  if(resultList) resultList.innerHTML = '';
  if(detailContent) { detailContent.innerHTML = ''; detailContent.style.display = 'none'; }
  if(fileInput) fileInput.value = '';
  if(imageUrlInput) imageUrlInput.value = '';
  if(floatingFooter) floatingFooter.style.display = 'flex';

  moreInfoCache.clear();
  googleLensCache = null;
  currentSearchImageUrl = null;
}

function closeModal() {
  const modal = document.getElementById('videoModal');
  if (!modal) return;
  modal.style.display = 'none';

  const modalVideo = document.getElementById('modalVideo');
  const modalIframe = document.getElementById('modalIframe');
  const modalImage = document.getElementById('modalImage');

  if (modalVideo) {
    modalVideo.pause();
    modalVideo.style.display = 'none';
    if (modalVideo.querySelector('source')) modalVideo.querySelector('source').src = '';
    modalVideo.load();
  }
  if (modalIframe) { modalIframe.style.display = 'none'; modalIframe.src = ''; }
  if (modalImage) { modalImage.style.display = 'none'; modalImage.src = ''; }

  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  if (resultBox && resultList && resultList.innerHTML.trim() !== '') {
    resultBox.style.display = 'block';
  }
}

document.addEventListener('click', function(e) {
  if (e.target.matches('.close-modal') || e.target.matches('.modal')) {
    closeModal();
  }
});

// Event Listener Upload Gambar dengan Disable State
const fileInputEl = document.getElementById('file-short-anime');
if (fileInputEl) {
  fileInputEl.addEventListener('change', async function() {
    const file = this.files[0];
    if (!file) return;

    const loading = document.getElementById('loading_file');
    const uploadIcon = document.querySelector('.scene-upload-icon');
    const resultList = document.getElementById('result-list');
    const detailContent = document.getElementById('detail-content');

    if(loading) loading.style.display = 'block';
    if(uploadIcon) uploadIcon.style.display = 'none';
    if(resultList) resultList.innerHTML = '';
    if(detailContent) detailContent.innerHTML = '';
    moreInfoCache.clear();
    googleLensCache = null;

    // Aktifkan Lock Button
    setBtnLoadingState(true, "Mengunggah...");

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
      await performSearch(null, data.secure_url);
    } catch (error) {
      if(resultList) resultList.innerHTML = `<p style="color:var(--primary);padding:15px;">Gagal mengunggah gambar: ${error.message}</p>`;
    } finally {
      if(loading) loading.style.display = 'none';
      if(uploadIcon) uploadIcon.style.display = 'block';
      this.value = '';
      // Lepaskan Lock Button
      setBtnLoadingState(false, "Cari");
    }
  });
}

function isValidImageLink(value) {
  return /^https?:\/\/\S+\.\S+/i.test(value);
}

function triggerSceneUrlSearch() {
  const urlInput = document.getElementById('image-url');
  const rawValue = urlInput ? urlInput.value.trim() : '';
  if (rawValue !== '' && isValidImageLink(rawValue)) {
    const loading = document.getElementById('loading_file');
    const uploadIcon = document.querySelector('.scene-upload-icon');
    if(loading) loading.style.display = 'block';
    if(uploadIcon) uploadIcon.style.display = 'none';
    moreInfoCache.clear();
    googleLensCache = null;
    performSearch(null, rawValue);
  } else {
    alert('Masukkan LINK / URL gambar yang valid (diawali http:// atau https://), bukan teks judul!\nUntuk pencarian dengan tulisan, gunakan kolom pencarian di bar situs paling atas.');
  }
}

const searchBtnEl = document.getElementById('search-anime-btn');
if (searchBtnEl) searchBtnEl.addEventListener('click', triggerSceneUrlSearch);

const urlInputEl = document.getElementById('image-url');
if (urlInputEl) {
  urlInputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); triggerSceneUrlSearch(); }
  });
}

async function performSearch(base64Image, imageUrl) {
  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const detailContent = document.getElementById('detail-content');
  const loading = document.getElementById('loading_file');
  const uploadIcon = document.querySelector('.scene-upload-icon');
  const floatingFooter = document.getElementById('floating-footer');

  if(resultList) resultList.innerHTML = '';
  if(detailContent) { detailContent.innerHTML = ''; detailContent.style.display = 'none'; }
  if(resultBox) resultBox.style.display = 'none';

  // Aktifkan Lock Button (Mencegah Double Click)
  setBtnLoadingState(true, "Mencari...");

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

      resultsWithMoreInfo.forEach((result, index) => {
        const anilist = result.anilist || {};
        const title = anilist.title || {};
        const anilistId = anilist.id || `unknown-${index}`;
        const hasVideo = result.video && result.video !== '';

        const previewDivHTML = `
          <div class="preview-media ${hasVideo ? 'clickable' : ''}">
            <img src="${result.image || 'https://via.placeholder.com/100?text=Video'}" height="100" width="100" alt="preview" ${hasVideo ? `data-original="${result.video}"` : ''}>
            ${hasVideo ? '<span class="play-icon"><i class="fa-solid fa-play"></i></span>' : ''}
          </div>
        `;

        resultList.innerHTML += `
          <div class="result-item" data-id="${anilistId}" data-video="${result.video || ''}" data-filename="${result.filename || 'Tidak diketahui'}" data-from="${result.from}" data-to="${result.to}" data-anilist='${JSON.stringify(anilist).replace(/'/g, '&apos;')}' data-image="${result.image || ''}">
            <div class="summary-info">
              <div class="anime-title">${title.romaji || title.native || 'Tidak diketahui'}</div>
              <div class="anime-subtitle">${title.native || ''}</div>
              <div style="display:flex;gap:12px;margin-top:6px;">
                <span class="episode"><i class="fa-solid fa-tv"></i> Eps ${result.episode || '?'}</span>
                <span class="time"><i class="fa-solid fa-stopwatch"></i> ${formatTime(result.from)}</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Akurasi: <b style="color:#10b981;">${(result.similarity * 100).toFixed(1)}%</b></div>
            </div>
            ${previewDivHTML}
          </div>
        `;
      });

      attachResultEvents();
      setTimeout(() => {
        if(resultBox) resultBox.style.display = 'block';
        if(floatingFooter) floatingFooter.style.display = 'none';
      }, 100);

      if (imageUrl) {
        currentSearchImageUrl = imageUrl;
        if (!googleLensCache) {
          setTimeout(() => fetchGoogleLens(imageUrl), 800);
        } else {
          setTimeout(() => {
            const lensSection = document.getElementById('google-lens-section');
            const lensContainer = document.getElementById('lens-results');
            if(lensSection && lensContainer) {
              lensSection.style.display = 'block';
              lensContainer.innerHTML = googleLensCache;
            }
          }, 300);
        }
      }
    } else {
      if(resultList) resultList.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-muted);">Tidak ditemukan hasil yang cocok dengan scene ini.</p>';
      setTimeout(() => {
        if(resultBox) resultBox.style.display = 'block';
        if(floatingFooter) floatingFooter.style.display = 'none';
      }, 100);
    }
  } catch (error) {
    if(resultList) resultList.innerHTML = `<p style="color:var(--primary);padding:15px;line-height:1.6;font-size:13px;">Gagal mencari: ${error.message}.<br>Pastikan kamu menggunakan gambar dengan rasio 16:9 agar hasil akurat.</p>`;
    if(floatingFooter) floatingFooter.style.display = 'flex';
    setTimeout(() => { if(resultBox) resultBox.style.display = 'block'; }, 100);
  } finally {
    if (loading) loading.style.display = 'none';
    if (uploadIcon) uploadIcon.style.display = 'block';
    // Lepaskan Lock Button Setelah Selesai
    setBtnLoadingState(false, "Cari");
  }
}

function attachResultEvents() {
  document.querySelectorAll('.result-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (e.target.closest('.preview-media')) return;
      const id = this.dataset.id;
      const videoUrl = this.dataset.video;
      const filename = this.dataset.filename;
      const from = parseFloat(this.dataset.from);
      const to = parseFloat(this.dataset.to);
      const anilist = JSON.parse(this.dataset.anilist.replace(/&apos;/g, "'"));
      const imageUrl = this.dataset.image;
      showDetail(id, videoUrl, filename, from, to, anilist, imageUrl, false);
    });
  });

  document.querySelectorAll('.preview-media.clickable img').forEach(img => {
    img.addEventListener('click', function(e) {
      e.stopPropagation();
      openModalVideo(this.dataset.original);
    });
  });
}

// Auto Mode Switch Welcome <-> Scene
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

document.addEventListener('DOMContentLoaded', function() {
  const panelScene = document.getElementById('welcomeModeScene');
  if (!panelScene) return;
  sceneAutoTimer = setInterval(function() {
    if (!sceneUserInteracted) toggleWelcomeSceneMode(false);
  }, 5000);
  ['focusin', 'click', 'change', 'paste', 'input'].forEach(evt => {
    panelScene.addEventListener(evt, lockSceneAutoSwitch);
  });
});
